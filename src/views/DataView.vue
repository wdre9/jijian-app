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
        <div class="fs-12 text-3 mt-8">数据存储于本机浏览器（IndexedDB），关闭网页不丢失。</div>
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
          <van-button type="primary" block round size="small" @click="exportDetailExcel">
            导出 Excel（.xlsx）
          </van-button>
          <van-button plain block round size="small" @click="exportDetailCsv">
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
        <div class="btns">
          <van-button plain block round size="small" @click="exportSummaryExcel">
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
          <div class="bak__d">
            数据只保存在本机浏览器，清理缓存或站点数据（含存储空间不足时的自动清理）可能一并清除且无法恢复；
            建议每周导出一次，并保存到电脑或网盘。
          </div>
          <div class="bak__more" @click="openInstallGuide">
            查看「添加到主屏幕」与数据备份说明 <van-icon name="arrow" size="11" />
          </div>
        </div>
        <div class="btns">
          <van-button plain block round size="small" @click="exportBackup">导出备份（.json）</van-button>
          <van-button plain block round size="small" @click="pickFile">导入备份（覆盖现有数据）</van-button>
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
          <van-button plain block round size="small" @click="loadDemo">载入演示数据</van-button>
          <van-button plain block round size="small" type="danger" @click="askClear">
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
import { showConfirmDialog, showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import type { BackupPackage } from '@/types'
import { money, moneyShort, qty, round } from '@/utils/format'
import { addDays, currentMonthKey, currentMonthRange, fileStamp, todayStr } from '@/utils/date'
import {
  byDate,
  byProcess,
  byProduct,
  byWorker,
  enrich,
  monthBuckets,
  sumAmount,
  sumQty
} from '@/utils/stats'
import { detailAoa, detailCsv, downloadJson, downloadText, exportWorkbook } from '@/utils/exporter'
import {
  backupStatusText,
  markBackedUp,
  needBackupReminder,
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

function exportDetailExcel() {
  const rows = enrich(
    [...scopeRecords.value].sort((a, b) => (a.date < b.date ? -1 : 1)),
    store.productMap,
    store.processMap
  )
  exportWorkbook(
    [{ name: '计件明细', aoa: detailAoa(rows, (id) => store.productMap.get(id)?.spec || '') }],
    `计件明细_${scopeName()}_${fileStamp()}.xlsx`
  )
  showToast('已导出 Excel')
}

function exportDetailCsv() {
  const rows = enrich(
    [...scopeRecords.value].sort((a, b) => (a.date < b.date ? -1 : 1)),
    store.productMap,
    store.processMap
  )
  downloadText(
    detailCsv(rows, (id) => store.productMap.get(id)?.spec || ''),
    `计件明细_${scopeName()}_${fileStamp()}.csv`
  )
  showToast('已导出 CSV')
}

/* ------------------------- 导出汇总 ------------------------- */
function exportSummaryExcel() {
  const rows = scopeRecords.value
  const stamp = `${scopeName()}_${fileStamp()}`

  const sheets = [
    {
      name: '按产品',
      aoa: [
        [`计件汇总 — 按产品（${scopeName()}）`],
        ['产品', '规格', '数量', '金额(元)', '笔数'],
        ...byProduct(rows, store.productMap).map((r) => [r.label, r.sub || '', r.quantity, r.amount, r.times])
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

  exportWorkbook(sheets, `计件汇总_${stamp}.xlsx`)
  showToast('汇总报表已导出')
}

/* ------------------------- 备份 ------------------------- */
async function exportBackup() {
  const pkg = await store.exportBackup()
  downloadJson(pkg, `计件记账备份_${fileStamp()}.json`)
  markBackedUp()
  showToast('备份已导出')
}

const fileRef = ref<HTMLInputElement | null>(null)

function pickFile() {
  fileRef.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const pkg = JSON.parse(String(reader.result)) as BackupPackage
      if (!pkg || !pkg.data) throw new Error('bad')
      const count = (pkg.data.records || []).length
      showConfirmDialog({
        title: '导入备份',
        message: `将导入 ${count} 条记录及全部产品/工序/工人，并覆盖当前数据。确定继续吗？`,
        confirmButtonText: '导入'
      })
        .then(async () => {
          await store.importBackup(pkg)
          showToast('导入成功')
        })
        .catch(() => {})
    } catch (err) {
      showToast('文件格式不正确，请选择本应用导出的备份文件')
    } finally {
      input.value = ''
    }
  }
  reader.readAsText(file)
}

async function loadDemo() {
  showConfirmDialog({
    title: '载入演示数据',
    message: '将新增 3 个示例产品、10 道工序与最近 12 天的示例记录，不会删除已有数据。确定继续吗？'
  })
    .then(async () => {
      await store.loadDemoData()
      showToast('演示数据已载入')
    })
    .catch(() => {})
}

function askClear() {
  showConfirmDialog({
    title: '清空全部数据',
    message: '将删除全部计件记录、产品、工序与工人，操作不可恢复。确定清空吗？',
    confirmButtonText: '全部清空',
    confirmButtonColor: '#EE0A24'
  })
    .then(async () => {
      await store.resetAll()
      showToast('已清空')
    })
    .catch(() => {})
}

void moneyShort
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
