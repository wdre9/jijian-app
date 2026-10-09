/* ==========================================================================
   日期工具（全部基于本地时区，字符串形式 YYYY-MM-DD）
   ========================================================================== */

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n))

/** 格式化为 YYYY-MM-DD */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 今天的日期串 */
export function todayStr(): string {
  return toDateStr(new Date())
}

/** 日期串 -> Date（本地 0 点） */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map((v) => parseInt(v, 10))
  return new Date(y, (m || 1) - 1, d || 1)
}

/** 日期串偏移 n 天 */
export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** 时间戳 -> YYYY-MM-DD */
export function tsToDateStr(ts: number): string {
  return toDateStr(new Date(ts))
}

/** 月份键 YYYY-MM */
export function monthKey(s: string): string {
  return s.slice(0, 7)
}

/** 当前月份键 */
export function currentMonthKey(): string {
  return monthKey(todayStr())
}

/** 月份中文标签，如 2026年10月 */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}年${parseInt(m, 10)}月`
}

/** 某月的起止日期 */
export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map((v) => parseInt(v, 10))
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)
  return { start: toDateStr(start), end: toDateStr(end) }
}

/** 当前月份的起止日期 */
export function currentMonthRange(): { start: string; end: string } {
  return monthRange(currentMonthKey())
}

/** 以周一为一周起点，返回所在周的起止日期 */
export function weekRange(s: string): { start: string; end: string } {
  const d = parseDate(s)
  const day = d.getDay() === 0 ? 7 : d.getDay() // 周一=1 ... 周日=7
  const start = new Date(d)
  start.setDate(d.getDate() - (day - 1))
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: toDateStr(start), end: toDateStr(end) }
}

/** 月份偏移 */
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map((v) => parseInt(v, 10))
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 生成 [start, end] 内的连续日期列表 */
export function dateList(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  let guard = 0
  while (cur <= end && guard < 1200) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

/** 该月全部日期 */
export function monthDates(ym: string): string[] {
  const { start, end } = monthRange(ym)
  return dateList(start, end)
}

/** 该月天数 */
export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map((v) => parseInt(v, 10))
  return new Date(y, m, 0).getDate()
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

/** 星期中文，如 "周三" */
export function weekdayCn(s: string): string {
  return `周${WEEK_CN[parseDate(s).getDay()]}`
}

/** 友好日期：今天 / 昨天 / 前天 / M月D日 */
export function friendlyDate(s: string): string {
  const t = todayStr()
  if (s === t) return '今天'
  if (s === addDays(t, -1)) return '昨天'
  if (s === addDays(t, -2)) return '前天'
  const d = parseDate(s)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 分组头标题：今天 10月9日 周四 */
export function groupTitle(s: string): string {
  const d = parseDate(s)
  return `${friendlyDate(s)} ${d.getMonth() + 1}月${d.getDate()}日 ${weekdayCn(s)}`
}

/** 时间戳 -> 可读时间，用于记录时间戳展示 */
export function formatTime(ts: number, withDate = false): string {
  const d = new Date(ts)
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (!withDate) return hhmm
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hhmm}`
}

/** 时间戳 -> YYYY-MM-DD HH:mm:ss */
export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** 用于文件名的时间戳串 */
export function fileStamp(ts = Date.now()): string {
  const d = new Date(ts)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes()
  )}`
}

/** 距今多少天 */
export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime()
  return Math.round(ms / 86400000)
}
