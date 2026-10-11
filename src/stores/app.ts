import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AppSettings, BackupPackage, DataDoc, PieceRecord, Process, Product, Worker } from '@/types'
import * as db from '@/db'
import { maybeAutoBackup } from '@/utils/autobackup'
import { round, toNum, uid } from '@/utils/format'
import { todayStr, weekRange, currentMonthRange } from '@/utils/date'
import { withTimeout } from '@/utils/async'
import { confirmAction } from '@/utils/dialog'

/** 冷启动初始化兜底超时（毫秒）：超时基于空文档+内存态继续，ready 强制置 true */
const INIT_TIMEOUT_MS = 10000

/** 新增/编辑记录时的输入结构 */
export interface RecordInput {
  date: string
  productId: string
  /** 工序 ID；工序三态下可为空字符串（手动输入/不填工序时留空） */
  processId: string
  /** 可选：工序名称快照（工序三态），选已有→工序名；手动输入→自定义名；不填/空→空字符串 */
  processNameSnapshot?: string
  quantity: number
  price: number
  worker: string
  shift: 'day' | 'night'
  note: string
  /** 可选：金额覆盖（批量导入时三位小数原样存储；缺省按 数量×单价 重算两位） */
  amount?: number
  /** 可选：次数模式，缺省按 auto 处理 */
  countMode?: 'auto' | 'manual'
  /** 可选：手动模式下的次数值；自动模式不传 */
  count?: number
}

/** 批量导入单行（来自文本/OCR 解析草稿） */
export interface BulkRow {
  date: string
  productName: string
  processName: string
  quantity: number
  price: number
  worker: string
  shift: 'day' | 'night'
  note: string
  /** 可选：金额覆盖 */
  amount?: number
  /** 可选：次数模式，缺省按 auto 处理 */
  countMode?: 'auto' | 'manual'
  /** 可选：手动模式下的次数值；自动模式不传 */
  count?: number
  /** 原始行文本，失败时用于回显 */
  raw?: string
}

export const useAppStore = defineStore('app', () => {
  /* ----------------------------- 状态 ----------------------------- */
  const ready = ref(false)
  const loadError = ref('')

  const records = ref<PieceRecord[]>([])
  const products = ref<Product[]>([])
  const processes = ref<Process[]>([])
  const workers = ref<Worker[]>([])
  const settings = ref<AppSettings>({ ...db.DEFAULT_SETTINGS })

  /** 数据层单文档缓存：所有变更先改内存，再由 persist() 全量落盘 */
  let docCache: DataDoc | null = null

  /* ----------------------------- 初始化 ----------------------------- */
  async function init(force = false): Promise<void> {
    if (ready.value && !force) return
    try {
      // 冷启动兜底：loadDoc 最多等待 10s，超时基于空文档 + 内存态继续，ready 强制置 true
      const doc = await withTimeout(db.loadDoc(), INIT_TIMEOUT_MS, () => db.emptyDoc())
      docCache = doc
      records.value = doc.records
      products.value = doc.products
      processes.value = doc.processes
      workers.value = doc.workers
      settings.value = doc.settings
      ready.value = true
      loadError.value = ''
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
      ready.value = true
    }
  }

  /** 全量持久化：内存态 -> 单文档 -> 落盘（落盘后触发自动备份钩子） */
  async function persist(): Promise<void> {
    if (!docCache) {
      // 防御：初始化未成功（如 IndexedDB 读取异常）时基于当前内存态重建文档，
      // 避免 docCache 为空导致静默跳过落盘、退出应用后数据全部丢失。
      docCache = db.emptyDoc()
    }
    // 「记录数突降」保护：当前内存态记录数较上次落盘突降 ≥50% 时弹确认，
    // 防止误清空/异常覆盖导致用户数据大面积丢失（if (!docCache) 兜底只能缓解空文档场景）
    const prevCount = docCache.records.length
    const nextCount = records.value.length
    if (prevCount > 0 && nextCount > 0 && nextCount < prevCount * 0.5) {
      const confirmed = await confirmAction({
        title: '数据异常减少',
        message: `当前记录数（${nextCount}）较上次保存（${prevCount}）减少超过 50%，确认仍要保存吗？`,
        confirmButtonText: '仍要保存',
        confirmButtonColor: '#EE0A24'
      })
      if (!confirmed) throw new Error('已取消保存：记录数异常减少')
    }
    docCache.records = records.value
    docCache.products = products.value
    docCache.processes = processes.value
    docCache.workers = workers.value
    docCache.settings = settings.value
    await db.saveDoc(docCache)
  }

  /* ----------------------------- 计算属性 ----------------------------- */
  const productMap = computed(() => {
    const m = new Map<string, Product>()
    products.value.forEach((p) => m.set(p.id, p))
    return m
  })

  const processMap = computed(() => {
    const m = new Map<string, Process>()
    processes.value.forEach((p) => m.set(p.id, p))
    return m
  })

  /** 全部记录，按日期倒序、创建时间倒序 */
  const recordsDesc = computed(() =>
    [...records.value].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      return b.createdAt - a.createdAt
    })
  )

  /** 工人候选（设置里的默认工人 + 历史使用过的） */
  const workerOptions = computed(() => {
    const set = new Set<string>()
    workers.value.forEach((w) => w.name && set.add(w.name))
    records.value.forEach((r) => r.worker && set.add(r.worker))
    if (settings.value.defaultWorker) set.add(settings.value.defaultWorker)
    return Array.from(set).sort()
  })

  const productName = (id: string): string => productMap.value.get(id)?.name || '已删除产品'
  const processName = (id: string): string => processMap.value.get(id)?.name || '已删除工序'

  const recordsOfDate = (date: string) => records.value.filter((r) => r.date === date)

  const todayRecords = computed(() => recordsOfDate(todayStr()))

  /* ----------------------------- 记录操作 ----------------------------- */
  const calcAmount = (quantity: number, price: number) =>
    round((Number(quantity) || 0) * (Number(price) || 0), 2)

  /**
   * 「再记一笔」预填单点方法（A13）：基于已有记录生成新的 RecordInput。
   * 手动次数预填 (count ?? 0) + 1 等计算集中到 store 层，与 addRecord 内
   * round/toNum 归一化路径保持一致，视图层不再自行散落预填逻辑。
   */
  function buildRepeatInput(rec: PieceRecord): RecordInput {
    const manual = rec.countMode === 'manual'
    return {
      date: todayStr(),
      productId: rec.productId,
      processId: rec.processId,
      processNameSnapshot: rec.processNameSnapshot,
      quantity: rec.quantity,
      price: round(processMap.value.get(rec.processId)?.price ?? rec.price, 4),
      worker: rec.worker,
      shift: rec.shift,
      note: '',
      countMode: manual ? 'manual' : 'auto',
      count: manual ? (rec.count ?? 0) + 1 : undefined
    }
  }

  async function addRecord(input: RecordInput): Promise<PieceRecord> {
    const now = Date.now()
    const rec: PieceRecord = {
      id: uid('r'),
      date: input.date,
      productId: input.productId,
      processId: input.processId,
      quantity: round(input.quantity, 2),
      price: round(input.price, 4),
      amount: input.amount !== undefined ? round(input.amount, 3) : calcAmount(input.quantity, input.price),
      worker: input.worker || '',
      shift: input.shift,
      note: input.note || '',
      countMode: input.countMode === 'manual' ? 'manual' : 'auto',
      count: input.countMode === 'manual' ? Math.max(0, Math.round(toNum(input.count) || 0)) : undefined,
      createdAt: now,
      updatedAt: now
    }
    records.value.push(rec)
    // 联动更新先改内存态，最后只 persist 一次（原实现触发最多 3 次全量落盘）
    if (settings.value.rememberLast) {
      settings.value = { ...settings.value, lastProductId: rec.productId, lastProcessId: rec.processId }
    }
    if (rec.worker && !workers.value.some((w) => w.name === rec.worker)) {
      workers.value.push({ name: rec.worker, createdAt: Date.now() })
    }
    await persist()
    return rec
  }

  async function updateRecord(id: string, input: RecordInput): Promise<void> {
    const rec = records.value.find((r) => r.id === id)
    if (!rec) return
    const countMode: 'auto' | 'manual' = input.countMode === 'manual' ? 'manual' : 'auto'
    const next: PieceRecord = {
      ...rec,
      date: input.date,
      productId: input.productId,
      processId: input.processId,
      processNameSnapshot: input.processNameSnapshot,
      quantity: round(input.quantity, 2),
      price: round(input.price, 4),
      amount: input.amount !== undefined ? round(input.amount, 3) : calcAmount(input.quantity, input.price),
      worker: input.worker || '',
      shift: input.shift,
      note: input.note || '',
      countMode,
      count: countMode === 'manual' ? Math.max(0, Math.round(toNum(input.count) || 0)) : undefined,
      updatedAt: Date.now()
    }
    const idx = records.value.findIndex((r) => r.id === id)
    records.value.splice(idx, 1, next)
    await persist()
    if (next.worker && !workers.value.some((w) => w.name === next.worker)) {
      await addWorker(next.worker)
    }
  }

  async function removeRecord(id: string): Promise<void> {
    records.value = records.value.filter((r) => r.id !== id)
    await persist()
  }

  async function removeRecords(ids: string[]): Promise<void> {
    const set = new Set(ids)
    records.value = records.value.filter((r) => !set.has(r.id))
    await persist()
  }

  /**
   * 批量导入：逐条容错地构建内存数据（产品/工序自动建，缺失字段兜底），
   * 全部变更完成后只做一次全量持久化，避免逐条 await persist() 在 WebView 中
   * 连续全量写 IndexedDB 中断导致"只导入部分、后续全部丢失"。
   * 单条构建失败不中断整体，失败明细随结果返回。
   */
  async function bulkImport(
    rows: BulkRow[]
  ): Promise<{ ok: number; failed: Array<{ row: string; reason: string }> }> {
    const failed: Array<{ row: string; reason: string }> = []
    let ok = 0
    let lastProductId = ''
    let lastProcessId = ''
    const newWorkers = new Set<string>()

    for (const input of rows) {
      try {
        const code = input.productName.trim()
        let product = products.value.find((p) => p.name === code)
        if (!product) {
          product = {
            id: uid('p'),
            name: code,
            spec: '',
            note: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          products.value.push(product)
        }
        const pname = input.processName.trim() || '未分类'
        let process = processes.value.find((o) => o.productId === product.id && o.name === pname)
        if (!process) {
          process = {
            id: uid('o'),
            productId: product.id,
            name: pname,
            price: round(input.price, 4),
            note: '',
            active: true,
            sort: processesOfProduct(product.id).length,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          processes.value.push(process)
        }
        const now = Date.now()
        const countMode: 'auto' | 'manual' = input.countMode === 'manual' ? 'manual' : 'auto'
        records.value.push({
          id: uid('r'),
          date: input.date.trim(),
          productId: product.id,
          processId: process.id,
          processNameSnapshot: process.name,
          quantity: round(input.quantity, 2),
          price: round(input.price, 4),
          amount: input.amount !== undefined ? round(input.amount, 3) : calcAmount(input.quantity, input.price),
          worker: (input.worker || '').trim(),
          shift: input.shift,
          note: input.note || '',
          countMode,
          count: countMode === 'manual' ? Math.max(0, Math.round(toNum(input.count) || 0)) : undefined,
          createdAt: now,
          updatedAt: now
        })
        lastProductId = product.id
        lastProcessId = process.id
        const w = (input.worker || '').trim()
        if (w) newWorkers.add(w)
        ok++
      } catch (e) {
        failed.push({
          row: input.raw || `${input.date.trim()} ${input.productName.trim()}`,
          reason: e instanceof Error ? e.message : String(e)
        })
      }
    }

    for (const name of newWorkers) {
      if (!workers.value.some((w) => w.name === name)) {
        workers.value.push({ name, createdAt: Date.now() })
      }
    }
    if (settings.value.rememberLast && lastProductId) {
      settings.value = { ...settings.value, lastProductId, lastProcessId }
    }

    await persist()
    return { ok, failed }
  }

  /* ----------------------------- 产品操作 ----------------------------- */
  async function addProduct(data: { name: string; spec?: string; note?: string }): Promise<Product> {
    const now = Date.now()
    const item: Product = {
      id: uid('p'),
      name: data.name.trim(),
      spec: (data.spec || '').trim(),
      note: (data.note || '').trim(),
      createdAt: now,
      updatedAt: now
    }
    products.value.push(item)
    await persist()
    return item
  }

  async function updateProduct(
    id: string,
    patch: Partial<Pick<Product, 'name' | 'spec' | 'note'>>
  ): Promise<void> {
    const item = products.value.find((p) => p.id === id)
    if (!item) return
    const next: Product = { ...item, ...patch, updatedAt: Date.now() }
    products.value.splice(products.value.findIndex((p) => p.id === id), 1, next)
    await persist()
  }

  /** 删除产品；若存在关联记录且未强制，则返回记录数由调用方二次确认 */
  async function removeProduct(id: string, force = false): Promise<{ recordCount: number }> {
    const recordCount = records.value.filter((r) => r.productId === id).length
    if (recordCount > 0 && !force) return { recordCount }
    products.value = products.value.filter((p) => p.id !== id)
    processes.value = processes.value.filter((p) => p.productId !== id)
    await persist()
    return { recordCount }
  }

  /* ----------------------------- 工序操作 ----------------------------- */
  const processesOfProduct = (productId: string) =>
    processes.value
      .filter((p) => p.productId === productId)
      .sort((a, b) => a.sort - b.sort || a.createdAt - b.createdAt)

  /** 首页快捷工序：启用状态的工序，按 sort 排 */
  const quickProcesses = computed(() =>
    [...processes.value]
      .filter((p) => p.active)
      .sort((a, b) => a.sort - b.sort || a.createdAt - b.createdAt)
  )

  async function addProcess(data: {
    productId: string
    name: string
    price: number
    note?: string
    active?: boolean
  }): Promise<Process> {
    const now = Date.now()
    const sameProduct = processesOfProduct(data.productId)
    const item: Process = {
      id: uid('o'),
      productId: data.productId,
      name: data.name.trim(),
      price: round(data.price, 4),
      note: (data.note || '').trim(),
      active: data.active !== false,
      sort: sameProduct.length,
      createdAt: now,
      updatedAt: now
    }
    processes.value.push(item)
    await persist()
    return item
  }

  async function updateProcess(
    id: string,
    patch: Partial<Pick<Process, 'name' | 'price' | 'note' | 'active' | 'sort' | 'productId'>>
  ): Promise<void> {
    const item = processes.value.find((p) => p.id === id)
    if (!item) return
    const next: Process = { ...item, ...patch, updatedAt: Date.now() }
    if (patch.price !== undefined) next.price = round(patch.price, 4)
    processes.value.splice(processes.value.findIndex((p) => p.id === id), 1, next)
    await persist()
  }

  async function removeProcess(id: string, force = false): Promise<{ recordCount: number }> {
    const recordCount = records.value.filter((r) => r.processId === id).length
    if (recordCount > 0 && !force) return { recordCount }
    processes.value = processes.value.filter((p) => p.id !== id)
    await persist()
    return { recordCount }
  }

  /** 调整工序排序 */
  async function moveProcess(id: string, dir: -1 | 1): Promise<void> {
    const item = processes.value.find((p) => p.id === id)
    if (!item) return
    const list = processesOfProduct(item.productId)
    const idx = list.findIndex((p) => p.id === id)
    const target = list[idx + dir]
    if (!target) return
    const a = item.sort
    const b = target.sort
    // 直接改内存态两道 sort 字段，只 persist 一次（原实现两次 updateProcess 各自全量落盘）
    item.sort = b
    item.updatedAt = Date.now()
    target.sort = a
    target.updatedAt = Date.now()
    await persist()
  }

  /* ----------------------------- 工人操作 ----------------------------- */
  async function addWorker(name: string): Promise<void> {
    const n = name.trim()
    if (!n || workers.value.some((w) => w.name === n)) return
    const item: Worker = { name: n, createdAt: Date.now() }
    workers.value.push(item)
    await persist()
  }

  async function removeWorker(name: string): Promise<void> {
    workers.value = workers.value.filter((w) => w.name !== name)
    await persist()
  }

  /* ----------------------------- 设置与数据 ----------------------------- */
  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    settings.value = { ...settings.value, ...patch }
    await persist()
  }

  async function exportBackup(): Promise<BackupPackage> {
    if (!docCache) {
      await init()
    }
    return db.buildBackup(docCache!)
  }

  async function importBackup(pkg: BackupPackage): Promise<void> {
    const doc = await db.restoreBackup(pkg)
    docCache = doc
    records.value = doc.records
    products.value = doc.products
    processes.value = doc.processes
    workers.value = doc.workers
    settings.value = doc.settings
    ready.value = true
  }

  async function resetAll(): Promise<void> {
    await db.clearAllData()
    docCache = db.emptyDoc()
    records.value = []
    products.value = []
    processes.value = []
    workers.value = []
  }

  /** 载入示例数据（首次体验用，可一键清空） */
  async function loadDemoData(): Promise<void> {
    const demo: Array<{
      product: string
      spec: string
      processes: Array<[string, number]>
      worker: string
    }> = [
      {
        product: '法兰盘',
        spec: 'DN50',
        processes: [
          ['车外圆', 1.2],
          ['钻孔', 0.8],
          ['去毛刺', 0.35]
        ],
        worker: '张伟'
      },
      {
        product: '连接轴',
        spec: 'φ20×120',
        processes: [
          ['粗车', 1.5],
          ['精车', 2.1],
          ['铣键槽', 1.8]
        ],
        worker: '李娜'
      },
      {
        product: '支架',
        spec: 'A2 型',
        processes: [
          ['下料', 0.4],
          ['折弯', 1.1],
          ['焊接', 2.6],
          ['打磨', 0.9]
        ],
        worker: '王强'
      }
    ]

    const now = Date.now()
    const created: Array<{ pid: string; oids: Array<{ id: string; price: number }>; worker: string }> = []
    for (const d of demo) {
      // 直接构建内存态产品/工序/工人，避免逐个 await addProduct/addProcess 触发多次 persist
      const pid = uid('p')
      products.value.push({
        id: pid,
        name: d.product,
        spec: d.spec,
        note: '',
        createdAt: now,
        updatedAt: now
      })
      const oids: Array<{ id: string; price: number }> = []
      d.processes.forEach(([pn, price], i) => {
        const oid = uid('o')
        processes.value.push({
          id: oid,
          productId: pid,
          name: pn,
          price: round(price, 4),
          note: '',
          active: true,
          sort: i,
          createdAt: now,
          updatedAt: now
        })
        oids.push({ id: oid, price })
      })
      created.push({ pid, oids, worker: d.worker })
      if (!workers.value.some((w) => w.name === d.worker)) {
        workers.value.push({ name: d.worker, createdAt: now })
      }
    }

    // 生成最近 12 天的记录：直接构建内存态，最后只 persist 一次（原实现 44 次 await persist）
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
      const perDay = 2 + (i % 3)
      for (let k = 0; k < perDay; k++) {
        const c = created[(i + k) % created.length]
        const o = c.oids[(i + k) % c.oids.length]
        const qty = 20 + ((i * 7 + k * 13) % 60)
        const createdAt = Date.now()
        records.value.push({
          id: uid('r'),
          date: ds,
          productId: c.pid,
          processId: o.id,
          processNameSnapshot: '',
          quantity: round(qty, 2),
          price: round(o.price, 4),
          amount: calcAmount(qty, o.price),
          worker: c.worker,
          shift: (i + k) % 4 === 0 ? 'night' : 'day',
          note: '',
          countMode: 'auto',
          createdAt,
          updatedAt: createdAt
        })
      }
    }
    settings.value = { ...settings.value, defaultWorker: '张伟' }
    await persist()
  }

  /* ----------------------------- 常用查询 ----------------------------- */
  /** 当前文档快照（内存态实时汇总，供存储用量估算/导出等场景使用） */
  const doc = computed<DataDoc>(() => ({
    schemaVersion: db.SCHEMA_VERSION,
    savedAt: docCache?.savedAt ?? 0,
    records: records.value,
    products: products.value,
    processes: processes.value,
    workers: workers.value,
    settings: settings.value
  }))

  const recordsInRange = (start: string, end: string) =>
    records.value.filter((r) => r.date >= start && r.date <= end)

  const recordsInMonth = (ym: string) => {
    const { start, end } = currentMonthRangeOf(ym)
    return recordsInRange(start, end)
  }

  const recordsInWeek = (date: string) => {
    const { start, end } = weekRange(date)
    return recordsInRange(start, end)
  }

  return {
    // state
    ready,
    loadError,
    records,
    products,
    processes,
    workers,
    settings,
    // getters
    productMap,
    processMap,
    recordsDesc,
    workerOptions,
    todayRecords,
    quickProcesses,
    doc,
    // helpers
    productName,
    processName,
    processesOfProduct,
    recordsOfDate,
    recordsInRange,
    recordsInMonth,
    recordsInWeek,
    calcAmount,
    buildRepeatInput,
    // actions
    init,
    addRecord,
    bulkImport,
    updateRecord,
    removeRecord,
    removeRecords,
    addProduct,
    updateProduct,
    removeProduct,
    addProcess,
    updateProcess,
    removeProcess,
    moveProcess,
    addWorker,
    removeWorker,
    updateSettings,
    exportBackup,
    importBackup,
    resetAll,
    loadDemoData
  }
})

/** 注册自动备份钩子：数据落盘后由 db 层触发（间隔 24h 自动导出） */
db.setAutoBackupHook((doc) => maybeAutoBackup(doc))

/** 内部：按月份键取范围（避免循环引用，单独实现） */
function currentMonthRangeOf(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map((v) => parseInt(v, 10))
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  const last = new Date(y, m, 0).getDate()
  return { start: `${ym}-01`, end: `${y}-${pad(m)}-${pad(last)}` }
}
