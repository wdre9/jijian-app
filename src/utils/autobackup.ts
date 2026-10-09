/**
 * 自动备份：保存数据后按节流策略自动导出备份文件。
 * - 原生 App：写入手机存储「文档/计件自动备份/」目录（@capacitor/filesystem），滚动保留最近 14 份；
 * - Web / PWA：触发浏览器下载（下载位置由浏览器决定，无法自动清理旧文件）。
 * 与手动导出的备份格式完全一致（BuildBackup 产物），可用「导入备份」随时恢复。
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { DataDoc } from '@/types'
import * as db from '@/db'

const UI_KEY = 'jijian:ui:lastAutoBackupAt'
/** 两次自动备份的最小间隔：24 小时 */
const INTERVAL_MS = 24 * 60 * 60 * 1000
/** 原生端目录内最多保留的备份份数 */
const MAX_FILES = 14
const DIR_NAME = '计件自动备份'
const FILE_PREFIX = 'jijian-backup-'

function stamp(): string {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function writeNative(pkg: unknown): Promise<void> {
  try {
    await Filesystem.mkdir({ path: DIR_NAME, directory: Directory.Documents, recursive: true })
  } catch {
    /* 目录已存在 */
  }
  await Filesystem.writeFile({
    path: `${DIR_NAME}/${FILE_PREFIX}${stamp()}.json`,
    directory: Directory.Documents,
    data: JSON.stringify(pkg, null, 2),
    encoding: Encoding.UTF8
  })
  // 滚动清理：只保留最新的 MAX_FILES 份
  try {
    const res = await Filesystem.readdir({ path: DIR_NAME, directory: Directory.Documents })
    const files = res.files
      .filter((f) => f.name && f.name.startsWith(FILE_PREFIX) && f.name.endsWith('.json'))
      .sort((a, b) => (a.name! < b.name! ? -1 : 1))
    for (const f of files.slice(0, Math.max(0, files.length - MAX_FILES))) {
      await Filesystem.deleteFile({ path: `${DIR_NAME}/${f.name}`, directory: Directory.Documents })
    }
  } catch {
    /* 清理失败不影响主流程 */
  }
}

async function writeWeb(pkg: unknown): Promise<void> {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${FILE_PREFIX}${stamp()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 保存文档后调用：满足 24h 间隔即自动导出一份备份 */
export async function maybeAutoBackup(doc: DataDoc): Promise<void> {
  const last = Number(localStorage.getItem(UI_KEY) || 0)
  if (Date.now() - last < INTERVAL_MS) return
  const pkg = await db.buildBackup(doc)
  if (Capacitor.isNativePlatform()) {
    await writeNative(pkg)
  } else {
    await writeWeb(pkg)
  }
  localStorage.setItem(UI_KEY, String(Date.now()))
}

/** 查看最近一次自动备份时间（ms），未备份过返回 0 */
export function lastAutoBackupAt(): number {
  return Number(localStorage.getItem(UI_KEY) || 0)
}
