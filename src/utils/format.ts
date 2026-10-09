/* ==========================================================================
   数值与格式化工具
   ========================================================================== */

/** 四舍五入到指定小数位，规避浮点误差（如 0.1+0.2） */
export function round(n: number, digits = 2): number {
  if (!isFinite(n)) return 0
  const f = Math.pow(10, digits)
  return Math.round((n + Number.EPSILON) * f) / f
}

/** 金额格式化：1234.5 -> "1,234.50" */
export function money(n: number, digits = 2): string {
  const v = round(Number(n) || 0, digits)
  const neg = v < 0
  const [int, dec] = Math.abs(v).toFixed(digits).split('.')
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}${withComma}${dec ? '.' + dec : ''}`
}

/** 带 ¥ 前缀（这里用「元」为单位的通用符号） */
export function moneyCny(n: number, digits = 2): string {
  return `¥${money(n, digits)}`
}

/** 大额缩写：12800 -> 1.28万 */
export function moneyShort(n: number): string {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  if (abs >= 100000000) return `${round(v / 100000000, 2)}亿`
  if (abs >= 10000) return `${round(v / 10000, 2)}万`
  return money(v, abs >= 1000 ? 0 : 2)
}

/** 数量格式：整数不带小数点 */
export function qty(n: number): string {
  const v = Number(n) || 0
  return Number.isInteger(v) ? String(v) : String(round(v, 2))
}

/** 千分位整数 */
export function intComma(n: number): string {
  return Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 百分比：0.1234 -> "12.3%" */
export function percent(n: number, digits = 1): string {
  return `${round((Number(n) || 0) * 100, digits)}%`
}

/** 环比变化：返回百分比数值（正数表示上涨） */
export function changeRate(cur: number, prev: number): number {
  if (!prev) return cur > 0 ? 1 : 0
  return (cur - prev) / Math.abs(prev)
}

/** 数字安全转换 */
export function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return isFinite(n) ? n : fallback
}

/** 金额显示，¥ 前缀 */
export function yuan(n: number, digits = 2): string {
  return `¥${money(n, digits)}`
}

/** 单价显示，自动去尾零：0.50 -> 0.5，2.00 -> 2 */
export function priceText(n: number): string {
  const v = round(Number(n) || 0, 4)
  return String(parseFloat(v.toFixed(4)))
}

/** 生成唯一 id */
export function uid(prefix = ''): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') {
    return prefix + c.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 深拷贝（结构化数据） */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
