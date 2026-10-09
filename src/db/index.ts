/**
 * 本地持久层：localForage（IndexedDB 优先，降级 localStorage/WebSQL）
 * 全部数据保存在用户设备本地，不上传任何服务器。
 */
import localforage from 'localforage'
import type { AppSettings, BackupPackage, PieceRecord, Process, Product, Worker } from '@/types'

const DB_NAME = 'jijian-pwa'
const DB_VERSION = 1

const make = (storeName: string) =>
  localforage.createInstance({
    name: DB_NAME,
    storeName,
    description: '计件工资记账本地数据'
  })

export type LocalStore = ReturnType<typeof make>

export const stores = {
  records: make('records'),
  products: make('products'),
  processes: make('processes'),
  workers: make('workers'),
  meta: make('meta')
}

/** 导出/导入时使用的 key 分隔方式：直接遍历 store 的 keys */
export async function dumpStore<T extends { id?: string; name?: string }>(
  store: LocalStore
): Promise<T[]> {
  const out: T[] = []
  await store.iterate<T, void>((value) => {
    if (value) out.push(value)
  })
  return out
}

/** 批量写入（覆盖式） */
export async function putMany<T extends { id?: string; name?: string }>(
  store: LocalStore,
  items: T[]
): Promise<void> {
  await Promise.all(
    items.map((it) => {
      const key = keyOf(it)
      return store.setItem(key, it)
    })
  )
}

/** 取得对象的存储键 */
export function keyOf(it: { id?: string; name?: string }): string {
  return (it.id ?? it.name ?? '') as string
}

export async function removeOne(store: LocalStore, key: string): Promise<void> {
  await store.removeItem(key)
}

export async function clearStore(store: LocalStore): Promise<void> {
  await store.clear()
}

/* ------------------------------ 设置项 ------------------------------ */

const SETTINGS_KEY = 'app-settings'

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

export async function loadSettings(): Promise<AppSettings> {
  const saved = await stores.meta.getItem<Partial<AppSettings>>(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(saved || {}) }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await stores.meta.setItem(SETTINGS_KEY, s)
}

/* ------------------------------ 备份 ------------------------------ */

export const BACKUP_VERSION = DB_VERSION

export async function buildBackup(settings: AppSettings): Promise<BackupPackage> {
  const [records, products, processes, workers] = await Promise.all([
    dumpStore<PieceRecord>(stores.records),
    dumpStore<Product>(stores.products),
    dumpStore<Process>(stores.processes),
    dumpStore<Worker>(stores.workers)
  ])
  return {
    app: 'jijian-pwa',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: { records, products, processes, workers, settings }
  }
}

export async function restoreBackup(pkg: BackupPackage): Promise<void> {
  const d = pkg?.data
  if (!d) throw new Error('备份文件格式不正确：缺少 data 字段')

  await Promise.all([
    stores.records.clear(),
    stores.products.clear(),
    stores.processes.clear(),
    stores.workers.clear()
  ])

  await Promise.all([
    putMany(stores.records, d.records || []),
    putMany(stores.products, d.products || []),
    putMany(stores.processes, d.processes || []),
    putMany(stores.workers, d.workers || [])
  ])

  if (d.settings) await saveSettings({ ...DEFAULT_SETTINGS, ...d.settings })
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    stores.records.clear(),
    stores.products.clear(),
    stores.processes.clear(),
    stores.workers.clear()
  ])
}
