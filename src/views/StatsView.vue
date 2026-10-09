<template>
  <div class="page">
    <div class="page__title">统计</div>

    <!-- ============ 时间范围 ============ -->
    <div class="ranges">
      <button
        v-for="t in rangeOptions"
        :key="t.value"
        type="button"
        class="rbtn"
        :class="{ 'is-active': range === t.value }"
        @click="range = t.value"
      >
        {{ t.label }}
      </button>
    </div>
    <div v-if="range === 'custom'" class="custom-range">
      <DatePickButton v-model="customStart" :min-offset="-1095" />
      <span class="text-3 fs-12">至</span>
      <DatePickButton v-model="customEnd" />
    </div>
    <div class="range-tip">
      {{ rangeLabel }}（{{ resolved.start }} ~ {{ resolved.end }}，共 {{ days }} 天）
    </div>

    <!-- ============ 可导出长图区域 ============ -->
    <div ref="captureRef" class="capture-area">
      <div class="capture-brand">
        <div class="row" style="gap: 8px">
          <div class="capture-brand__logo">计</div>
          <div>
            <div class="bold" style="font-size: 14px">计件工资统计</div>
            <div class="fs-12 text-3">{{ rangeLabel }} · {{ resolved.start }} ~ {{ resolved.end }}</div>
          </div>
        </div>
        <div class="fs-12 text-3">生成于 {{ nowText }}</div>
      </div>

      <!-- 总览 -->
      <div class="overview">
        <div class="overview__label">合计金额</div>
        <div class="overview__amount num">¥{{ money(total.amount) }}</div>
        <div class="overview__grid">
          <div class="ov">
            <div class="ov__v num">{{ qty(total.quantity) }}</div>
            <div class="ov__l">件数</div>
          </div>
          <div class="ov">
            <div class="ov__v num">{{ total.times }}</div>
            <div class="ov__l">笔数</div>
          </div>
          <div class="ov">
            <div class="ov__v num">¥{{ money(avg.amount, 1) }}</div>
            <div class="ov__l">日均（{{ avg.days }} 天）</div>
          </div>
          <div class="ov">
            <div class="ov__v num">¥{{ priceText(avgPrice) }}</div>
            <div class="ov__l">平均单价</div>
          </div>
        </div>
        <div class="best">
          <van-icon name="fire-o" size="14" color="#F59E0B" />
          <span>最高单日 {{ best.date ? friendlyDate(best.date) : '—' }}</span>
          <span class="num bold">¥{{ money(best.amount) }}</span>
        </div>
      </div>

      <!-- 趋势 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">{{ trendTitle }}</div>
          <span class="fs-12 text-3">{{ granularity === 'day' ? '按天' : '按月' }}</span>
        </div>
        <v-chart v-if="hasData" class="chart" :option="trendOption" autoresize />
        <EmptyState v-else icon="chart-trending-o" text="该时间段暂无数据" />
      </div>

      <!-- 产品占比 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">产品占比</div>
        </div>
        <v-chart v-if="productRows.length" class="chart" :option="pieOption" autoresize />
        <EmptyState v-else icon="pie-chart-o" text="暂无产品数据" />
      </div>

      <!-- 工序排行 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">工序收入排行</div>
          <span class="fs-12 text-3">Top {{ processRows.length }}</span>
        </div>
        <v-chart v-if="processRows.length" class="chart chart--sm" :option="processOption" autoresize />
        <EmptyState v-else icon="bar-chart-o" text="暂无工序数据" />
      </div>

      <!-- 工人排行 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">工人收入排行</div>
        </div>
        <div v-if="workerRows.length" class="rank">
          <div v-for="(w, i) in workerRows" :key="w.key" class="rank__row">
            <span class="rank__no" :class="`rank__no--${i < 3 ? i + 1 : 0}`">{{ i + 1 }}</span>
            <div class="rank__main">
              <div class="rank__top">
                <span class="rank__name">{{ w.label }}</span>
                <span class="rank__amount num">¥{{ money(w.amount) }}</span>
              </div>
              <div class="rank__bar">
                <div class="rank__fill" :style="{ width: rankPct(w.amount) + '%' }"></div>
              </div>
              <div class="rank__sub">
                {{ qty(w.quantity) }} 件 · {{ w.times }} 笔 · 占 {{ percentOf(w.amount) }}
              </div>
            </div>
          </div>
        </div>
        <EmptyState v-else icon="friends-o" text="暂无工人数据" />
      </div>

      <!-- 班次 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">班次对比</div>
        </div>
        <div class="shift">
          <div
            v-for="s in shiftRows"
            :key="s.key"
            class="shift__item"
            :class="{ 'is-night': s.key === 'night' }"
          >
            <div class="shift__name">{{ s.label }}</div>
            <div class="shift__amount num">¥{{ money(s.amount) }}</div>
            <div class="shift__meta">{{ qty(s.quantity) }} 件 · {{ s.times }} 笔</div>
          </div>
        </div>
      </div>

      <!-- 近 6 个月对比 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">近 6 个月对比</div>
        </div>
        <v-chart v-if="hasAnyData" class="chart chart--sm" :option="monthOption" autoresize />
        <EmptyState v-else icon="bar-chart-o" text="暂无数据" />
      </div>

      <div class="capture-foot">由「计件工资记账」生成 · 数据仅保存在本机</div>
    </div>

    <!-- ============ 导出 ============ -->
    <div class="card">
      <div class="card__head">
        <div class="card__title">导出统计</div>
      </div>
      <div class="exports">
        <van-button size="small" round plain block :loading="capturing" @click="exportImage">
          {{ capturing ? '生成中…' : '导出统计长图' }}
        </van-button>
        <van-button size="small" round plain block @click="exportExcel">导出统计 Excel</van-button>
      </div>
      <div class="fs-12 text-3 mt-8">
        Excel 含：明细、按产品、按工序、按工人、按日期 五张表；长图适合直接发群里汇报。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { showToast } from 'vant'
import VChart from 'vue-echarts'
import html2canvas from 'html2canvas'
import { useAppStore } from '@/stores/app'
import type { SummaryRow } from '@/types'
import { money, moneyShort, percent, priceText, qty, round } from '@/utils/format'
import {
  addDays,
  currentMonthKey,
  currentMonthRange,
  dateList,
  fileStamp,
  formatDateTime,
  friendlyDate,
  monthRange,
  shiftMonth,
  todayStr,
  weekRange
} from '@/utils/date'
import {
  bestDay,
  byDate,
  byProcess,
  byProduct,
  byShift,
  byWorker,
  dailyAverage,
  enrich,
  monthBuckets,
  recentMonths,
  sumAmount,
  sumQty
} from '@/utils/stats'
import { detailAoa, exportWorkbook } from '@/utils/exporter'
import DatePickButton from '@/components/DatePickButton.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = useAppStore()

type RangeKey = 'week' | 'month' | 'lastMonth' | '30d' | '90d' | 'year' | 'custom'

const range = ref<RangeKey>('month')
const rangeOptions: Array<{ label: string; value: RangeKey }> = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '上月', value: 'lastMonth' },
  { label: '近 30 天', value: '30d' },
  { label: '近 90 天', value: '90d' },
  { label: '今年', value: 'year' },
  { label: '自定义', value: 'custom' }
]

const today = todayStr()
const customStart = ref(addDays(today, -60))
const customEnd = ref(today)

const resolved = computed(() => {
  switch (range.value) {
    case 'week':
      return weekRange(today)
    case 'month':
      return currentMonthRange()
    case 'lastMonth':
      return monthRange(shiftMonth(currentMonthKey(), -1))
    case '30d':
      return { start: addDays(today, -29), end: today }
    case '90d':
      return { start: addDays(today, -89), end: today }
    case 'year':
      return { start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` }
    default: {
      const s = customStart.value || addDays(today, -60)
      const e = customEnd.value || today
      return s <= e ? { start: s, end: e } : { start: e, end: s }
    }
  }
})

const rangeLabel = computed(
  () =>
    ({
      week: '本周统计',
      month: '本月统计',
      lastMonth: '上月统计',
      '30d': '近 30 天统计',
      '90d': '近 90 天统计',
      year: '年度统计',
      custom: '自定义区间'
    })[range.value] || '统计'
)

const days = computed(() => dateList(resolved.value.start, resolved.value.end).length)

const nowText = formatDateTime(Date.now())

/* ----------------------------- 数据 ----------------------------- */
const rangeRecords = computed(() =>
  store.recordsInRange(resolved.value.start, resolved.value.end)
)

const hasData = computed(() => rangeRecords.value.length > 0)
const hasAnyData = computed(() => store.records.length > 0)

const total = computed(() => ({
  amount: sumAmount(rangeRecords.value),
  quantity: sumQty(rangeRecords.value),
  times: rangeRecords.value.length
}))

const avg = computed(() => dailyAverage(rangeRecords.value))
const best = computed(() => bestDay(rangeRecords.value))
const avgPrice = computed(() => (total.value.quantity ? total.value.amount / total.value.quantity : 0))

const productRows = computed(() => byProduct(rangeRecords.value, store.productMap).slice(0, 6))
const processRows = computed(() =>
  byProcess(rangeRecords.value, store.processMap, store.productMap).slice(0, 8)
)
const workerRows = computed(() => byWorker(rangeRecords.value).slice(0, 20))
const shiftRows = computed(() => byShift(rangeRecords.value))

/* ----------------------------- 趋势粒度 ----------------------------- */
const granularity = computed<'day' | 'month'>(() => (days.value > 62 ? 'month' : 'day'))

const trendTitle = computed(() => (granularity.value === 'day' ? '每日收入趋势' : '每月收入趋势'))

interface TrendItem {
  label: string
  amount: number
  quantity: number
}

const trendData = computed<TrendItem[]>(() => {
  if (granularity.value === 'month') {
    const buckets = monthBuckets(rangeRecords.value)
    const startYm = resolved.value.start.slice(0, 7)
    const endYm = resolved.value.end.slice(0, 7)
    const out: TrendItem[] = []
    let cur = startYm
    let guard = 0
    while (cur <= endYm && guard < 120) {
      const b = buckets.get(cur)
      out.push({
        label: `${parseInt(cur.slice(5, 7), 10)}月`,
        amount: b ? round(b.amount, 2) : 0,
        quantity: b ? round(b.qty, 2) : 0
      })
      cur = shiftMonth(cur, 1)
      guard++
    }
    return out
  }

  const map = new Map<string, { amount: number; quantity: number }>()
  rangeRecords.value.forEach((r) => {
    const cur = map.get(r.date) || { amount: 0, quantity: 0 }
    cur.amount += Number(r.amount) || 0
    cur.quantity += Number(r.quantity) || 0
    map.set(r.date, cur)
  })
  return dateList(resolved.value.start, resolved.value.end)
    .filter((d) => d <= today || map.has(d))
    .map((d) => {
      const cur = map.get(d)
      return {
        label: d.slice(5).replace('-', '/'),
        amount: cur ? round(cur.amount, 2) : 0,
        quantity: cur ? round(cur.quantity, 2) : 0
      }
    })
})

/* ----------------------------- ECharts ----------------------------- */
const AXIS = { color: '#9CA3AF', fontSize: 10 }
const SPLIT = { lineStyle: { color: 'rgba(156,163,175,0.22)' } }

const trendOption = computed(() => {
  const items = trendData.value
  const avgLine = items.length
    ? round(
        items.reduce((s, i) => s + i.amount, 0) / Math.max(1, items.filter((i) => i.amount > 0).length || 1),
        2
      )
    : 0
  return {
    grid: { left: 4, right: 8, top: 28, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      valueFormatter: (v: number) => `¥${money(Number(v) || 0)}`
    },
    xAxis: {
      type: 'category',
      data: items.map((i) => i.label),
      axisLabel: AXIS,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(156,163,175,0.4)' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { ...AXIS, formatter: (v: number) => (v >= 10000 ? `${v / 10000}万` : String(v)) },
      splitLine: SPLIT
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: items.map((i) => i.amount),
        barMaxWidth: 18,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#60A5FA' },
              { offset: 1, color: '#2563EB' }
            ]
          }
        }
      },
      ...(avgLine > 0 && items.length > 3
        ? [
            {
              name: '均值',
              type: 'line',
              data: items.map(() => avgLine),
              symbol: 'none',
              lineStyle: { type: 'dashed', color: '#F59E0B', width: 1.4 },
              tooltip: { show: false }
            }
          ]
        : [])
    ]
  }
})

const pieOption = computed(() => {
  const rows = productRows.value
  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/>¥${money(p.value)}（${p.percent}%）`
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 7,
      itemHeight: 7,
      textStyle: { fontSize: 10, color: '#6B7280' }
    },
    color: ['#3B82F6', '#10B981', '#F59E0B', '#7C3AED', '#EC4899', '#06B6D4'],
    series: [
      {
        type: 'pie',
        radius: ['42%', '66%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: 'transparent', borderWidth: 2 },
        label: { formatter: '{b}\n{d}%', fontSize: 10, color: '#6B7280', lineHeight: 13 },
        labelLine: { length: 6, length2: 6 },
        data: rows.map((r) => ({ name: r.label, value: r.amount }))
      }
    ]
  }
})

const processOption = computed(() => {
  const rows = [...processRows.value].reverse()
  return {
    grid: { left: 4, right: 44, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
      formatter: (ps: Array<{ dataIndex: number; value: number }>) => {
        const p = ps[0]
        const row = rows[p.dataIndex]
        const sub = row?.sub ? `<br/>${row.sub}` : ''
        return `${row?.label ?? ''}${sub}<br/>¥${money(p.value)} · ${qty(row?.quantity ?? 0)} 件 · ${row?.times ?? 0} 笔`
      }
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.label),
      axisLabel: { ...AXIS, fontSize: 11, color: '#6B7280' },
      axisTick: { show: false },
      axisLine: { show: false }
    },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => r.amount),
        barMaxWidth: 13,
        itemStyle: {
          borderRadius: [0, 5, 5, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#93C5FD' },
              { offset: 1, color: '#2563EB' }
            ]
          }
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 10,
          color: '#6B7280',
          formatter: (p: { value: number }) => moneyShort(p.value)
        }
      }
    ]
  }
})

const monthOption = computed(() => {
  const buckets = monthBuckets(store.records)
  const months = recentMonths(6, currentMonthKey())
  return {
    grid: { left: 4, right: 8, top: 18, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      valueFormatter: (v: number) => `¥${money(Number(v) || 0)}`
    },
    xAxis: {
      type: 'category',
      data: months.map((m) => `${parseInt(m.slice(5, 7), 10)}月`),
      axisLabel: AXIS,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(156,163,175,0.4)' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { ...AXIS, formatter: (v: number) => (v >= 10000 ? `${v / 10000}万` : String(v)) },
      splitLine: SPLIT
    },
    series: [
      {
        type: 'bar',
        data: months.map((m) => round(buckets.get(m)?.amount || 0, 2)),
        barMaxWidth: 22,
        itemStyle: { borderRadius: [5, 5, 0, 0], color: '#93C5FD' }
      }
    ]
  }
})

/* ----------------------------- 排行辅助 ----------------------------- */
const maxWorkerAmount = computed(() =>
  Math.max(1, ...workerRows.value.map((w) => w.amount))
)

function rankPct(amount: number): number {
  return Math.max(3, round((amount / maxWorkerAmount.value) * 100, 1))
}

function percentOf(amount: number): string {
  if (!total.value.amount) return '0%'
  return percent(amount / total.value.amount)
}

/* ----------------------------- 导出 ----------------------------- */
const captureRef = ref<HTMLElement | null>(null)
const capturing = ref(false)

async function exportImage() {
  const el = captureRef.value
  if (!el) return
  capturing.value = true
  try {
    await nextTick()
    await new Promise((r) => setTimeout(r, 350))
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: Math.min(2, window.devicePixelRatio || 1) + 1,
      useCORS: true,
      logging: false
    })
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `计件统计_${resolved.value.start}_${resolved.value.end}_${fileStamp()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showToast('统计长图已导出')
  } catch (e) {
    showToast('长图生成失败，请重试')
  } finally {
    capturing.value = false
  }
}

function exportExcel() {
  const records = [...rangeRecords.value].sort((a, b) => (a.date < b.date ? -1 : 1))
  const enriched = enrich(records, store.productMap, store.processMap)

  const aoaSummary = (
    title: string,
    header: string[],
    rows: SummaryRow[],
    map?: (r: SummaryRow) => Array<string | number>
  ): Array<Array<string | number>> => [
    [title],
    header,
    ...rows.map((r) => (map ? map(r) : [r.label, r.quantity, r.amount, r.times])),
    [],
    ['导出时间', formatDateTime(Date.now())]
  ]

  exportWorkbook(
    [
      { name: '明细', aoa: detailAoa(enriched, (id) => store.productMap.get(id)?.spec || '') },
      {
        name: '按产品',
        aoa: aoaSummary(
          `${rangeLabel.value} — 按产品`,
          ['产品', '规格', '数量', '金额(元)', '笔数'],
          byProduct(records, store.productMap),
          (r) => [r.label, r.sub || '', r.quantity, r.amount, r.times]
        )
      },
      {
        name: '按工序',
        aoa: aoaSummary(
          `${rangeLabel.value} — 按工序`,
          ['工序', '所属产品', '数量', '金额(元)', '笔数'],
          byProcess(records, store.processMap, store.productMap),
          (r) => [r.label, r.sub || '', r.quantity, r.amount, r.times]
        )
      },
      {
        name: '按工人',
        aoa: aoaSummary(
          `${rangeLabel.value} — 按工人`,
          ['工人', '数量', '金额(元)', '笔数'],
          byWorker(records)
        )
      },
      {
        name: '按日期',
        aoa: aoaSummary(
          `${rangeLabel.value} — 按日期`,
          ['日期', '数量', '金额(元)', '笔数'],
          byDate(records)
        )
      }
    ],
    `计件统计_${resolved.value.start}_${resolved.value.end}_${fileStamp()}.xlsx`
  )
  showToast('统计 Excel 已导出')
}
</script>

<style scoped>
/* ---------- 范围按钮 ---------- */
.ranges {
  display: flex;
  gap: 7px;
  padding: 2px 14px 8px;
  overflow-x: auto;
}

.rbtn {
  flex-shrink: 0;
  border: 1px solid var(--app-line);
  background: var(--app-card);
  color: var(--app-text-2);
  font-size: 12px;
  padding: 6px 13px;
  border-radius: 18px;
  font-family: inherit;
}

.rbtn.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-weak);
  color: var(--app-primary);
  font-weight: 600;
}

.custom-range {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 8px;
}

.range-tip {
  padding: 0 14px 10px;
  font-size: 12px;
  color: var(--app-text-3);
}

.capture-area {
  margin: 0 14px 12px;
}

/* ---------- 总览 ---------- */
.overview {
  background: linear-gradient(150deg, #eff6ff, #f8fafc);
  border-radius: var(--app-radius);
  padding: 16px;
  margin-bottom: 12px;
}

:global(html.van-theme-dark) .overview {
  background: linear-gradient(150deg, #1e293b, #1a2029);
}

.overview__label {
  font-size: 12px;
  color: var(--app-text-2);
}

.overview__amount {
  font-size: 30px;
  font-weight: 700;
  color: var(--app-primary);
  letter-spacing: -0.5px;
  margin-top: 2px;
}

.overview__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 14px;
}

.ov {
  text-align: center;
}

.ov__v {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}

.ov__l {
  font-size: 10px;
  color: var(--app-text-3);
  margin-top: 3px;
}

.best {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding-top: 11px;
  border-top: 1px dashed var(--app-line);
  font-size: 12px;
  color: var(--app-text-2);
}

.best .num {
  margin-left: auto;
  color: var(--app-text);
}

/* ---------- 排行 ---------- */
.rank__row {
  display: flex;
  gap: 9px;
  padding: 9px 0;
  border-bottom: 1px solid var(--app-line);
}

.rank__row:last-child {
  border-bottom: none;
}

.rank__no {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: var(--app-card-2);
  color: var(--app-text-3);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.rank__no--1 {
  background: #fef3c7;
  color: #b45309;
}
.rank__no--2 {
  background: #e5e7eb;
  color: #4b5563;
}
.rank__no--3 {
  background: #fde8d7;
  color: #c2410c;
}

.rank__main {
  flex: 1;
  min-width: 0;
}

.rank__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.rank__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.rank__amount {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
}

.rank__bar {
  height: 5px;
  border-radius: 3px;
  background: var(--app-card-2);
  margin: 6px 0 5px;
  overflow: hidden;
}

.rank__fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #93c5fd, #2563eb);
}

.rank__sub {
  font-size: 11px;
  color: var(--app-text-3);
}

/* ---------- 班次 ---------- */
.shift {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.shift__item {
  border-radius: var(--app-radius-sm);
  padding: 12px;
  background: rgba(59, 130, 246, 0.08);
}

.shift__item.is-night {
  background: rgba(124, 58, 237, 0.1);
}

.shift__name {
  font-size: 12px;
  color: var(--app-text-2);
}

.shift__amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
  margin: 4px 0 3px;
}

.shift__meta {
  font-size: 11px;
  color: var(--app-text-3);
}

/* ---------- 导出 ---------- */
.exports {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.capture-foot {
  text-align: center;
  font-size: 11px;
  color: var(--app-text-3);
  padding: 14px 0 4px;
}
</style>
