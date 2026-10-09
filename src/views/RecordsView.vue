<template>
  <div class="page">
    <div class="page__title">明细</div>

    <!-- ============ 筛选栏 ============ -->
    <div class="filter-bar">
      <div class="search">
        <van-icon name="search" size="15" color="#9CA3AF" />
        <input v-model="filters.keyword" class="search__input" placeholder="搜索产品 / 工序 / 备注" />
        <van-icon
          v-if="filters.keyword"
          name="clear"
          size="15"
          color="#C4C9D4"
          @click="filters.keyword = ''"
        />
      </div>
      <button class="icon-btn" :class="{ 'is-on': activeFilterCount > 0 }" type="button" @click="filterShow = true">
        <van-icon name="filter-o" size="17" />
        <span v-if="activeFilterCount" class="dot-badge">{{ activeFilterCount }}</span>
      </button>
    </div>

    <!-- 快捷时间 -->
    <div class="quick-times">
      <button
        v-for="t in timePresets"
        :key="t.value"
        type="button"
        class="qtime"
        :class="{ 'is-active': filters.range === t.value }"
        @click="setRange(t.value)"
      >
        {{ t.label }}
      </button>
      <button
        v-if="filters.range === 'custom'"
        type="button"
        class="qtime is-active"
      >
        自定义
      </button>
    </div>

    <!-- ============ 汇总 + 操作 ============ -->
    <div class="summary">
      <div>
        <div class="summary__title">
          {{ countText(rows) }}
        </div>
        <div class="summary__amount num">合计 ¥{{ money(total.amount) }}</div>
      </div>
      <div class="summary__ops">
        <button class="icon-btn" type="button" @click="toggleSelect">
          <van-icon :name="selectMode ? 'cross' : 'checked'" size="17" />
        </button>
        <button class="icon-btn" type="button" @click="exportCurrent">
          <van-icon name="down" size="17" />
        </button>
      </div>
    </div>

    <!-- ============ 列表 ============ -->
    <template v-if="groups.length">
      <div v-for="g in groups" :key="g.date" class="group">
        <div class="group-head">
          <span>{{ groupTitle(g.date) }}</span>
          <span class="group-head__amount num">¥{{ money(g.amount) }} · {{ qty(g.quantity) }} 件</span>
        </div>
        <RecordItem
          v-for="r in g.rows"
          :key="r.id"
          :row="r"
          :clickable="!selectMode"
          :selectable="selectMode"
          :selected="selected.includes(r.id)"
          @select="toggleSelectRow(r.id)"
        />
      </div>
    </template>

    <div v-else>
      <EmptyState
        icon="search"
        text="没有符合条件的记录"
        :hint="hasAnyRecord ? '试着放宽筛选条件' : '先去首页记第一笔吧'"
      />
    </div>

    <!-- ============ 多选操作条 ============ -->
    <div v-if="selectMode" class="select-bar">
      <div class="select-bar__info">已选 {{ selected.length }} 条</div>
      <div class="select-bar__actions">
        <van-button size="small" round plain @click="selectAll">全选</van-button>
        <van-button size="small" round plain @click="exportSelected">导出</van-button>
        <van-button size="small" round type="danger" :disabled="!selected.length" @click="batchDelete">
          删除
        </van-button>
      </div>
    </div>

    <!-- ============ 筛选弹层 ============ -->
    <van-popup v-model:show="filterShow" position="bottom" round :style="{ maxHeight: '86vh' }">
      <div class="fsheet">
        <div class="fsheet__head">
          <span class="fsheet__title">筛选</span>
          <van-icon name="cross" size="18" color="#9CA3AF" @click="filterShow = false" />
        </div>
        <div class="fsheet__body">
          <div class="field">
            <div class="field__label">时间范围</div>
            <div class="chips">
              <button
                v-for="t in allRangeOptions"
                :key="t.value"
                type="button"
                class="chip"
                :class="{ 'is-active': filters.range === t.value }"
                @click="setRange(t.value)"
              >
                {{ t.label }}
              </button>
            </div>
            <div v-if="filters.range === 'custom'" class="row mt-8" style="gap: 8px">
              <DatePickButton v-model="filters.start" :max-offset="0" />
              <span class="text-3 fs-12">至</span>
              <DatePickButton v-model="filters.end" :max-offset="0" />
            </div>
          </div>

          <div class="field">
            <div class="field__label">产品</div>
            <div class="chips">
              <button
                type="button"
                class="chip"
                :class="{ 'is-active': !filters.productId }"
                @click="setProduct('')"
              >
                全部
              </button>
              <button
                v-for="p in store.products"
                :key="p.id"
                type="button"
                class="chip"
                :class="{ 'is-active': filters.productId === p.id }"
                @click="setProduct(p.id)"
              >
                {{ p.name }}
              </button>
            </div>
          </div>

          <div v-if="processOptions.length" class="field">
            <div class="field__label">工序</div>
            <div class="chips">
              <button
                type="button"
                class="chip"
                :class="{ 'is-active': !filters.processId }"
                @click="filters.processId = ''"
              >
                全部
              </button>
              <button
                v-for="o in processOptions"
                :key="o.id"
                type="button"
                class="chip"
                :class="{ 'is-active': filters.processId === o.id }"
                @click="filters.processId = o.id"
              >
                {{ o.name }}
              </button>
            </div>
          </div>

          <div class="field">
            <div class="field__label">工人</div>
            <div class="chips">
              <button
                type="button"
                class="chip"
                :class="{ 'is-active': !filters.worker }"
                @click="filters.worker = ''"
              >
                全部
              </button>
              <button
                v-for="w in store.workerOptions"
                :key="w"
                type="button"
                class="chip"
                :class="{ 'is-active': filters.worker === w }"
                @click="filters.worker = w"
              >
                {{ w }}
              </button>
            </div>
          </div>

          <div class="field">
            <div class="field__label">班次</div>
            <RangeTabs v-model="filters.shift" :options="shiftOptions" />
          </div>
        </div>
        <div class="fsheet__foot">
          <van-button round plain block @click="resetFilters">重置</van-button>
          <van-button round type="primary" block @click="filterShow = false">确定</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import type { RecordRow } from '@/types'
import { money, qty, round } from '@/utils/format'
import {
  addDays,
  currentMonthRange,
  groupTitle,
  monthRange,
  shiftMonth,
  todayStr,
  weekRange
} from '@/utils/date'
import { enrich, sumAmount } from '@/utils/stats'
import { countText, detailAoa, exportWorkbook } from '@/utils/exporter'
import { fileStamp } from '@/utils/date'
import RecordItem from '@/components/RecordItem.vue'
import EmptyState from '@/components/EmptyState.vue'
import RangeTabs from '@/components/RangeTabs.vue'
import DatePickButton from '@/components/DatePickButton.vue'

const store = useAppStore()

type RangeKey = 'today' | 'week' | 'month' | 'lastMonth' | '7d' | '30d' | 'all' | 'custom'

const filters = reactive({
  range: 'month' as RangeKey,
  start: '',
  end: '',
  productId: '',
  processId: '',
  worker: '',
  shift: '' as '' | 'day' | 'night',
  keyword: ''
})

const filterShow = ref(false)
const selectMode = ref(false)
const selected = ref<string[]>([])

const timePresets: Array<{ label: string; value: RangeKey }> = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '近 7 天', value: '7d' }
]

const allRangeOptions: Array<{ label: string; value: RangeKey }> = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '上月', value: 'lastMonth' },
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '全部', value: 'all' },
  { label: '自定义', value: 'custom' }
]

const shiftOptions = [
  { label: '全部', value: '' },
  { label: '白班', value: 'day' },
  { label: '夜班', value: 'night' }
]

const hasAnyRecord = computed(() => store.records.length > 0)

const processOptions = computed(() =>
  filters.productId ? store.processesOfProduct(filters.productId) : []
)

const activeFilterCount = computed(() => {
  let n = 0
  if (filters.productId) n++
  if (filters.processId) n++
  if (filters.worker) n++
  if (filters.shift) n++
  return n
})

/* --------------------------- 范围解析 --------------------------- */
function resolveRange(): { start: string; end: string } {
  const today = todayStr()
  switch (filters.range) {
    case 'today':
      return { start: today, end: today }
    case 'week':
      return weekRange(today)
    case 'month':
      return currentMonthRange()
    case 'lastMonth':
      return monthRange(shiftMonth(today.slice(0, 7), -1))
    case '7d':
      return { start: addDays(today, -6), end: today }
    case '30d':
      return { start: addDays(today, -29), end: today }
    case 'custom': {
      const s = filters.start || addDays(today, -30)
      const e = filters.end || today
      return s <= e ? { start: s, end: e } : { start: e, end: s }
    }
    default:
      return { start: '1970-01-01', end: '2999-12-31' }
  }
}

function setRange(v: RangeKey) {
  filters.range = v
  if (v === 'custom' && !filters.start) {
    const today = todayStr()
    filters.start = addDays(today, -30)
    filters.end = today
  }
}

function setProduct(id: string) {
  filters.productId = id
  filters.processId = ''
}

function resetFilters() {
  filters.productId = ''
  filters.processId = ''
  filters.worker = ''
  filters.shift = ''
  filters.keyword = ''
  filters.range = 'month'
}

/* --------------------------- 数据 --------------------------- */
const filteredRows = computed<RecordRow[]>(() => {
  const { start, end } = resolveRange()
  const kw = filters.keyword.trim().toLowerCase()
  const rows = store.records.filter((r) => {
    if (r.date < start || r.date > end) return false
    if (filters.productId && r.productId !== filters.productId) return false
    if (filters.processId && r.processId !== filters.processId) return false
    if (filters.worker && r.worker !== filters.worker) return false
    if (filters.shift && r.shift !== filters.shift) return false
    return true
  })
  let out = enrich(rows, store.productMap, store.processMap)
  out = out.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  if (kw) {
    out = out.filter(
      (r) =>
        r.productName.toLowerCase().includes(kw) ||
        r.processName.toLowerCase().includes(kw) ||
        (r.worker || '').toLowerCase().includes(kw) ||
        (r.note || '').toLowerCase().includes(kw)
    )
  }
  return out
})

const rows = computed(() => filteredRows.value)

const total = computed(() => {
  const amount = sumAmount(rows.value)
  return { amount, quantity: round(rows.value.reduce((s, r) => s + r.quantity, 0), 2) }
})

const groups = computed(() => {
  const map = new Map<string, RecordRow[]>()
  rows.value.forEach((r) => {
    const arr = map.get(r.date)
    if (arr) arr.push(r)
    else map.set(r.date, [r])
  })
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      rows: list,
      amount: sumAmount(list),
      quantity: round(list.reduce((s, r) => s + r.quantity, 0), 2)
    }))
})

/* --------------------------- 多选 --------------------------- */
function toggleSelect() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selected.value = []
}

function toggleSelectRow(id: string) {
  const i = selected.value.indexOf(id)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(id)
}

function selectAll() {
  selected.value = rows.value.map((r) => r.id)
}

async function batchDelete() {
  if (!selected.value.length) return
  const n = selected.value.length
  try {
    await showConfirmDialog({
      title: '删除记录',
      message: `确认删除已选中的 ${n} 条记录？删除后不可恢复。`,
      confirmButtonText: '删除',
      confirmButtonColor: '#EF4444'
    })
  } catch {
    return
  }
  await store.removeRecords([...selected.value])
  selected.value = []
  selectMode.value = false
  showToast(`已删除 ${n} 条记录`)
}

/* --------------------------- 导出 --------------------------- */
function specOf(productId: string): string {
  return store.productMap.get(productId)?.spec || ''
}

function exportCurrent() {
  if (!rows.value.length) {
    showToast('当前没有可导出的记录')
    return
  }
  const sorted = [...rows.value].sort((a, b) => (a.date < b.date ? -1 : 1))
  exportWorkbook(
    [{ name: '计件明细', aoa: detailAoa(sorted, specOf) }],
    `计件明细_${filters.range}_${fileStamp()}.xlsx`
  )
  showToast(`已导出 ${rows.value.length} 条记录`)
}

function exportSelected() {
  if (!selected.value.length) {
    showToast('请先选择记录')
    return
  }
  const set = new Set(selected.value)
  const list = rows.value.filter((r) => set.has(r.id)).sort((a, b) => (a.date < b.date ? -1 : 1))
  exportWorkbook(
    [{ name: '选中明细', aoa: detailAoa(list, specOf) }],
    `选中计件明细_${fileStamp()}.xlsx`
  )
  showToast(`已导出 ${list.length} 条记录`)
}
</script>

<style scoped>
/* ---------- 筛选栏 ---------- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 14px 10px;
}

.search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 12px;
  border-radius: 11px;
  background: var(--app-card);
  box-shadow: var(--app-shadow);
}

.search__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--app-text);
  font-family: inherit;
}

.search__input::placeholder {
  color: var(--app-text-3);
}

.icon-btn {
  position: relative;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 11px;
  border: none;
  background: var(--app-card);
  color: var(--app-text-2);
  box-shadow: var(--app-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn.is-on {
  color: var(--app-primary);
}

.dot-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: var(--app-primary);
  color: #fff;
  font-size: 9px;
  line-height: 14px;
  text-align: center;
}

/* ---------- 快捷时间 ---------- */
.quick-times {
  display: flex;
  gap: 7px;
  padding: 0 14px 10px;
  overflow-x: auto;
}

.qtime {
  flex-shrink: 0;
  border: 1px solid var(--app-line);
  background: var(--app-card);
  color: var(--app-text-2);
  font-size: 12px;
  padding: 6px 13px;
  border-radius: 18px;
  font-family: inherit;
}

.qtime.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-weak);
  color: var(--app-primary);
  font-weight: 600;
}

/* ---------- 汇总 ---------- */
.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 14px 10px;
  padding: 12px 14px;
  border-radius: var(--app-radius);
  background: var(--app-card);
  box-shadow: var(--app-shadow);
}

.summary__title {
  font-size: 12px;
  color: var(--app-text-2);
}

.summary__amount {
  font-size: 19px;
  font-weight: 700;
  color: var(--app-text);
  margin-top: 2px;
}

.summary__ops {
  display: flex;
  gap: 8px;
}

.summary__ops .icon-btn {
  box-shadow: none;
  background: var(--app-card-2);
}

/* ---------- 分组 ---------- */
.group {
  margin-bottom: 4px;
}

.group-head__amount {
  font-weight: 700;
  color: var(--app-primary);
}



/* ---------- 多选操作条 ---------- */
.select-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(56px + var(--app-safe-bottom));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: var(--app-card);
  border-top: 1px solid var(--app-line);
  box-shadow: 0 -2px 14px rgba(17, 24, 39, 0.06);
  z-index: 101;
}

.select-bar__info {
  font-size: 13px;
  color: var(--app-text-2);
}

.select-bar__actions {
  display: flex;
  gap: 8px;
}

/* ---------- 筛选弹层 ---------- */
.fsheet {
  display: flex;
  flex-direction: column;
  max-height: 86vh;
  background: var(--app-card);
}

.fsheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 10px;
}

.fsheet__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.fsheet__body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}

.fsheet__foot {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + var(--app-safe-bottom));
  border-top: 1px solid var(--app-line);
}

.field {
  margin-bottom: 16px;
}

.field__label {
  font-size: 12px;
  color: var(--app-text-2);
  margin-bottom: 7px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.chip {
  border: 1px solid var(--app-line);
  background: var(--app-card-2);
  color: var(--app-text);
  font-size: 13px;
  padding: 7px 13px;
  border-radius: 20px;
  font-family: inherit;
}

.chip.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-weak);
  color: var(--app-primary);
  font-weight: 600;
}
</style>
