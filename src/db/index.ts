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
import type { AppSettings, BackupPackage, DataDoc } from '@/types'

const DB_NAME = 'jijian-pwa'
const DOC_KEY = 'jijian-doc'

/** 当前文档 schema 版本 */
export const SCHEMA_VERSION = 1

const docStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'jijian-doc',
  description: '计件工资记账主文档'
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
export async function loadDoc(): Promise<DataDoc> {
  const raw = await docStore.getItem<unknown>(DOC_KEY)
  if (raw) return migrateDoc(raw)
  // 首次加载新版本：旧版多 store 数据一次性并入单文档
  const legacy = await collectLegacyData()
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
  await docStore.setItem(DOC_KEY, payload)
}

export async function saveDoc(doc: DataDoc): Promise<void> {
  await saveDocRaw(doc)
  try {
    await autoBackupHook?.(doc)
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
