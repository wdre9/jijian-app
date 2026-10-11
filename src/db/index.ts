/**
 * 本地持久层：单文档 + 版本迁移链 + 自动备份钩子
 *
 * 设计：
 * - 全量状态序列化为一个 JSON 键（jijian-doc），与备份文件格式一致；
 * - schemaVersion 标识结构版本，MIGRATIONS 迁移链负责逐级升级（导入旧备份同样走链）；
 * - 旧版（v1.1.0 及更早）的多 store 数据在首次加载时一次性并入单文档并清空旧 store；
 * - 应用层通过 setAutoBackupHook 注册自动备份钩子，saveDoc 落盘后触发。
 */
import localforage from 'localforage'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { AppSettings, BackupPackage, DataDoc } from '@/types'
import { withTimeout } from '@/utils/async'

/** 主文档读写/自动备份的兜底超时（毫秒），超时按当前内存态继续，防止原生桥接悬挂 */
const IO_TIMEOUT_MS = 8000

const DB_NAME = 'jijian-pwa'
const DOC_KEY = 'jijian-doc'
/** 原生端主文档文件镜像目录与文件名（Documents/jijian-data/jijian-doc.json） */
const FILE_DIR = 'jijian-data'
const FILE_NAME = 'jijian-doc.json'

/** 当前文档 schema 版本 */
export const SCHEMA_VERSION = 1

/**
 * 主存储：强制 localStorage。
 * 背景：Android WebView 中 localforage 默认的 IndexedDB 在 App 退出（进程被杀）
 * 后存在整份文档读不回的丢失问题（写入成功但重启读空）。localStorage 由 WebView
 * 持久化到应用数据目录，覆盖安装保留、卸载删除，退出重进可靠。
 * 旧版 IndexedDB 文档通过 loadDoc 的一次性兜底迁移接入。
 */
const docStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'jijian-doc',
  description: '计件工资记账主文档（localStorage 主存储）',
  driver: localforage.LOCALSTORAGE
})

/** 兼容兜底：旧版 IndexedDB 单文档（仅读取迁移，不再写入） */
const legacyIndexedStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'jijian-doc',
  description: '计件工资记账主文档（旧版 IndexedDB 兜底）',
  driver: localforage.INDEXEDDB
})

export const DEFAULT_SETTINGS: AppSettings = {
  defaultWorker: '',
  dailyGoal: 200,
  monthlyGoal: 5000,
  theme: 'light',
  rememberLast: true,
  homeRange: 'today',
  lastProductId: '',
  lastProcessId: ''
}

export function emptyDoc(): DataDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: 0,
    records: [],
    products: [],
    processes: [],
    workers: [],
    settings: { ...DEFAULT_SETTINGS }
  }
}

/* ============================ 迁移链 ============================ */
/**
 * 逐级迁移：MIGRATIONS[n] 表示把 schemaVersion n-1 的文档升级到 n。
 * 新增字段/结构变化时在此追加一步迁移函数，并同步提升 SCHEMA_VERSION。
 */
export const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 为基线版本，无需迁移步骤
}

/** 把任意来源的原始文档沿迁移链升级到当前版本，并兜底补齐字段 */
export function migrateDoc(raw: unknown): DataDoc {
  if (!raw || typeof raw !== 'object') throw new Error('文档格式不正确')
  const src = raw as Record<string, unknown>
  let v = Number(src.schemaVersion) || 0
  if (v < 0 || v > SCHEMA_VERSION) {
    throw new Error(`不支持的文档版本：${String(src.schemaVersion)}（当前支持最高 v${SCHEMA_VERSION}）`)
  }
  let doc = { ...src }
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v + 1]
    if (!step) throw new Error(`缺少迁移步骤：v${v} -> v${v + 1}`)
    doc = step(doc)
    doc.schemaVersion = v + 1
    v += 1
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Number(doc.savedAt) || 0,
    records: Array.isArray(doc.records) ? doc.records : [],
    products: Array.isArray(doc.products) ? doc.products : [],
    processes: Array.isArray(doc.processes) ? doc.processes : [],
    workers: Array.isArray(doc.workers) ? doc.workers : [],
    settings: { ...DEFAULT_SETTINGS, ...((doc.settings as Partial<AppSettings>) || {}) }
  }
}

/* ==================== 旧多 store 数据一次性迁移 ==================== */
const LEGACY_STORES = ['records', 'products', 'processes', 'workers', 'meta'] as const
const LEGACY_SETTINGS_KEY = 'app-settings'

async function collectLegacyData(): Promise<DataDoc | null> {
  const doc = emptyDoc()
  let hasAny = false
  for (const name of LEGACY_STORES) {
    const store = localforage.createInstance({ name: DB_NAME, storeName: name })
    await store.iterate<unknown, void>((value, key) => {
      if (value == null || typeof value !== 'object') return
      const item = value as Record<string, unknown>
      if (name === 'meta') {
        if (key === LEGACY_SETTINGS_KEY) {
          doc.settings = { ...DEFAULT_SETTINGS, ...(item as Partial<AppSettings>) }
          hasAny = true
        }
        return
      }
      if (Array.isArray(value)) return
      if (name === 'records') doc.records.push(item as never)
      else if (name === 'products') doc.products.push(item as never)
      else if (name === 'processes') doc.processes.push(item as never)
      else if (name === 'workers') doc.workers.push(item as never)
      hasAny = true
    })
  }
  return hasAny ? doc : null
}

async function clearLegacyData(): Promise<void> {
  for (const name of LEGACY_STORES) {
    const store = localforage.createInstance({ name: DB_NAME, storeName: name })
    await store.clear()
  }
}

/* ========================== 主文档读写 ========================== */
/** 原生端文件镜像读取兜底（主存储为空时恢复） */
async function loadDocFromFile(): Promise<DataDoc | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const res = await withTimeout(
      Filesystem.readFile({
        path: `${FILE_DIR}/${FILE_NAME}`,
        directory: Directory.Documents
      }),
      IO_TIMEOUT_MS,
      () => {
        throw new Error('read timeout')
      }
    )
    const raw = JSON.parse(res.data as string)
    if (raw) return migrateDoc(raw)
  } catch {
    /* 文件不存在或损坏 */
  }
  return null
}

export async function loadDoc(): Promise<DataDoc> {
  // 1) 主存储（localStorage，Android WebView 退出重进可靠）；8s 超时兜底，悬挂则继续向下
  const raw = await withTimeout(docStore.getItem<unknown>(DOC_KEY), IO_TIMEOUT_MS, () => undefined)
  if (raw) return migrateDoc(raw)

  // 2) 旧版 IndexedDB 单文档：一次性兜底迁移到主存储
  try {
    const old = await withTimeout(legacyIndexedStore.getItem<unknown>(DOC_KEY), IO_TIMEOUT_MS, () => undefined)
    if (old) {
      const doc = migrateDoc(old)
      await saveDocRaw(doc)
      return doc
    }
  } catch {
    /* IndexedDB 不可用时忽略 */
  }

  // 3) 原生端文件镜像兜底
  const fileDoc = await loadDocFromFile()
  if (fileDoc) return fileDoc

  // 4) 首次加载新版本：旧版多 store 数据一次性并入单文档
  const legacy = await withTimeout(collectLegacyData(), IO_TIMEOUT_MS, () => null)
  if (legacy) {
    const migrated = migrateDoc(legacy)
    await saveDocRaw(migrated)
    await clearLegacyData()
    return migrated
  }
  return emptyDoc()
}

async function saveDocRaw(doc: DataDoc): Promise<void> {
  const payload = { ...doc, savedAt: Date.now() }
  // 主存储写入 8s 超时兜底：悬挂时跳过本次落盘，按当前内存态继续（防主线程挂死）
  await withTimeout(docStore.setItem(DOC_KEY, payload), IO_TIMEOUT_MS, () => undefined)
  // 原生端同步写文件镜像：与主存储互为备份，防止 WebView 存储被系统清理
  if (Capacitor.isNativePlatform()) {
    try {
      await withTimeout(
        (async () => {
          await Filesystem.mkdir({ path: FILE_DIR, directory: Directory.Documents, recursive: true })
          await Filesystem.writeFile({
            path: `${FILE_DIR}/${FILE_NAME}`,
            directory: Directory.Documents,
            data: JSON.stringify(payload),
            encoding: Encoding.UTF8
          })
        })(),
        IO_TIMEOUT_MS,
        () => undefined
      )
    } catch (e) {
      console.warn('[db] 文件镜像写入失败（不影响主存储）', e)
    }
  }
}

export async function saveDoc(doc: DataDoc): Promise<void> {
  await saveDocRaw(doc)
  try {
    // 自动备份钩子 8s 超时兜底：悬挂时跳过本次备份（autobackup 内部亦有超时与 toast）
    await withTimeout(Promise.resolve(autoBackupHook?.(doc)), IO_TIMEOUT_MS, () => undefined)
  } catch (e) {
    console.warn('[db] 自动备份钩子执行失败（不影响主流程）', e)
  }
}

/* ======================= 自动备份钩子注册 ======================= */
type AutoBackupHook = (doc: DataDoc) => void | Promise<void>
let autoBackupHook: AutoBackupHook | null = null

/** 应用层注册自动备份钩子（autobackup 模块，避免循环依赖） */
export function setAutoBackupHook(hook: AutoBackupHook | null): void {
  autoBackupHook = hook
}

/* ============================= 备份 ============================= */
export const BACKUP_VERSION = SCHEMA_VERSION

export async function buildBackup(doc: DataDoc): Promise<BackupPackage> {
  return {
    app: 'jijian-pwa',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: {
      records: doc.records,
      products: doc.products,
      processes: doc.processes,
      workers: doc.workers,
      settings: doc.settings
    }
  }
}

/** 恢复备份：校验 -> 迁移链 -> 落盘，返回迁移后的文档（由调用方更新内存态） */
export async function restoreBackup(pkg: BackupPackage): Promise<DataDoc> {
  const d = pkg?.data
  if (!d) throw new Error('备份文件格式不正确：缺少 data 字段')
  const doc = migrateDoc({
    schemaVersion: Number(pkg.version) || 1,
    records: Array.isArray(d.records) ? d.records : [],
    products: Array.isArray(d.products) ? d.products : [],
    processes: Array.isArray(d.processes) ? d.processes : [],
    workers: Array.isArray(d.workers) ? d.workers : [],
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) }
  })
  await saveDocRaw(doc)
  return doc
}

export async function clearAllData(): Promise<void> {
  await docStore.removeItem(DOC_KEY)
}
