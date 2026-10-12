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
  /** 四位货号或「计时」= 产品名 */
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
  /** 标题/表头等跳过的行数 */
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
    .replace(/[×Ｘｘ]/g, '×') // 全角 ×/Ｘ/ｘ 统一为半角 ×；半角拉丁 x 刻意不归一化（避免破坏含 x 的工序/产品名）
    .replace(/＝/g, '=')
    .replace(/／/g, '/')
    .replace(/．/g, '.')
    .replace(/、/g, '、')
    // 上标字符归一：¹²³ 在 Latin-1 区(U+00B9/B2/B3)，⁰⁴⁵⁶⁷⁸⁹ 在 U+2070 区，码位不连续，逐字符映射
    .replace(/⁰/g, '0').replace(/¹/g, '1').replace(/²/g, '2')
    .replace(/³/g, '3').replace(/⁴/g, '4').replace(/⁵/g, '5')
    .replace(/⁶/g, '6').replace(/⁷/g, '7').replace(/⁸/g, '8')
    .replace(/⁹/g, '9').replace(/⁺/g, '+').replace(/⁻/g, '-')
    .replace(/⁼/g, '=')
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
/** 「计时」= 独立货号（产品名），与四位数字货号同等对待，如「10.9，计时，11×11.3=124.3」；行首或前接逗号/空格/分号/顿号/空白符 */
const JISHI_CODE_RE = /(?:^|[,，;；、\s])(计时)/
/** 数量×单价=金额（OCR 常见 ×/* 混用，= 可能为全角；半角拉丁 x 刻意不支持，避免破坏含 x 的工序/产品名；从数字本身开始匹配，前导 × 由 cleanProcessSuffix 前缀清理兜底，避免把「二夹623…」的「夹」吞进表达式） */
const QTY_PRICE_RE = /(\d+(?:\.\d+)?)\s*[×*]\s*(\d+(?:\.\d+)?)\s*[=:：]\s*(\d+(?:\.\d+)?)/
/** 标题/表头特征行（非账目内容，如「2026年10月计件明细」） */
const TITLE_RE = /年|明细|汇总|合计|总计|小计|报表|工资|对账|记账/
/** 尾部残留的 ×数量（无单价） */
const TRAIL_QTY_RE = /×\s*\d+(?:\.\d+)?\s*$/
/** 角标 +8 / ⁺⁵ 等（任意位置；归一化后形如 +N，工序中间的角标同样需要清理，如「cnc+5」→「cnc」） */
const TAG_RE = /[+＋⁺]\s*\d+(?:\.\d+)?/g
/** OCR 序号前缀（如「13. 」「14. 」）：后跟非数字、日期（如「13. 10.11」）或账目表达式（如「13. 20×1.2=24」）时剥离，避免误伤「10.11」日期头或残留序号 */
const SEQ_RE = /^\d{1,3}[.、．]\s+(?=\D|\d{1,2}[.、．／/]\d{1,2}|\d+(?:\.\d+)?[×*])/

function cleanProcessSuffix(rest: string): string {
  return rest
    .replace(QTY_PRICE_RE, '')
    .replace(TRAIL_QTY_RE, '')
    .replace(TAG_RE, '')
    .replace(/^[\s\-·、,，:：.×*]+/, '')
    .replace(/[\s\-·、,，:：.×*]+$/, '')
    .trim()
}

/**
 * OCR 常把「日期 货号 工序」与「工序 数量×单价=金额」两行合并成一行（换行丢失），
 * 表现为一行里逗号分隔多段、账目常出现在最后一段，如：
 *   10.11, 9854cnc+5, 一夹623×0.094=58.567, 二夹500×0.1=50
 * 这里按行内全部账目表达式拆分：账目前文本按逗号/分号拆成多段，
 * 各段作为上下文行（货号/工序，首段回填日期头），末段与账目合并成账目行，
 * 使「cnc / 一夹 / 二夹」各归其位；多个账目（如多工序同行）各自独立成行，
 * 不再把后置账目残留进工序名；单段合并行（如「10.11, 一夹623×0.094=58.567」）
 * 日期头同样回填，避免日期丢失。
 */
/** 展开后的逻辑行：text 参与解析，raw/srcIndex 保留原始行用于校对 */
interface ExpandedLine {
  /** 参与解析的逻辑行文本（SEQ 已剥离、合并行拆分后的片段） */
  text: string
  /** 原始输入行（合并行拆分后的各行共享同一原始行，便于与原文校对） */
  raw: string
  /** 原始输入行号（从 0 开始） */
  srcIndex: number
}

function expandMergedLines(lines: string[], today: string): ExpandedLine[] {
  const out: ExpandedLine[] = []
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const push = (text: string) => {
      out.push({ text, raw: line, srcIndex: li })
    }
    const lineNoSeq = line.replace(SEQ_RE, '')
    const hd = matchHeaderDate(lineNoSeq, today)
    const rest0 = hd ? hd.rest : lineNoSeq
    // 行内全部账目表达式（含逗号/分号分隔的多账目）
    const qtyGlobal = new RegExp(QTY_PRICE_RE.source, 'g')
    const qtyMatches: RegExpExecArray[] = []
    let m: RegExpExecArray | null
    while ((m = qtyGlobal.exec(rest0)) !== null) qtyMatches.push(m)
    if (qtyMatches.length === 0) {
      push(lineNoSeq)
      continue
    }
    const datePre = hd ? lineNoSeq.slice(0, lineNoSeq.length - rest0.length) : ''
    let first = true
    let cursor = 0
    for (const qm of qtyMatches) {
      const between = rest0.slice(cursor, qm.index)
      cursor = qm.index + qm[0].length
      const segs = between.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
      // 中间上下文段：不带账目，仅作为货号/工序上下文行（首段回填日期头）
      for (let i = 0; i < segs.length - 1; i++) {
        push(datePre && first ? `${datePre} ${segs[i]}` : segs[i])
        first = false
      }
      // 末段（若有）与账目合并为账目行；账目前无文本则账目独立成行。日期头回填给首个输出行。
      const lastSeg = segs.length > 0 ? segs[segs.length - 1] : ''
      push((datePre && first ? `${datePre} ` : '') + lastSeg + rest0.slice(qm.index, cursor))
      first = false
    }
    // 最后一个账目之后的尾文（极少见）：按分隔符拆为上下文行
    const tail = rest0.slice(cursor)
    if (tail.trim()) {
      const segs = tail.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
      for (const seg of segs) {
        push(datePre && first ? `${datePre} ${seg}` : seg)
        first = false
      }
    }
  }
  return out
}

export function parseImportText(rawText: string, worker = ''): ParseResult {
  const rows: DraftRow[] = []
  const unparsed: string[] = []
  let skippedCount = 0
  let currentDate = ''
  /** 最近出现的货号：OCR 会把「日期 货号 数量×单价=金额」拆成多行，无货号行继承最近货号 */
  let currentCode = ''

  const today = todayStr()
  const lines = expandMergedLines(
    normalizeText(rawText)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    today
  )

  for (const item of lines) {
    // 1) 行首日期头（日期后可能还跟着货号/账目内容）
    const line = item.text
    let rest = line
    const hd = matchHeaderDate(line, today)
    if (hd) {
      currentDate = hd.date
      rest = hd.rest
    }

    // 2) 账目表达式（数量×单价=金额）
    const qp = rest.match(QTY_PRICE_RE)

    // 2b) 标题/汇总类行（无账目时）优先跳过：即使含 4 位数字（如「2026年10月计件明细」）
    //     也先于货号识别处理，避免被误当货号污染后续账目行的归属
    if (!qp && TITLE_RE.test(rest)) {
      skippedCount++
      continue
    }

    // 3) 行内货号（行首四位数字，或前接逗号/空格；不把账目的「数量」当成货号）
    const codeMatch = rest.match(CODE_RE)
    if (codeMatch) {
      const code = codeMatch[1]
      const codeStart = (codeMatch.index ?? 0) + codeMatch[0].lastIndexOf(code)
      const qtyStart = qp ? (qp.index ?? 0) + qp[0].indexOf(qp[1]) : -1
      const isQtyItself = qp && qtyStart >= 0 && codeStart === qtyStart && code === qp[1]
      if (!isQtyItself) currentCode = code
    }

    // 3b) 「计时」独立货号（无四位数字货号时，行首或前接逗号/空格/空白符的「计时」视为货号）
    const jishiMatch = !codeMatch ? rest.match(JISHI_CODE_RE) : null
    if (jishiMatch) currentCode = '计时'

    // 4) 纯日期头行（日期后无任何内容）→ 仅设定日期
    if (hd && !rest.trim()) continue

    // 5) 无账目、无货号、非标题 → 无法归类 → 「未能解析」（标题已在 2b 统一处理）
    if (!qp && !codeMatch && !jishiMatch) {
      unparsed.push(item.raw)
      continue
    }

    // 6) 纯货号/工序行（无账目）：仅作为后续行的货号上下文
    if (!qp) continue

    // 7) 账目行但前面没有货号上下文 → 无法归属产品
    if (!currentCode) {
      unparsed.push(item.raw)
      continue
    }

    const quantity = parseFloat(qp[1])
    const price = parseFloat(qp[2])
    const productCode = currentCode

    // 工序后缀：优先从行首货号之后取；若本行没有货号（数量行继承货号），从行首取
    const qtyStart = (qp.index ?? 0) + qp[0].indexOf(qp[1])
    const codeStart = codeMatch ? (codeMatch.index ?? 0) + codeMatch[0].lastIndexOf(codeMatch[1]) : -1
    const hasHeadCode = codeMatch ? codeStart !== qtyStart : !!jishiMatch
    let suffix = rest
    if (hasHeadCode) {
      suffix = codeMatch
        ? rest.slice((codeMatch!.index ?? 0) + codeMatch![0].length)
        : rest.slice((jishiMatch!.index ?? 0) + jishiMatch![0].length)
    }
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
      raw: item.raw
    })
  }

  return { rows, skippedCount, unparsed }
}


