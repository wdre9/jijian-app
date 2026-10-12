<template>
  <div class="page page--plain">
    <van-nav-bar
      title="数据与导出"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <div class="page__inner">
      <!-- 数据概览 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">数据概览</div>
          <van-tag round plain type="primary">{{ rangeText }}</van-tag>
        </div>
        <div class="grid">
          <div class="gitem">
            <div class="gitem__v num">{{ store.records.length }}</div>
            <div class="gitem__l">计件记录</div>
          </div>
          <div class="gitem">
            <div class="gitem__v num">{{ money(amountAll) }}</div>
            <div class="gitem__l">累计金额(元)</div>
          </div>
          <div class="gitem">
            <div class="gitem__v num">{{ qty(qtyAll) }}</div>
            <div class="gitem__l">累计件数</div>
          </div>
          <div class="gitem">
            <div class="gitem__v num">{{ store.products.length }}</div>
            <div class="gitem__l">产品</div>
          </div>
          <div class="gitem">
            <div class="gitem__v num">{{ store.processes.length }}</div>
            <div class="gitem__l">工序</div>
          </div>
          <div class="gitem">
            <div class="gitem__v num">{{ store.workerOptions.length }}</div>
            <div class="gitem__l">工人</div>
          </div>
        </div>
        <div class="fs-12 text-3 mt-8">
          <template v-if="env.nativeApp">数据存储于本机应用内，关闭应用不会丢失；卸载应用前请先导出备份。</template>
          <template v-else>数据存储于本机浏览器本地存储，关闭网页不丢失。</template>
        </div>
        <div v-if="storageUsageText" class="fs-12 mt-8" :style="{ color: storageUsageWarn ? '#e64340' : undefined }">
          {{ storageUsageText }}
        </div>
      </div>

      <!-- 导出明细 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">导出明细</div>
        </div>
        <div class="seg">
          <span
            v-for="o in exportRanges"
            :key="o.value"
            class="seg__item"
            :class="{ 'is-on': exportRange === o.value }"
            @click="exportRange = o.value"
          >
            {{ o.label }}
          </span>
        </div>
        <div class="fs-12 text-3 mt-8">
          当前将导出 {{ scopeRecords.length }} 条记录，合计 ¥{{ money(scopeAmount) }}
        </div>
        <div class="btns">
          <van-button
            type="primary"
            block
            round
            size="small"
            :loading="exportingDetail"
            :disabled="exportingDetail"
            @click="exportDetailExcel"
          >
            导出 Excel（.xlsx）
          </van-button>
          <van-button
            plain
            block
            round
            size="small"
            :loading="exportingDetail"
            :disabled="exportingDetail"
            @click="exportDetailCsv"
          >
            导出 CSV（.csv）
          </van-button>
        </div>
      </div>

      <!-- 导出汇总 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">导出汇总报表</div>
        </div>
        <div class="fs-12 text-3">
          包含：按产品、按工序、按工人、按日期、按月 五张汇总表，适合发给老板核对工价。
        </div>
        <div v-if="lastTip('summary')" class="recent-tip">最近导出：{{ lastTip('summary') }}</div>
        <div class="btns">
          <van-button
            plain
            block
            round
            size="small"
            :loading="exportingSummary"
            :disabled="exportingSummary"
            @click="exportSummaryExcel"
          >
            导出汇总 Excel
          </van-button>
        </div>
      </div>

      <!-- 备份与还原 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">备份与还原</div>
        </div>
        <div class="fs-12 text-3">
          备份文件包含全部记录、产品、工序、工人与设置，换手机时导入即可完整恢复。
        </div>
        <div class="bak" :class="{ 'bak--warn': needBackupReminder }">
          <div class="bak__t">{{ backupText ? '最近备份：' + backupText : '还没有导出过备份' }}</div>
          <div v-if="lastTip('backup')" class="recent-tip">最近备份：{{ lastTip('backup') }}</div>
          <div class="bak__d">
            <template v-if="env.nativeApp">数据只保存在本机应用内，卸载应用会一并清除且无法恢复；建议每周导出一次，并保存到电脑或网盘。</template>
            <template v-else>数据只保存在本机浏览器，清理缓存或站点数据（含存储空间不足时的自动清理）可能一并清除且无法恢复；建议每周导出一次，并保存到电脑或网盘。</template>
          </div>
          <div v-if="!env.nativeApp" class="bak__more" @click="openInstallGuide">
            查看「添加到主屏幕」与数据备份说明 <van-icon name="arrow" size="11" />
          </div>
          <div v-else class="bak__more">备份与还原见下方「导出 / 备份与还原」操作区</div>
        </div>
        <div class="btns">
          <van-button
            plain
            block
            round
            size="small"
            :loading="exportingBackup"
            :disabled="exportingBackup"
            @click="exportBackup"
          >
            导出备份（.json）
          </van-button>
          <van-button
            plain
            block
            round
            size="small"
            :loading="importing"
            :disabled="importing"
            @click="pickFile"
          >
            导入备份（覆盖现有数据）
          </van-button>
        </div>
        <input
          ref="fileRef"
          type="file"
          accept=".json,application/json"
          class="hidden-file"
          @change="onFileChange"
        />
      </div>

      <!-- 演示与清空 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">演示与清空</div>
        </div>
        <div class="btns">
          <van-button
            plain
            block
            round
            size="small"
            :loading="demoLoading"
            :disabled="demoLoading"
            @click="loadDemo"
          >
            载入演示数据
          </van-button>
          <van-button
            plain
            block
            round
            size="small"
            type="danger"
            :loading="clearing"
            :disabled="clearing"
            @click="askClear"
          >
            清空全部数据
          </van-button>
        </div>
        <div class="fs-12 text-3 mt-8">
          清空操作不可恢复，建议先导出备份。载入演示数据会新增示例产品与最近 12 天的记录。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import { confirmAction } from '@/utils/dialog'
import { runGuarded } from '@/utils/async'
import type { BackupPackage } from '@/types'
import { money, qty, round } from '@/utils/format'
import { addDays, currentMonthKey, currentMonthRange, fileStamp, todayStr } from '@/utils/date'
import {
  byDate,
  byProcess,
  byProduct,
  byWorker,
  enrich,
  monthBuckets,
  recordCountLabel,
  sumAmount,
  sumQty
} from '@/utils/stats'
import { detailAoa, detailCsv, downloadJson, downloadText, exportWorkbook } from '@/utils/exporter'
import type { ExportResult } from '@/utils/exporter'
import {
  backupStatusText,
  markBackedUp,
  needBackupReminder,
  env,
  openInstallGuide
} from '@/utils/install'

const router = useRouter()
const store = useAppStore()

type ExportRange = 'all' | 'month' | '90d'

const exportRanges: Array<{ label: string; value: ExportRange }> = [
  { label: '全部', value: 'all' },
  { label: '本月', value: 'month' },
  { label: '近 90 天', value: '90d' }
]
const exportRange = ref<ExportRange>('all')

/** 导出/导入/清空等写操作防重入标志 */
const exportingDetail = ref(false)
const exportingSummary = ref(false)
const exportingBackup = ref(false)
const importing = ref(false)
const demoLoading = ref(false)
const clearing = ref(false)

/** 错误信息转可读文本 */
function failText(err: unknown): string {
  if (err instanceof Error) return err.message || err.name
  return String(err)
}

/** File 读取为文本 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

/** 成功提示（原生端追加保存位置，避免用户找不到文件） */
function successTip(prefix: string, res: ExportResult): string {
  return res.mode === 'native' ? `${prefix}，已保存至 ${res.display}` : prefix
}

/* ------------------------------ 最近导出记录 ------------------------------ */
interface RecentExport {
  kind: 'detail' | 'summary' | 'backup'
  filename: string
  location: string
  at: number
}

const RECENT_KEY = 'jijian:recent-exports'

function readRecentExports(): RecentExport[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as RecentExport[]
    return Array.isArray(arr) ? arr.slice(0, 5) : []
  } catch {
    return []
  }
}

const recentExports = ref<RecentExport[]>(readRecentExports())

function recordExport(kind: RecentExport['kind'], filename: string, location: string): void {
  recentExports.value = [{ kind, filename, location, at: Date.now() }, ...recentExports.value].slice(0, 5)
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recentExports.value))
  } catch {
    /* 忽略：仅界面提示 */
  }
}

/** 某类导出最近一次的人类可读提示，无记录时返回空串 */
function lastTip(kind: RecentExport['kind']): string {
  const item = recentExports.value.find((e) => e.kind === kind)
  if (!item) return ''
  const d = new Date(item.at)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${item.filename} → ${item.location}（今天 ${hh}:${mm}）`
}

/** 最近一次导出备份的时间描述（未备份时为空串） */
const backupText = computed(() => backupStatusText())

onMounted(() => {
  if (!store.ready) store.init()
})

const dateSpan = computed(() => {
  const ds = store.records.map((r) => r.date).sort()
  if (!ds.length) return '暂无数据'
  return `${ds[0]} ~ ${ds[ds.length - 1]}`
})
const rangeText = computed(() => dateSpan.value)

const amountAll = computed(() => sumAmount(store.records))
const qtyAll = computed(() => sumQty(store.records))

/** localStorage 占用估算（键名 + 值长度按 UTF-16 计） */
function localStorageBytes(): number {
  let lsBytes = 0
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (!k) continue
    const v = window.localStorage.getItem(k)
    lsBytes += (k.length + (v ? v.length : 0)) * 2
  }
  return lsBytes
}

/** 本地存储用量估算（浏览器 localStorage 上限约 5MB，接近时引导导出归档） */
const storageUsageText = computed(() => {
  try {
    // 文档 JSON（jijian-pwa/jijian-doc/jijian-doc 键）本身就在 localStorage 中，
    // 直接以 localStorage 总量为准，不再叠加 docBytes，避免重复计算
    const lsBytes = localStorageBytes()
    const kb = (lsBytes / 1024).toFixed(1)
    const limit = 5 * 1024 * 1024
    const pct = Math.round((lsBytes / limit) * 100)
    if (pct >= 50) {
      return `本地数据约 ${kb} KB，已达存储上限约 5MB 的 ${pct}%，建议在下方导出备份并定期归档旧记录`
    }
    return `本地数据约 ${kb} KB（浏览器存储上限约 5MB），建议定期导出备份归档`
  } catch {
    return ''
  }
})
const storageUsageWarn = computed(() => {
  try {
    // 与 storageUsageText 同口径：以 localStorage 总量判断是否接近 5MB 上限
    return localStorageBytes() >= 5 * 1024 * 1024 * 0.5
  } catch {
    return false
  }
})

const scopeRecords = computed(() => {
  if (exportRange.value === 'month') {
    const { start, end } = currentMonthRange()
    return store.records.filter((r) => r.date >= start && r.date <= end)
  }
  if (exportRange.value === '90d') {
    const start = addDays(todayStr(), -89)
    return store.records.filter((r) => r.date >= start)
  }
  return store.records
})
const scopeAmount = computed(() => sumAmount(scopeRecords.value))

/* ------------------------- 导出明细 ------------------------- */
function scopeName(): string {
  if (exportRange.value === 'month') return currentMonthKey()
  if (exportRange.value === '90d') return '近90天'
  return '全部'
}

async function exportDetailExcel() {
  if (exportingDetail.value) return
  exportingDetail.value = true
  try {
    const rows = enrich(
      [...scopeRecords.value].sort((a, b) => (a.date < b.date ? -1 : 1)),
      store.productMap,
      store.processMap
    )
    const filename = `计件明细_${scopeName()}_${fileStamp()}.xlsx`
    const res = await exportWorkbook(
      [{ name: '计件明细', aoa: detailAoa(rows, (id) => store.productMap.get(id)?.spec || '', (r) => recordCountLabel(r, store.records)) }],
      filename
    )
    recordExport('detail', filename, res.mode === 'native' ? res.display : '浏览器下载')
    showToast({ type: 'success', message: successTip('已导出 Excel', res) })
  } catch (err) {
    showToast({ type: 'fail', message: `导出 Excel 失败：${failText(err)}` })
  } finally {
    exportingDetail.value = false
  }
}

async function exportDetailCsv() {
  if (exportingDetail.value) return
  exportingDetail.value = true
  try {
    const rows = enrich(
      [...scopeRecords.value].sort((a, b) => (a.date < b.date ? -1 : 1)),
      store.productMap,
      store.processMap
    )
    const filename = `计件明细_${scopeName()}_${fileStamp()}.csv`
    const res = await downloadText(
      detailCsv(rows, (id) => store.productMap.get(id)?.spec || '', (r) => recordCountLabel(r, store.records)),
      filename
    )
    recordExport('detail', filename, res.mode === 'native' ? res.display : '浏览器下载')
    showToast({ type: 'success', message: successTip('已导出 CSV', res) })
  } catch (err) {
    showToast({ type: 'fail', message: `导出 CSV 失败：${failText(err)}` })
  } finally {
    exportingDetail.value = false
  }
}

/* ------------------------- 导出汇总 ------------------------- */
async function exportSummaryExcel() {
  if (exportingSummary.value) return
  exportingSummary.value = true
  try {
    const rows = scopeRecords.value
    const stamp = `${scopeName()}_${fileStamp()}`

    const sheets = [
      {
        name: '按产品',
        aoa: [
          [`计件汇总 — 按产品（${scopeName()}）`],
          ['产品', '规格', '数量', '金额(元)', '笔数'],
          ...byProduct(rows, store.productMap).map((r) => [
            r.label,
            r.sub || '',
            r.quantity,
            r.amount,
            r.times
          ])
        ]
      },
      {
        name: '按工序',
        aoa: [
          [`计件汇总 — 按工序（${scopeName()}）`],
          ['工序', '所属产品', '数量', '金额(元)', '笔数'],
          ...byProcess(rows, store.processMap, store.productMap).map((r) => [
            r.label,
            r.sub || '',
            r.quantity,
            r.amount,
            r.times
          ])
        ]
      },
      {
        name: '按工人',
        aoa: [
          [`计件汇总 — 按工人（${scopeName()}）`],
          ['工人', '数量', '金额(元)', '笔数'],
          ...byWorker(rows).map((r) => [r.label, r.quantity, r.amount, r.times])
        ]
      },
      {
        name: '按日期',
        aoa: [
          [`计件汇总 — 按日期（${scopeName()}）`],
          ['日期', '数量', '金额(元)', '笔数'],
          ...byDate(rows).map((r) => [r.label, r.quantity, r.amount, r.times])
        ]
      },
      {
        name: '按月',
        aoa: [
          [`计件汇总 — 按月（${scopeName()}）`],
          ['月份', '数量', '金额(元)', '有记录天数'],
          ...Array.from(monthBuckets(rows).entries())
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([k, v]) => [k, round(v.qty, 2), round(v.amount, 2), v.dates.size])
        ]
      }
    ]

    const filename = `计件汇总_${stamp}.xlsx`
    const res = await exportWorkbook(sheets, filename)
    recordExport('summary', filename, res.mode === 'native' ? res.display : '浏览器下载')
    showToast({ type: 'success', message: successTip('汇总报表已导出', res) })
  } catch (err) {
    showToast({ type: 'fail', message: `导出汇总失败：${failText(err)}` })
  } finally {
    exportingSummary.value = false
  }
}

/* ------------------------- 备份 ------------------------- */
async function exportBackup() {
  if (exportingBackup.value) return
  exportingBackup.value = true
  try {
    const pkg = await store.exportBackup()
    const filename = `计件记账备份_${fileStamp()}.json`
    const res = await downloadJson(pkg, filename)
    markBackedUp()
    recordExport('backup', filename, res.mode === 'native' ? res.display : '浏览器下载')
    showToast({ type: 'success', message: successTip('备份已导出', res) })
  } catch (err) {
    showToast({ type: 'fail', message: `导出备份失败：${failText(err)}` })
  } finally {
    exportingBackup.value = false
  }
}

/** 运行时校验备份包结构（JSON 解析 + as 断言不可信，必须逐字段确认类型） */
function isValidBackupPackage(value: unknown): value is BackupPackage {
  if (!value || typeof value !== 'object') return false
  const pkg = value as Record<string, unknown>
  if (pkg.app !== 'jijian-pwa') return false
  if (typeof pkg.version !== 'number' || typeof pkg.exportedAt !== 'number') return false
  const data = pkg.data as Record<string, unknown> | null | undefined
  if (!data || typeof data !== 'object') return false
  return (
    Array.isArray(data.records) &&
    Array.isArray(data.products) &&
    Array.isArray(data.processes) &&
    Array.isArray(data.workers) &&
    !!data.settings &&
    typeof data.settings === 'object'
  )
}

const fileRef = ref<HTMLInputElement | null>(null)

function pickFile() {
  if (importing.value) return
  fileRef.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  await runGuarded(importing, async () => {
    let raw: unknown = null
    try {
      raw = JSON.parse(await readFileAsText(file))
    } catch {
      showToast({ type: 'fail', message: '文件格式不正确，请选择本应用导出的备份文件' })
      return
    }
    if (!isValidBackupPackage(raw)) {
      showToast({ type: 'fail', message: '文件格式不正确，不是本应用导出的备份文件' })
      return
    }
    const pkg: BackupPackage = raw
    const count = (pkg.data.records || []).length
    const confirmed = await confirmAction({
      title: '导入备份',
      message: `将导入 ${count} 条记录及全部产品/工序/工人，并覆盖当前数据。确定继续吗？`,
      confirmButtonText: '导入'
    })
    if (!confirmed) return
    try {
      await store.importBackup(pkg)
      showToast({ type: 'success', message: `导入成功：${count} 条记录及全部基础数据已恢复` })
    } catch (err) {
      showToast({ type: 'fail', message: `导入失败：${failText(err)}` })
    }
  }, { label: '导入' })
}

async function loadDemo() {
  await runGuarded(demoLoading, async () => {
    const confirmed = await confirmAction({
      title: '载入演示数据',
      message: '将新增 3 个示例产品、10 道工序与最近 12 天的示例记录，不会删除已有数据。确定继续吗？'
    })
    if (!confirmed) return
    try {
      await store.loadDemoData()
      showToast({ type: 'success', message: '演示数据已载入' })
    } catch (err) {
      showToast({ type: 'fail', message: `载入演示数据失败：${failText(err)}` })
    }
  }, { label: '载入演示数据' })
}

async function askClear() {
  await runGuarded(clearing, async () => {
    const confirmed = await confirmAction({
      title: '清空全部数据',
      message: '将删除全部计件记录、产品、工序与工人，操作不可恢复。确定清空吗？',
      confirmButtonText: '全部清空',
      confirmButtonColor: '#EE0A24'
    })
    if (!confirmed) return
    try {
      await store.resetAll()
      showToast({ type: 'success', message: '已清空全部数据' })
    } catch (err) {
      showToast({ type: 'fail', message: `清空失败：${failText(err)}` })
    }
  }, { label: '清空' })
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 6px;
}

.gitem {
  text-align: center;
}

.gitem__v {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.gitem__l {
  font-size: 11px;
  color: var(--app-text-3);
  margin-top: 3px;
}

.seg {
  display: flex;
  background: var(--app-card-2);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}

.seg__item {
  flex: 1;
  text-align: center;
  font-size: 13px;
  padding: 7px 0;
  border-radius: 8px;
  color: var(--app-text-2);
}

.seg__item.is-on {
  background: var(--app-card);
  color: var(--app-primary);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.btns {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 12px;
}

.recent-tip {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: var(--app-radius-sm);
  background: rgba(18, 156, 89, 0.08);
  border: 1px solid rgba(18, 156, 89, 0.25);
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-2);
  word-break: break-all;
}

.hidden-file {
  display: none;
}

.bak {
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--app-radius-sm);
  background: var(--app-card-2);
  border: 1px solid var(--app-line);
}

.bak--warn {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.35);
}

.bak__t {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
}

.bak--warn .bak__t {
  color: #ef4444;
}

.bak__d {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--app-text-3);
}

.bak__more {
  margin-top: 8px;
  font-size: 12px;
  color: var(--app-primary);
}
</style>
