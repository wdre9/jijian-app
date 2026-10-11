import { describe, expect, it, vi } from 'vitest'

// db/index.ts 顶层会 createInstance(localforage)，node 环境无 localStorage 驱动，
// mock 掉存储层，只验证迁移链纯逻辑（不触发真实 IO）。
vi.mock('localforage', () => {
  const noopStore = () => ({
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    keys: vi.fn(async () => [])
  })
  return {
    __esModule: true,
    default: {
      createInstance: vi.fn(noopStore),
      LOCALSTORAGE: 1,
      INDEXEDDB: 2
    }
  }
})

import { DEFAULT_SETTINGS, MIGRATIONS, migrateDoc, SCHEMA_VERSION } from '@/db'

/**
 * A28 单元测试（二）：文档迁移链。
 * 覆盖 v1→v2→v3 逐级升级、字段兜底（countMode / processNameSnapshot / settings）、
 * 非法版本与缺失迁移步骤的报错路径，防止旧备份导入后结构错位。
 */
describe('文档迁移链', () => {
  it('当前 schema 版本为 3', () => {
    expect(SCHEMA_VERSION).toBe(3)
  })

  it('v2 迁移：旧记录补 countMode=auto，已有值不覆盖', () => {
    const v1 = { schemaVersion: 1, records: [{ id: 'r1', date: '2026-01-01' }] }
    const v2 = MIGRATIONS[2](v1 as unknown as Record<string, unknown>)
    expect(v2.records[0]).toMatchObject({ id: 'r1', countMode: 'auto' })

    const v1b = { schemaVersion: 1, records: [{ id: 'r1', countMode: 'manual', count: 3 }] }
    const v2b = MIGRATIONS[2](v1b as unknown as Record<string, unknown>)
    expect(v2b.records[0]).toMatchObject({ id: 'r1', countMode: 'manual', count: 3 })
  })

  it('v3 迁移：记录补 processNameSnapshot 空串', () => {
    const v2 = { schemaVersion: 2, records: [{ id: 'r1', date: '2026-01-01' }] }
    const v3 = MIGRATIONS[3](v2 as unknown as Record<string, unknown>)
    expect(v3.records[0]).toMatchObject({ id: 'r1', processNameSnapshot: '' })
  })

  it('v3 迁移：settings 与默认值合并（已有字段保留，缺失字段兜底）', () => {
    const v2 = { schemaVersion: 2, records: [], settings: { defaultWorker: '张三' } }
    const v3 = MIGRATIONS[3](v2 as unknown as Record<string, unknown>)
    const s = v3.settings as Record<string, unknown>
    expect(s.defaultWorker).toBe('张三')
    expect(s.dailyGoal).toBe(DEFAULT_SETTINGS.dailyGoal)
    expect(s.monthlyGoal).toBe(DEFAULT_SETTINGS.monthlyGoal)
  })

  it('v3 迁移：settings 为 null/非对象时整体兜底默认值', () => {
    const v2a = { schemaVersion: 2, records: [], settings: null }
    const v3a = MIGRATIONS[3](v2a as unknown as Record<string, unknown>)
    expect(v3a.settings).toMatchObject(DEFAULT_SETTINGS)

    const v2b = { schemaVersion: 2, records: [], settings: 'oops' }
    const v3b = MIGRATIONS[3](v2b as unknown as Record<string, unknown>)
    expect(v3b.settings).toMatchObject(DEFAULT_SETTINGS)
  })

  it('migrateDoc 从 v1 逐级升级到当前版本并保留数据', () => {
    const raw = {
      schemaVersion: 1,
      savedAt: 123,
      records: [{ id: 'r1', date: '2026-01-01' }],
      products: [],
      processes: [],
      workers: [],
      settings: { defaultWorker: '李四' }
    }
    const doc = migrateDoc(raw)
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION)
    expect(doc.savedAt).toBe(123)
    expect(doc.records).toHaveLength(1)
    expect(doc.records[0]).toMatchObject({ id: 'r1', countMode: 'auto', processNameSnapshot: '' })
    expect(doc.settings.defaultWorker).toBe('李四')
    expect(doc.settings.dailyGoal).toBe(DEFAULT_SETTINGS.dailyGoal)
  })

  it('migrateDoc 空文档与非法输入抛错', () => {
    expect(() => migrateDoc(null)).toThrow('文档格式不正确')
    expect(() => migrateDoc('x')).toThrow('文档格式不正确')
    expect(() => migrateDoc(42)).toThrow('文档格式不正确')
  })

  it('migrateDoc 非法版本抛错', () => {
    expect(() => migrateDoc({ schemaVersion: 99, records: [] })).toThrow('不支持的文档版本')
    expect(() => migrateDoc({ schemaVersion: -1, records: [] })).toThrow('不支持的文档版本')
  })

  it('migrateDoc 缺失迁移步骤抛错（v0 无 v1 步骤）', () => {
    expect(() => migrateDoc({ schemaVersion: 0, records: [] })).toThrow('缺少迁移步骤')
  })
})
