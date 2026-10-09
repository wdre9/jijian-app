/* ==========================================================================
   批量导入工具：文本解析（OCR 识别统一入口见 utils/ocr.ts）
   所有识别与解析都在用户设备本地完成，不上传任何数据。
   ========================================================================== */
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

/** 行首日期头：10.4 / 10/4 / 10-4 / 10.4日 / 10月4日；
    日期后允许跟货号或账目内容（OCR 常把原一行拆成多行，如「10.4, 5552」） */
const DATE_HEAD_RE = /^(\d{1,2})[./、/-]\s*(\d{1,2})日?/
const DATE_CN_HEAD_RE = /^(\d{1,2})月(\d{1,2})日?/

function matchHeaderDate(line: string, today: string): { date: string; rest: string } | null {
  const m = line.match(DATE_HEAD_RE) || line.match(DATE_CN_HEAD_RE)
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
  return { date, rest: line.slice(m[0].length) }
}

/* ----------------------------- 记录行解析 ----------------------------- */

/** 四位数字 = 货号（行首或前接逗号/空格等分隔符；「3500×0.1=350」中的数量不视为货号） */
const CODE_RE = /(?:^|[^\d])(\d{4})(?!\d)/
/** 数量×单价=金额（OCR 常见 ×/x/* 混用，= 可能为全角；兼容「×数量×单价=金额」的前导 ×） */
const QTY_PRICE_RE = /(?:^|[^\d.])(\d+(?:\.\d+)?)\s*[×x*]\s*(\d+(?:\.\d+)?)\s*[=:：]\s*(\d+(?:\.\d+)?)/
/** 标题/表头特征行（非账目内容，如「2026年10月计件明细」） */
const TITLE_RE = /年|明细|汇总|合计|总计|小计|报表|工资|对账|记账/
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
  /** 最近出现的货号：OCR 会把「日期 货号 数量×单价=金额」拆成多行，无货号行继承最近货号 */
  let currentCode = ''

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

    // 1) 行首日期头（日期后可能还跟着货号/账目内容）
    let rest = line
    const hd = matchHeaderDate(line, today)
    if (hd) {
      currentDate = hd.date
      rest = hd.rest
    }

    // 2) 账目表达式（数量×单价=金额）
    const qp = rest.match(QTY_PRICE_RE)

    // 3) 行内货号（行首四位数字，或前接逗号/空格；不把账目的「数量」当成货号）
    const codeMatch = rest.match(CODE_RE)
    if (codeMatch) {
      const code = codeMatch[1]
      const codeStart = (codeMatch.index ?? 0) + codeMatch[0].lastIndexOf(code)
      const qtyStart = qp ? (qp.index ?? 0) + qp[0].indexOf(qp[1]) : -1
      const isQtyItself = qp && qtyStart >= 0 && codeStart === qtyStart && code === qp[1]
      if (!isQtyItself) currentCode = code
    }

    // 4) 纯日期头行（日期后无任何内容）→ 仅设定日期
    if (hd && !rest.trim()) continue

    // 5) 标题/表头行：无账目、无货号但像标题 → 自动跳过（不再堆进「未能解析」）
    if (!qp && !codeMatch) {
      if (TITLE_RE.test(rest)) {
        skippedCount++
        continue
      }
      unparsed.push(line)
      continue
    }

    // 6) 纯货号/工序行（无账目）：仅作为后续行的货号上下文
    if (!qp) continue

    // 7) 账目行但前面没有货号上下文 → 无法归属产品
    if (!currentCode) {
      unparsed.push(line)
      continue
    }

    const quantity = parseFloat(qp[1])
    const price = parseFloat(qp[2])
    const productCode = currentCode

    // 工序后缀：优先从行首货号之后取；若本行没有货号（数量行继承货号），从行首取
    const qtyStart = (qp.index ?? 0) + qp[0].indexOf(qp[1])
    const codeStart = codeMatch ? (codeMatch.index ?? 0) + codeMatch[0].lastIndexOf(codeMatch[1]) : -1
    const hasHeadCode = codeMatch && codeStart !== qtyStart
    const suffix = hasHeadCode ? rest.slice(codeMatch![0].length) : rest
    const processName = cleanProcessSuffix(suffix) || '未分类'

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


