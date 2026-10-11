/**
 * 自动备份：保存数据后按节流策略自动导出备份文件。
 * - 原生 App：写入手机存储「文档/计件自动备份/」目录（@capacitor/filesystem），滚动保留最近 14 份；
 * - Web / PWA：触发浏览器下载（下载位置由浏览器决定，无法自动清理旧文件）。
 * 与手动导出的备份格式完全一致（BuildBackup 产物），可用「导入备份」随时恢复。
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { showToast } from 'vant'
import type { DataDoc } from '@/types'
import * as db from '@/db'
import { withTimeout } from '@/utils/async'
import { MediaStoreSaver, canUseMediaStore, textToBase64 } from '@/utils/mediastore'

const UI_KEY = 'jijian:ui:lastAutoBackupAt'
/** 两次自动备份的最小间隔：24 小时 */
const INTERVAL_MS = 24 * 60 * 60 * 1000
/** 自动备份整体超时：超时跳过本次备份，避免原生桥接 Promise 悬挂阻塞保存主流程 */
const BACKUP_TIMEOUT_MS = 8000
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
  const filename = `${FILE_PREFIX}${stamp()}.json`
  const json = JSON.stringify(pkg, null, 2)

  // 首选 MediaStore：Android 10+ 免权限写入 文档/计件自动备份/，文件管理器可见
  // （此前直写 Directory.Documents 在 Android 11+ 无「所有文件访问权限」时必失败，
  //  自动备份从未真正落盘——v1.2.8 修复）
  if (canUseMediaStore()) {
    try {
      const base64 = await textToBase64(json)
      await MediaStoreSaver.saveToDocuments({
        base64,
        filename,
        mimeType: 'application/json',
        subdir: DIR_NAME
      })
      // 滚动清理：MediaStore 侧按创建时间只保留最新 MAX_FILES 份
      await MediaStoreSaver.pruneDir({ subdir: DIR_NAME, prefix: FILE_PREFIX, maxFiles: MAX_FILES })
      return
    } catch {
      /* Android 9 及以下 / 桥接异常：回落到 Filesystem 路径 */
    }
  }

  // 降级：Filesystem 直写公共 Documents（Android 10 及以下授权后可用）
  try {
    await Filesystem.mkdir({ path: DIR_NAME, directory: Directory.Documents, recursive: true })
  } catch {
    /* 目录已存在 */
  }
  await Filesystem.writeFile({
    path: `${DIR_NAME}/${filename}`,
    directory: Directory.Documents,
    data: json,
    encoding: Encoding.UTF8
  })
  // 滚动清理：只保留最新的 MAX_FILES 份
  try {
    const res = await Filesystem.readdir({ path: DIR_NAME, directory: Directory.Documents })
    const files = res.files
      .filter((f) => f.name && f.name.startsWith(FILE_PREFIX) && f.name.endsWith('.json'))
      .map((f) => f.name as string)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    for (const f of files.slice(0, Math.max(0, files.length - MAX_FILES))) {
      await Filesystem.deleteFile({ path: `${DIR_NAME}/${f}`, directory: Directory.Documents })
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

/** 保存文档后调用：满足 24h 间隔即自动导出一份备份；整体 8s 超时兜底，超时跳过并 toast */
export async function maybeAutoBackup(doc: DataDoc): Promise<void> {
  const last = Number(localStorage.getItem(UI_KEY) || 0)
  if (Date.now() - last < INTERVAL_MS) return
  const pkg = await db.buildBackup(doc)
  await withTimeout(
    (async () => {
      if (Capacitor.isNativePlatform()) {
        await writeNative(pkg)
      } else {
        await writeWeb(pkg)
      }
      localStorage.setItem(UI_KEY, String(Date.now()))
    })(),
    BACKUP_TIMEOUT_MS,
    () => {
      showToast('备份超时已跳过')
    }
  )
}

/** 查看最近一次自动备份时间（ms），未备份过返回 0 */
export function lastAutoBackupAt(): number {
  return Number(localStorage.getItem(UI_KEY) || 0)
}
