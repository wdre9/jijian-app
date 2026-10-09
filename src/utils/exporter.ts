/* ==========================================================================
   导出工具：Excel（xlsx）/ CSV / JSON / 文本，全部在浏览器本地完成
   ========================================================================== */
import * as XLSX from 'xlsx'
import type { RecordRow } from '@/types'
import { priceText, qty } from '@/utils/format'

export interface SheetData {
  name: string
  aoa: Array<Array<string | number>>
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

/** 文本文件下载（默认 CSV，带 BOM 便于 Excel 直接打开） */
export function downloadText(content: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  const bom = mime.startsWith('text/csv') ? '\ufeff' : ''
  downloadBlob(new Blob([bom + content], { type: mime }), filename)
}

/** 导出 JSON */
export function downloadJson(obj: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename)
}

/** 由多张表生成 Excel 工作簿并下载 */
export function exportWorkbook(sheets: SheetData[], filename: string): void {
  const wb = XLSX.utils.book_new()
  sheets.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa)
    // 估算列宽，避免打开后全挤在一起
    const widths: number[] = []
    s.aoa.forEach((row) => {
      row.forEach((cell, i) => {
        const len = String(cell ?? '').replace(/[^\x00-\xff]/g, 'xx').length + 2
        widths[i] = Math.min(28, Math.max(widths[i] || 8, len))
      })
    })
    ws['!cols'] = widths.map((w) => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  })
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  )
}

/** 明细表表头 */
export const DETAIL_HEADER = [
  '日期',
  '产品',
  '规格',
  '工序',
  '数量',
  '单价(元)',
  '金额(元)',
  '工人',
  '班次',
  '备注'
]

/** 明细记录 -> 二维数组 */
export function detailAoa(
  rows: RecordRow[],
  specOf: (productId: string) => string = () => ''
): Array<Array<string | number>> {
  const body = rows.map((r) => [
    r.date,
    r.productName,
    specOf(r.productId),
    r.processName,
    r.quantity,
    priceText(r.price),
    r.amount,
    r.worker || '',
    r.shift === 'night' ? '夜班' : '白班',
    r.note || ''
  ])
  return [DETAIL_HEADER, ...body]
}

/** 明细 -> CSV 文本 */
export function detailCsv(rows: RecordRow[], specOf: (productId: string) => string = () => ''): string {
  return detailAoa(rows, specOf)
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '')
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(',')
    )
    .join('\r\n')
}

/** 汇总 -> 二维数组 */
export function summaryAoa(
  title: string,
  header: string[],
  rows: Array<Array<string | number>>
): Array<Array<string | number>> {
  return [[title], header, ...rows, [], ['导出时间', new Date().toLocaleString('zh-CN')]]
}

/** 记录条数描述 */
export function countText(rows: RecordRow[]): string {
  const n = rows.length
  const q = qty(rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0))
  return `${n} 笔 · ${q} 件`
}
