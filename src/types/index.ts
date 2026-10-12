/* ==========================================================================
   领域模型定义
   ========================================================================== */

/** 产品 */
export interface Product {
  id: string
  /** 产品名称 */
  name: string
  /** 规格型号，如 "M8×20" */
  spec: string
  /** 备注 */
  note: string
  createdAt: number
  updatedAt: number
}

/** 工序（挂在产品下，含单件工价） */
export interface Process {
  id: string
  /** 所属产品 id */
  productId: string
  /** 工序名称，如 "钻孔" */
  name: string
  /** 单件工价（元） */
  price: number
  /** 备注 */
  note: string
  /** 是否启用（停用后不出现在录入快捷区） */
  active: boolean
  /** 首页快捷排序，越小越靠前 */
  sort: number
  createdAt: number
  updatedAt: number
}

/** 班次 */
export type Shift = 'day' | 'night'

/** 计件记录 */
export interface PieceRecord {
  id: string
  /** 生产日期 YYYY-MM-DD */
  date: string
  productId: string
  /** 工序 ID；工序三态下可为空字符串（手动输入/不填工序时留空） */
  processId: string
  /** 工序名称快照（工序三态）：选已有→工序名；手动输入→自定义名；不填/空→空字符串 */
  processNameSnapshot?: string
  /** 数量 */
  quantity: number
  /** 单价快照（元/件） */
  price: number
  /** 金额 = quantity × price，四舍五入到分 */
  amount: number
  /** 工人姓名 */
  worker: string
  shift: Shift
  note: string
  /** 次数模式：auto=自动实时计算（不落库）；manual=手动输入 */
  countMode: 'auto' | 'manual'
  /** 手动模式下的次数值；自动模式不落库 */
  count?: number
  createdAt: number
  updatedAt: number
}

/** 工人 */
export interface Worker {
  name: string
  createdAt: number
}

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/** 应用设置 */
export interface AppSettings {
  /** 默认工人，录入时自动带入 */
  defaultWorker: string
  /** 日目标金额，用于首页进度条；0 表示不启用 */
  dailyGoal: number
  /** 月目标金额；0 表示不启用 */
  monthlyGoal: number
  /** 主题 */
  theme: ThemeMode
  /** 表单是否记住上次选择的产品/工序 */
  rememberLast: boolean
  /** 首页概览时间范围 */
  homeRange: 'today' | 'week' | 'month'
  /** 最近一次使用的产品/工序（rememberLast 开启时记忆） */
  lastProductId: string
  lastProcessId: string
}

/** 导出备份包 */
export interface BackupPackage {
  app: 'jijian-pwa'
  version: number
  exportedAt: number
  data: {
    records: PieceRecord[]
    products: Product[]
    processes: Process[]
    workers: Worker[]
    settings: AppSettings
  }
}

/** 记录展示用的聚合行（记录 + 冗余名称，避免列表渲染反复查表） */
export interface RecordRow extends PieceRecord {
  productName: string
  processName: string
}

/** 按维度汇总的一行 */
export interface SummaryRow {
  key: string
  label: string
  sub?: string
  quantity: number
  amount: number
  /** 次数/笔数：手动模式=累加 count（每行 1 次，即件数）；自动模式=记录条数（一条记录=1 笔） */
  times: number
}

/** 时间范围 */
export interface DateRange {
  start: string
  end: string
}

/* ==========================================================================
   单文档数据模型（数据层主存储）
   ========================================================================== */

/** 单文档 v1 结构：全量状态序列化为一个 JSON 键 */
export interface DataDocV1 {
  /** 结构版本，由迁移链管理 */
  schemaVersion: 1
  /** 最近一次保存时间（ms） */
  savedAt: number
  records: PieceRecord[]
  products: Product[]
  processes: Process[]
  workers: Worker[]
  settings: AppSettings
}

/** 单文档 v2 结构：记录新增 countMode / count（次数功能），其余与 v1 一致 */
export interface DataDocV2 {
  /** 结构版本，由迁移链管理 */
  schemaVersion: 2
  /** 最近一次保存时间（ms） */
  savedAt: number
  records: PieceRecord[]
  products: Product[]
  processes: Process[]
  workers: Worker[]
  settings: AppSettings
}

/** 单文档 v3 结构：记录新增 processNameSnapshot（工序名称快照，工序三态），其余与 v2 一致 */
export interface DataDocV3 {
  /** 结构版本，由迁移链管理 */
  schemaVersion: 3
  /** 最近一次保存时间（ms） */
  savedAt: number
  records: PieceRecord[]
  products: Product[]
  processes: Process[]
  workers: Worker[]
  settings: AppSettings
}

/** 当前文档类型；未来版本通过联合类型扩展（DataDoc = DataDocV1 | DataDocV2 | DataDocV3 ...） */
export type DataDoc = DataDocV1 | DataDocV2 | DataDocV3
