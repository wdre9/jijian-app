/* ==========================================================================
   统计聚合工具：把记录列表聚合成各维度汇总
   ========================================================================== */
import type { PieceRecord, Process, Product, RecordRow, SummaryRow } from '@/types'
import { round } from '@/utils/format'
import { monthKey } from '@/utils/date'

/** 记录工序显示名：优先工序名称快照，其次按 processMap 回退；未填（processId 为空且无快照）→ 未填工序，已删除 → 已删除工序 */
export function processDisplayName(
  r: Pick<PieceRecord, 'processId' | 'processNameSnapshot'>,
  processMap: Map<string, Process>
): string {
  if (r.processNameSnapshot) return r.processNameSnapshot
  if (!r.processId) return '未填工序'
  return processMap.get(r.processId)?.name || '已删除工序'
}

export function enrich(
  records: PieceRecord[],
  productMap: Map<string, Product>,
  processMap: Map<string, Process>
): RecordRow[] {
  return records.map((r) => ({
    ...r,
    productName: productMap.get(r.productId)?.name || '已删除产品',
    processName: processDisplayName(r, processMap)
  }))
}

export function sumAmount(records: PieceRecord[]): number {
  return round(
    records.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    2
  )
}

export function sumQty(records: PieceRecord[]): number {
  return round(
    records.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
    2
  )
}

/** 按日期分组：Map<date, records[]>，按日期倒序 */
export function groupByDate(records: PieceRecord[]): Array<{ date: string; rows: PieceRecord[] }> {
  const map = new Map<string, PieceRecord[]>()
  records.forEach((r) => {
    const arr = map.get(r.date)
    if (arr) arr.push(r)
    else map.set(r.date, [r])
  })
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, rows]) => ({
      date,
      rows: rows.sort((a, b) => b.createdAt - a.createdAt)
    }))
}

/** 通用分组汇总 */
function summarize(
  records: PieceRecord[],
  keyOf: (r: PieceRecord) => string,
  labelOf: (r: PieceRecord) => { label: string; sub?: string }
): SummaryRow[] {
  const map = new Map<string, SummaryRow>()
  records.forEach((r) => {
    const key = keyOf(r)
    let row = map.get(key)
    if (!row) {
      const l = labelOf(r)
      row = { key, label: l.label, sub: l.sub, quantity: 0, amount: 0, times: 0 }
      map.set(key, row)
    }
    row.quantity += Number(r.quantity) || 0
    row.amount += Number(r.amount) || 0
    row.times += 1
  })
  return Array.from(map.values())
    .map((r) => ({ ...r, quantity: round(r.quantity, 2), amount: round(r.amount, 2) }))
    .sort((a, b) => b.amount - a.amount)
}

export function byProduct(
  records: PieceRecord[],
  productMap: Map<string, Product>
): SummaryRow[] {
  return summarize(
    records,
    (r) => r.productId,
    (r) => {
      const p = productMap.get(r.productId)
      return { label: p?.name || '已删除产品', sub: p?.spec || '' }
    }
  )
}

export function byProcess(
  records: PieceRecord[],
  processMap: Map<string, Process>,
  productMap?: Map<string, Product>
): SummaryRow[] {
  return summarize(
    records,
    (r) => r.processId,
    (r) => {
      const p = productMap?.get(r.productId)
      return {
        label: processDisplayName(r, processMap),
        sub: p ? p.name : ''
      }
    }
  )
}

export function byWorker(records: PieceRecord[]): SummaryRow[] {
  return summarize(
    records,
    (r) => r.worker || '未填写',
    (r) => ({ label: r.worker || '未填写' })
  )
}

export function byDate(records: PieceRecord[]): SummaryRow[] {
  return summarize(
    records,
    (r) => r.date,
    (r) => ({ label: r.date })
  ).sort((a, b) => (a.key < b.key ? 1 : -1))
}

export function byShift(records: PieceRecord[]): SummaryRow[] {
  return summarize(
    records,
    (r) => r.shift,
    (r) => ({ label: r.shift === 'night' ? '夜班' : '白班' })
  )
}

/** 按"产品·工序"组合汇总 */
export function byProductProcess(
  records: PieceRecord[],
  productMap: Map<string, Product>,
  processMap: Map<string, Process>
): SummaryRow[] {
  return summarize(
    records,
    (r) => `${r.productId}|${r.processId}`,
    (r) => ({
      label: processDisplayName(r, processMap),
      sub: productMap.get(r.productId)?.name || '已删除产品'
    })
  )
}

/** 日均产出：按有记录的天数计算 */
export function dailyAverage(records: PieceRecord[]): { amount: number; qty: number; days: number } {
  const days = new Set(records.map((r) => r.date)).size
  if (!days) return { amount: 0, qty: 0, days: 0 }
  return {
    amount: round(sumAmount(records) / days, 2),
    qty: round(sumQty(records) / days, 2),
    days
  }
}

/** 单日最高产出 */
export function bestDay(records: PieceRecord[]): { date: string; amount: number } {
  const rows = byDate(records)
  if (!rows.length) return { date: '', amount: 0 }
  const top = rows.reduce((a, b) => (b.amount > a.amount ? b : a))
  return { date: top.key, amount: top.amount }
}

/** 按月汇总：Map<'YYYY-MM', {amount, qty, days}> */
export function monthBuckets(records: PieceRecord[]) {
  const map = new Map<string, { amount: number; qty: number; dates: Set<string> }>()
  records.forEach((r) => {
    const k = monthKey(r.date)
    let b = map.get(k)
    if (!b) {
      b = { amount: 0, qty: 0, dates: new Set<string>() }
      map.set(k, b)
    }
    b.amount += Number(r.amount) || 0
    b.qty += Number(r.quantity) || 0
    b.dates.add(r.date)
  })
  return map
}

/** 生成连续 N 个月的键（含当前月），升序 */
export function recentMonths(n: number, fromYm: string): string[] {
  const out: string[] = []
  const [y, m] = fromYm.split('-').map((v) => parseInt(v, 10))
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** 单条记录的时薪估算（需提供耗时才会用到；这里保留占位） */
export function avgPricePerPiece(records: PieceRecord[]): number {
  const q = sumQty(records)
  if (!q) return 0
  return round(sumAmount(records) / q, 4)
}

/**
 * 计算记录的展示次数文案（第 N 次）：
 * - 手动模式：直接取 count 值；
 * - 自动模式：按该产品全部历史记录按创建时间排序后的序号（含本条）。
 * 无法确定时返回空串。
 */
export function recordCountLabel(
  record: Pick<PieceRecord, 'id' | 'productId' | 'countMode' | 'count' | 'createdAt'>,
  all: PieceRecord[]
): string {
  if (record.countMode === 'manual') {
    return record.count != null ? `第 ${record.count} 次` : ''
  }
  const list = all
    .filter((x) => x.productId === record.productId)
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
  const idx = list.findIndex((x) => x.id === record.id)
  return idx >= 0 ? `第 ${idx + 1} 次` : ''
}
