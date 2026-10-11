/* ==========================================================================
   导出工具：Excel（xlsx）/ CSV / JSON / 文本
   - 网页端：浏览器本地下载
   - Android 原生端（Capacitor）：优先写入公共 Documents/jijian-exports（文件管理
     器「文档」可直接看到），无公共目录权限时依次降级到公共 Downloads、应用私有
     files 目录，并返回真实落盘位置供界面提示，避免「导出后找不到文件」。
   ========================================================================== */
import * as XLSX from 'xlsx'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import type { RecordRow } from '@/types'
import { priceText, qty } from '@/utils/format'
import { withTimeout } from '@/utils/async'
import { MediaStoreSaver, canUseMediaStore } from '@/utils/mediastore'

export interface SheetData {
  name: string
  aoa: Array<Array<string | number>>
}

/** 导出结果：web = 浏览器下载已触发；native = 已写入原生端（返回可见路径） */
export type ExportResult =
  | { mode: 'web' }
  | {
      mode: 'native'
      /** 实际落盘的公共/私有目录类型 */
      directory: 'Documents' | 'Downloads' | 'Data'
      /** 目录的人类可读标签（文档 / 下载 / 应用私有目录） */
      label: string
      /** 相对路径，如 Documents/jijian-exports/xxx.xlsx */
      path: string
      /** 文件管理器视角的展示文案，如 文件管理 → 文档 → jijian-exports/xxx.xlsx */
      display: string
      /** 附加提示：未开启「所有文件访问权限」导致只能落到应用私有目录时的开启指引 */
      note?: string
    }

/** 原生端导出文件目录 */
const NATIVE_EXPORT_DIR = 'jijian-exports'

/** 尝试写入的目录顺序：公共文档 → 公共下载（External 根 + Download 子路径）→ 应用外部目录（必成功） */
const NATIVE_DIRS: Array<{
  directory: Directory
  key: 'Documents' | 'Downloads' | 'Data'
  label: string
  subPath: string
}> = [
  { directory: Directory.Documents, key: 'Documents', label: '文档', subPath: NATIVE_EXPORT_DIR },
  { directory: Directory.External, key: 'Downloads', label: '下载', subPath: `Download/${NATIVE_EXPORT_DIR}` },
  // 兜底用 ExternalStorage（/Android/data/包名/files，部分文件管理器可见），
  // 不用 Directory.Data（/data/data 内部私有目录，文件管理器完全不可见）
  { directory: Directory.ExternalStorage, key: 'Data', label: '应用外部目录', subPath: NATIVE_EXPORT_DIR }
]

/** 去掉文件名中的非法字符，避免原生文件系统写入失败 */
function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').replace(/[.\s]+$/g, '')
  return cleaned || 'export'
}

/** Blob -> data URL（Capacitor Filesystem 可直接解码写入） */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result
      if (typeof data === 'string') resolve(data)
      else reject(new Error('文件内容读取失败'))
    }
    reader.onerror = () => reject(reader.error || new Error('文件内容读取失败'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 请求公共存储权限（仅 Android 10 及以下弹运行时对话框；Android 11+ 不自动跳
 * 「所有文件访问权限」系统设置页——该跳转会挂起 JS Promise 导致导出无任何反馈，
 * 是 v1.2.5 导出回归的根因）。
 *
 * 所有桥接调用均包 withTimeout 超时兜底：原生端偶发 Promise 悬挂时按「未授权」
 * 继续走目录降级，保证导出流程永不卡死。
 *
 * @returns true=已获得公共目录写权限；false=未获得（走 Documents→Downloads→Data 降级链）
 */
async function ensurePublicStoragePermission(): Promise<boolean> {
  const DENIED = { publicStorage: 'denied' } as Awaited<ReturnType<typeof Filesystem.checkPermissions>>
  try {
    const status = await withTimeout(Filesystem.checkPermissions(), 1500, () => DENIED)
    if (status?.publicStorage === 'granted') return true
    // 仅旧系统（Android 10 及以下）走运行时对话框；Android 11+ 上 publicStorage 只会是
    // granted / denied，不会进入此分支，因此不会触发跳系统设置页。
    if (status?.publicStorage === 'prompt' || status?.publicStorage === 'prompt-with-rationale') {
      try {
        const req = await withTimeout(Filesystem.requestPermissions(), 2500, () => DENIED)
        if (req?.publicStorage === 'granted') return true
      } catch {
        // requestPermissions 异常（无权限页/ActivityNotFound）不阻塞导出
      }
    }
    return false
  } catch {
    return false
  }
}

/** 向指定目录写入文件（目录不存在则递归创建） */
async function tryWriteTo(dir: Directory, subPath: string, name: string, data: string): Promise<void> {
  await Filesystem.mkdir({ path: subPath, directory: dir, recursive: true })
  await Filesystem.writeFile({
    path: `${subPath}/${name}`,
    directory: dir,
    data,
    recursive: true
  })
}

/**
 * 保存文件：Android 原生端先请求公共存储权限，再按
 * Documents → Downloads → Data 依次尝试写入（保证必然成功且路径真实）；
 * 网页端保持浏览器下载。返回结果供调用方给出成功提示（含保存位置）。
 */
export async function saveBlob(blob: Blob, filename: string): Promise<ExportResult> {
  const name = sanitizeFilename(filename)
  if (Capacitor.isNativePlatform()) {
    let data: string
    try {
      data = await withTimeout(blobToDataUrl(blob), 8000, () => {
        throw new Error('文件编码超时')
      })
    } catch (e) {
      throw e instanceof Error ? e : new Error('文件内容编码失败')
    }
    // 首选 MediaStore：Android 10+ 无需任何存储权限，直写公共「文档」目录，
    // 文件管理器立即可见（Android 11+ 分区存储下免权限落公共目录的唯一正解）。
    // 失败 / Android 9 及以下 / 非 Android 平台时回落到下方 Filesystem 降级链。
    if (canUseMediaStore()) {
      try {
        const base64 = data.slice(data.indexOf(',') + 1)
        const saved = await withTimeout(
          MediaStoreSaver.saveToDocuments({
            base64,
            filename: name,
            mimeType: blob.type || 'application/octet-stream',
            subdir: NATIVE_EXPORT_DIR
          }),
          8000,
          () => {
            throw new Error('写入公共文档超时')
          }
        )
        return {
          mode: 'native',
          directory: 'Documents',
          label: '文档',
          path: `Documents/${NATIVE_EXPORT_DIR}/${name}`,
          display: saved.display || `文件管理 → 文档 → ${NATIVE_EXPORT_DIR}/${name}`
        }
      } catch {
        // MediaStore 不可用（Android 9 及以下）或桥接异常：继续走原有降级链
      }
    }
    // 权限检查带超时兜底；失败/悬挂一律视为未授权，继续走目录降级
    let publicOk = false
    try {
      publicOk = await ensurePublicStoragePermission()
    } catch {
      publicOk = false
    }
    let lastErr: unknown = null
    for (const item of NATIVE_DIRS) {
      try {
        await tryWriteTo(item.directory, item.subPath, name, data)
        const base = `文件管理 → ${item.label} → ${NATIVE_EXPORT_DIR}/${name}`
        // 未获得公共存储权限且最终落到应用外部目录时，附加开启指引（公共目录可写时不打扰）
        const note =
          publicOk || item.key !== 'Data'
            ? undefined
            : '未开启「所有文件访问权限」，已保存到应用外部目录（内部存储/Android/data/com.wdre9.jijian/files）；如需保存到公共文档，请到系统设置开启该权限后重新导出'
        return {
          mode: 'native',
          directory: item.key,
          label: item.label,
          path: `${item.key}/${NATIVE_EXPORT_DIR}/${name}`,
          display: note ? `${base}（应用外部目录）` : base,
          note
        }
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('文件写入失败')
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
  return { mode: 'web' }
}

/** 文本文件保存（默认 CSV，带 BOM 便于 Excel 直接打开） */
export async function downloadText(
  content: string,
  filename: string,
  mime = 'text/csv;charset=utf-8'
): Promise<ExportResult> {
  const bom = mime.startsWith('text/csv') ? '\ufeff' : ''
  return saveBlob(new Blob([bom + content], { type: mime }), filename)
}

/** 保存 JSON */
export async function downloadJson(obj: unknown, filename: string): Promise<ExportResult> {
  return saveBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename)
}

/** 由多张表生成 Excel 工作簿并保存 */
export async function exportWorkbook(sheets: SheetData[], filename: string): Promise<ExportResult> {
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
  return saveBlob(
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
  '备注',
  '次数模式',
  '次数'
]

/**
 * 明细记录 -> 二维数组
 * countOf：每行次数展示值。默认手动模式导出 count 值、自动模式导出空（自动为实时计算，
 * 不落库）；如需导出当前计算次数，可传入 recordCountLabel 等计算函数。
 */
export function detailAoa(
  rows: RecordRow[],
  specOf: (productId: string) => string = () => '',
  countOf: (r: RecordRow) => string | number = (r) =>
    r.countMode === 'manual' ? (r.count ?? '') : ''
): Array<Array<string | number>> {
  const body = rows.map((r) => [
    r.date,
    r.productName,
    specOf(r.productId),
    // 工序列：优先快照/已解析名称，空则导出「未填工序」
    r.processName || r.processNameSnapshot || '未填工序',
    r.quantity,
    priceText(r.price),
    r.amount,
    r.worker || '',
    r.shift === 'night' ? '夜班' : '白班',
    r.note || '',
    r.countMode === 'manual' ? '手动' : '自动',
    countOf(r)
  ])
  return [DETAIL_HEADER, ...body]
}

/** 明细 -> CSV 文本 */
export function detailCsv(
  rows: RecordRow[],
  specOf: (productId: string) => string = () => '',
  countOf: (r: RecordRow) => string | number = (r) =>
    r.countMode === 'manual' ? (r.count ?? '') : ''
): string {
  return detailAoa(rows, specOf, countOf)
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
