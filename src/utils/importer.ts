/* ==========================================================================
   批量导入工具：文本解析 + 本地 OCR（tesseract.js 中文）
   所有识别与解析都在用户设备本地完成，不上传任何数据。
   ========================================================================== */
import * as Tesseract from 'tesseract.js'
import type { Shift } from '@/types'
import { round } from '@/utils/format'
import { daysBetween, todayStr, toDateStr } from '@/utils/date'

/** 待导入草稿行（预览可编辑后入库） */
export interface DraftRow {
  /** YYYY-MM-DD */
  date: string
  /** 四位货号 = 产品名 */
  productCode: string
  /** 工序名，无工序为「未分类」 */
  processName: string
  quantity: number
  price: number
  /** 数量×单价 程序重算，三位小数原样存储、两位显示 */
  amount: number
  worker: string
  shift: Shift
  note: string
  /** 原始文本行，便于校对 */
  raw: string
}

export interface ParseResult {
  rows: DraftRow[]
  /** 「计时」等跳过的行数 */
  skippedCount: number
  /** 无法解析的原始行（无日期上下文 / 无货号 / 无 ×数量×单价） */
  unparsed: string[]
}

/* ----------------------------- 文本规范化 ----------------------------- */

/** 全角字符转半角（OCR 常见噪声） */
function normalizeText(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[×xＸＸ]/g, '×')
    .replace(/＝/g, '=')
    .replace(/／/g, '/')
    .replace(/．/g, '.')
    .replace(/、/g, '、')
}

/* ----------------------------- 日期解析 ----------------------------- */

/** 日期头行：10.4 / 10/4 / 10-4 / 10.4日 / 10月4日 / 10月4 */
const DATE_RE = /^(\d{1,2})[./、/-]\s*(\d{1,2})日?$/
const DATE_CN_RE = /^(\d{1,2})月(\d{1,2})日?$/

function parseHeaderDate(line: string, today: string): string | null {
  const m = line.match(DATE_RE) || line.match(DATE_CN_RE)
  if (!m) return null
  const month = parseInt(m[1], 10)
  const day = parseInt(m[2], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // 默认取今年；若算出的日期明显落在未来（超 30 天），认为是上一年
  let year = new Date().getFullYear()
  let date = toDateStr(new Date(year, month - 1, day))
  if (date > today && daysBetween(today, date) > 30) {
    year -= 1
    date = toDateStr(new Date(year, month - 1, day))
  }
  return date
}

/* ----------------------------- 记录行解析 ----------------------------- */

/** 行首四位数字 = 货号 */
const CODE_RE = /^(\d{4})/
/** ×数量×单价=金额（OCR 常见 ×/x/* 混用，= 可能为全角） */
const QTY_PRICE_RE = /×\s*(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)\s*[=:：]\s*(\d+(?:\.\d+)?)/
/** 尾部残留的 ×数量（无单价） */
const TRAIL_QTY_RE = /×\s*\d+(?:\.\d+)?\s*$/
/** 尾部角标 +8 等 */
const TRAIL_TAG_RE = /[+＋]\s*\d+(?:\.\d+)?\s*$/
/** 行首角标 +8 等（货号后紧跟） */
const LEAD_TAG_RE = /^[+＋]\s*\d+(?:\.\d+)?\s*/

function cleanProcessSuffix(rest: string): string {
  return rest
    .replace(QTY_PRICE_RE, '')
    .replace(TRAIL_QTY_RE, '')
    .replace(TRAIL_TAG_RE, '')
    .replace(LEAD_TAG_RE, '')
    .replace(/^[\s\-·、,，:：.]+/, '')
    .replace(/[\s\-·、,，:：.]+$/, '')
    .trim()
}

export function parseImportText(rawText: string, worker = ''): ParseResult {
  const rows: DraftRow[] = []
  const unparsed: string[] = []
  let skippedCount = 0
  let currentDate = ''

  const today = todayStr()
  const lines = normalizeText(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (line.includes('计时')) {
      skippedCount++
      continue
    }

    const headerDate = parseHeaderDate(line, today)
    if (headerDate) {
      currentDate = headerDate
      continue
    }

    if (!currentDate) {
      // 尚未遇到日期头，无法归入任何日期
      unparsed.push(line)
      continue
    }

    const codeMatch = line.match(CODE_RE)
    if (!codeMatch) {
      unparsed.push(line)
      continue
    }
    const productCode = codeMatch[1]

    const qp = line.match(QTY_PRICE_RE)
    if (!qp) {
      unparsed.push(line)
      continue
    }

    const quantity = parseFloat(qp[1])
    const price = parseFloat(qp[2])
    const processName = cleanProcessSuffix(line.slice(codeMatch[0].length)) || '未分类'

    rows.push({
      date: currentDate,
      productCode,
      processName,
      quantity,
      price,
      amount: round(quantity * price, 3),
      worker,
      shift: 'day',
      note: '',
      raw: line
    })
  }

  return { rows, skippedCount, unparsed }
}

/* ----------------------------- 图片 OCR（本地 tesseract.js） ----------------------------- */

let workerPromise: Promise<Tesseract.Worker> | null = null
let loggerHandler: ((m: Tesseract.LoggerMessage) => void) | null = null

async function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('chi_sim', 1, {
      // 首次使用从 CDN 下载 chi_sim 语言包后自动缓存（IndexedDB），后续离线可复用；
      // 图片数据全程在本机识别，不出设备。
      cacheMethod: 'refresh',
      logger: (m) => {
        if (loggerHandler) loggerHandler(m)
      }
    })
  }
  return workerPromise
}

export function setOcrLogger(fn: ((m: Tesseract.LoggerMessage) => void) | null): void {
  loggerHandler = fn
}

/** 识别单张图片，返回识别文本 */
export async function ocrImage(blob: Blob): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(blob)
  return data.text || ''
}

/** 释放 OCR worker（组件卸载时调用） */
export async function releaseOcrWorker(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise
    try {
      await w.terminate()
    } catch {
      /* ignore */
    }
    workerPromise = null
  }
}
