import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AppSettings, BackupPackage, DataDoc, PieceRecord, Process, Product, Worker } from '@/types'
import * as db from '@/db'
import { maybeAutoBackup } from '@/utils/autobackup'
import { round, uid } from '@/utils/format'
import { todayStr, weekRange, currentMonthRange } from '@/utils/date'

/** 新增/编辑记录时的输入结构 */
export interface RecordInput {
  date: string
  productId: string
  processId: string
  quantity: number
  price: number
  worker: string
  shift: 'day' | 'night'
  note: string
  /** 可选：金额覆盖（批量导入时三位小数原样存储；缺省按 数量×单价 重算两位） */
  amount?: number
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
      const doc = await db.loadDoc()
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
    if (!docCache) return
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
      createdAt: now,
      updatedAt: now
    }
    records.value.push(rec)
    await persist()
    if (settings.value.rememberLast) {
      await updateSettings({ lastProductId: rec.productId, lastProcessId: rec.processId })
    }
    if (rec.worker && !workers.value.some((w) => w.name === rec.worker)) {
      await addWorker(rec.worker)
    }
    return rec
  }

  async function updateRecord(id: string, input: RecordInput): Promise<void> {
    const rec = records.value.find((r) => r.id === id)
    if (!rec) return
    const next: PieceRecord = {
      ...rec,
      date: input.date,
      productId: input.productId,
      processId: input.processId,
      quantity: round(input.quantity, 2),
      price: round(input.price, 4),
      amount: input.amount !== undefined ? round(input.amount, 3) : calcAmount(input.quantity, input.price),
      worker: input.worker || '',
      shift: input.shift,
      note: input.note || '',
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
    await Promise.all([
      updateProcess(item.id, { sort: b }),
      updateProcess(target.id, { sort: a })
    ])
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

    const created: Array<{ pid: string; oids: Array<{ id: string; price: number }>; worker: string }> = []
    for (const d of demo) {
      const p = await addProduct({ name: d.product, spec: d.spec })
      const oids: Array<{ id: string; price: number }> = []
      for (const [pn, price] of d.processes) {
        const o = await addProcess({ productId: p.id, name: pn, price })
        oids.push({ id: o.id, price })
      }
      created.push({ pid: p.id, oids, worker: d.worker })
    }

    // 生成最近 12 天的记录
    const today = todayStr()
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
        await addRecord({
          date: ds,
          productId: c.pid,
          processId: o.id,
          quantity: 20 + ((i * 7 + k * 13) % 60),
          price: o.price,
          worker: c.worker,
          shift: (i + k) % 4 === 0 ? 'night' : 'day',
          note: ''
        })
      }
    }
    await updateSettings({ defaultWorker: '张伟' })
    void today
  }

  /* ----------------------------- 常用查询 ----------------------------- */
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
    // helpers
    productName,
    processName,
    processesOfProduct,
    recordsOfDate,
    recordsInRange,
    recordsInMonth,
    recordsInWeek,
    calcAmount,
    // actions
    init,
    addRecord,
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
