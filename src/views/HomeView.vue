<template>
  <div class="page">
    <!-- ============ 顶部概览 ============ -->
    <header class="hero">
      <div class="hero__top">
        <div>
          <div class="hero__hello">{{ greeting }}</div>
          <div class="hero__date">{{ dateLabel }}</div>
        </div>
        <div class="hero__tools">
          <button class="hero__btn" type="button" @click="openSheet()">
            <van-icon name="add-o" size="16" />
            记一笔
          </button>
        </div>
      </div>

      <div class="hero__label">{{ rangeLabel }}收入</div>
      <div class="hero__amount">
        <span class="hero__cur">¥</span>
        <span class="num">{{ money(rangeStat.amount) }}</span>
        <span v-if="delta && range === 'today'" class="hero__delta" :class="delta.cls">
          {{ delta.text }}
        </span>
      </div>

      <div class="hero__meta">
        <span>{{ qty(rangeStat.quantity) }} 件</span>
        <i></i>
        <span>{{ rangeStat.times }} 笔</span>
        <i></i>
        <span>日均 ¥{{ money(rangeStat.avg) }}</span>
      </div>

      <div v-if="goal > 0" class="goal">
        <div class="goal__bar">
          <div class="goal__fill" :style="{ width: goalPct + '%' }"></div>
        </div>
        <div class="goal__text">
          <span>{{ goalLabel }} ¥{{ money(goal, 0) }}</span>
          <span>已完成 {{ goalPct }}%</span>
        </div>
      </div>
    </header>

    <div class="page__inner">
      <!-- ============ 安装引导与备份提醒（平台自适应） ============ -->
      <InstallTipCard />

      <!-- ============ 时间范围 ============ -->
      <div class="mt-12">
        <RangeTabs v-model="range" :options="rangeOptions" />
      </div>

      <!-- ============ 指标 ============ -->
      <div class="card mt-12" style="display: flex">
        <StatTile label="合计件数" :value="qty(rangeStat.quantity)" unit="件" />
        <div class="divider"></div>
        <StatTile label="合计笔数" :value="rangeStat.times" unit="笔" />
        <div class="divider"></div>
        <StatTile label="平均单价" :value="'¥' + priceText(rangeStat.avgPrice)" unit="/件" />
      </div>

      <!-- ============ 快捷记账 ============ -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">快捷记账</div>
          <span class="fs-12 text-3" @click="router.push('/products')">
            管理工序 <van-icon name="arrow" size="11" />
          </span>
        </div>

        <template v-if="quickList.length">
          <div class="quick-grid">
            <div
              v-for="item in quickList"
              :key="item.id"
              class="quick-card"
              @click="openSheet(item.productId, item.id)"
            >
              <div class="quick-card__name">{{ item.name }}</div>
              <div class="quick-card__sub ellipsis">{{ store.productName(item.productId) }}</div>
              <div class="quick-card__price num">¥{{ priceText(item.price) }}</div>
            </div>
          </div>
          <div v-if="store.quickProcesses.length > 12" class="fs-12 text-3 mt-8">
            仅显示前 12 个常用工序，共 {{ store.quickProcesses.length }} 个
          </div>
        </template>

        <div v-else class="cta">
          <div class="cta__title">还没有工序</div>
          <div class="cta__desc">先添加「产品 — 工序 — 单价」，之后记账只需点一下</div>
          <van-button type="primary" round size="small" @click="router.push('/products')">
            去添加产品与工序
          </van-button>
        </div>
      </div>

      <!-- ============ 今日记录 ============ -->
      <div class="card card--list">
        <div class="card__head" style="padding: 14px 14px 10px; margin: 0">
          <div class="card__title">今日记录</div>
          <span class="fs-12 text-3" @click="router.push('/records')">
            查看全部 <van-icon name="arrow" size="11" />
          </span>
        </div>

        <template v-if="todayRows.length">
          <RecordItem v-for="r in todayRows.slice(0, 5)" :key="r.id" :row="r" />
          <div v-if="todayRows.length > 5" class="more" @click="router.push('/records')">
            还有 {{ todayRows.length - 5 }} 条，查看全部
          </div>
        </template>
        <EmptyState v-else icon="records" text="今天还没有记录" hint="点上方工序卡片，一步完成记账" />
      </div>

      <!-- ============ 近 7 天趋势 ============ -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">近 7 天收入</div>
          <span class="fs-12 text-3" @click="router.push('/stats')">完整统计</span>
        </div>
        <div class="mini-bars">
          <div v-for="d in last7" :key="d.date" class="mini-bar">
            <div class="mini-bar__amount num">{{ d.amount > 0 ? moneyShort(d.amount) : '' }}</div>
            <div class="mini-bar__track">
              <div
                class="mini-bar__fill"
                :class="{ 'is-today': d.date === today }"
                :style="{ height: barHeight(d.amount) + '%' }"
              ></div>
            </div>
            <div class="mini-bar__label">{{ d.weekLabel }}</div>
          </div>
        </div>
      </div>
    </div>

    <QuickAddSheet
      v-model:show="sheetShow"
      :preset-product-id="presetProductId"
      :preset-process-id="presetProcessId"
      @saved="onSaved"
    />

    <!-- 悬浮新增 -->
    <button class="fab" type="button" @click="router.push('/record/new')">
      <van-icon name="plus" size="20" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import type { RecordRow } from '@/types'
import { money, moneyShort, priceText, qty, round } from '@/utils/format'
import { addDays, friendlyDate, todayStr, weekdayCn, weekRange, currentMonthRange } from '@/utils/date'
import { groupByDate, enrich, dailyAverage, sumAmount, sumQty } from '@/utils/stats'
import RangeTabs from '@/components/RangeTabs.vue'
import StatTile from '@/components/StatTile.vue'
import RecordItem from '@/components/RecordItem.vue'
import EmptyState from '@/components/EmptyState.vue'
import QuickAddSheet from '@/components/QuickAddSheet.vue'
import InstallTipCard from '@/components/InstallTipCard.vue'

const store = useAppStore()
const router = useRouter()

const range = ref<'today' | 'week' | 'month'>('today')
const rangeOptions = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' }
]

const today = todayStr()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，注意休息'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const dateLabel = computed(() => `${friendlyDate(today)} ${weekdayCn(today)}`)

/* ------------------------- 时间范围数据 ------------------------- */
const rangeRows = computed(() => {
  if (range.value === 'today') return store.recordsOfDate(today)
  if (range.value === 'week') return store.recordsInWeek(today)
  const { start, end } = currentMonthRange()
  return store.recordsInRange(start, end)
})

const rangeStat = computed(() => {
  const rows = rangeRows.value
  const amount = sumAmount(rows)
  const quantity = sumQty(rows)
  const avg = dailyAverage(rows)
  return {
    amount,
    quantity,
    times: rows.length,
    avg: range.value === 'today' ? amount : avg.amount,
    avgPrice: quantity ? round(amount / quantity, 4) : 0
  }
})

const rangeLabel = computed(
  () => ({ today: '今日', week: '本周', month: '本月' })[range.value] ?? '今日'
)

/* 今日 vs 昨日 */
const delta = computed(() => {
  const cur = sumAmount(store.recordsOfDate(today))
  const prev = sumAmount(store.recordsOfDate(addDays(today, -1)))
  if (!prev && !cur) return null
  if (!prev) return { text: '昨日无记录', cls: 'delta--flat' }
  const rate = ((cur - prev) / prev) * 100
  const flat = Math.abs(rate) < 0.5
  return {
    text: flat ? '与昨日持平' : `${rate > 0 ? '↑' : '↓'} ${Math.abs(round(rate, 0))}%`,
    cls: flat ? 'delta--flat' : rate > 0 ? 'delta--up' : 'delta--down'
  }
})

/* 目标进度 */
const goal = computed(() => {
  const s = store.settings
  if (range.value === 'today') return s.dailyGoal > 0 ? s.dailyGoal : 0
  if (range.value === 'month') return s.monthlyGoal > 0 ? s.monthlyGoal : 0
  return s.dailyGoal > 0 ? round(s.dailyGoal * 7, 0) : 0
})
const goalLabel = computed(
  () => ({ today: '日目标', week: '周目标', month: '月目标' })[range.value] ?? '目标'
)
const goalPct = computed(() => {
  if (goal.value <= 0) return 0
  return Math.min(999, round((rangeStat.value.amount / goal.value) * 100, 0))
})

/* ------------------------- 快捷工序 ------------------------- */
const quickList = computed(() => store.quickProcesses.slice(0, 12))

/* ------------------------- 今日记录 ------------------------- */
const todayRows = computed<RecordRow[]>(() =>
  enrich(
    [...store.todayRecords].sort((a, b) => b.createdAt - a.createdAt),
    store.productMap,
    store.processMap
  )
)

/* ------------------------- 近 7 天 ------------------------- */
const last7 = computed(() => {
  const groups = new Map<string, number>()
  groupByDate(store.recordsInRange(addDays(today, -6), today)).forEach((g) => {
    groups.set(g.date, sumAmount(g.rows))
  })
  const out: Array<{ date: string; amount: number; weekLabel: string; label: string }> = []
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i)
    const date = new Date()
    date.setDate(date.getDate() - i)
    out.push({
      date: d,
      amount: groups.get(d) || 0,
      weekLabel: i === 0 ? '今天' : `周${'日一二三四五六'[date.getDay()]}`,
      label: d.slice(5)
    })
  }
  return out
})

const maxLast7 = computed(() => Math.max(1, ...last7.value.map((d) => d.amount)))

function barHeight(amount: number): number {
  if (!amount) return 2
  return Math.max(6, round((amount / maxLast7.value) * 100, 1))
}

/* ------------------------- 快捷记账弹层 ------------------------- */
const sheetShow = ref(false)
const presetProductId = ref('')
const presetProcessId = ref('')

function openSheet(productId?: string, processId?: string) {
  presetProductId.value = productId || ''
  presetProcessId.value = processId || ''
  sheetShow.value = true
}

function onSaved() {
  /* 记录已写入，视图自动刷新 */
}
</script>

<style scoped>
/* ---------- Hero ---------- */
.hero {
  padding: calc(var(--app-safe-top) + 18px) 18px 20px;
  background: linear-gradient(160deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%);
  color: #fff;
  border-radius: 0 0 22px 22px;
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.24);
}

.hero__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.hero__hello {
  font-size: 17px;
  font-weight: 700;
}

.hero__date {
  font-size: 12px;
  opacity: 0.82;
  margin-top: 3px;
}

.hero__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 20px;
  font-family: inherit;
}

.hero__btn:active {
  background: rgba(255, 255, 255, 0.3);
}

.hero__label {
  margin-top: 16px;
  font-size: 12px;
  opacity: 0.85;
}

.hero__amount {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-top: 2px;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.hero__cur {
  font-size: 18px;
  font-weight: 600;
  opacity: 0.9;
}

.hero__delta {
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  align-self: center;
}

.hero__delta.delta--up {
  background: rgba(255, 255, 255, 0.24);
}
.hero__delta.delta--down {
  background: rgba(255, 255, 255, 0.24);
}
.hero__delta.delta--flat {
  background: rgba(255, 255, 255, 0.16);
}

.hero__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.9;
}

.hero__meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  display: inline-block;
}

.goal {
  margin-top: 14px;
}

.goal__bar {
  height: 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.25);
  overflow: hidden;
}

.goal__fill {
  height: 100%;
  border-radius: 4px;
  background: #fff;
  transition: width 0.35s ease;
}

.goal__text {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  opacity: 0.9;
  margin-top: 6px;
}

/* ---------- 列表卡 ---------- */
.card--list {
  padding: 0;
  overflow: hidden;
}

.more {
  text-align: center;
  font-size: 12px;
  color: var(--app-primary);
  padding: 11px 0;
  border-top: 1px solid var(--app-line);
}

.divider {
  width: 1px;
  background: var(--app-line);
  margin: 8px 0;
}

/* ---------- 无工序引导 ---------- */
.cta {
  text-align: center;
  padding: 14px 6px 8px;
}

.cta__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.cta__desc {
  font-size: 12px;
  color: var(--app-text-3);
  margin: 6px 0 12px;
}

/* ---------- 近 7 天迷你柱状 ---------- */
.mini-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 132px;
  padding-top: 6px;
}

.mini-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.mini-bar__amount {
  font-size: 10px;
  color: var(--app-text-2);
  height: 14px;
  white-space: nowrap;
}

.mini-bar__track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.mini-bar__fill {
  width: 60%;
  max-width: 26px;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(180deg, #93c5fd, #3b82f6);
  transition: height 0.35s ease;
}

.mini-bar__fill.is-today {
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
}

.mini-bar__label {
  font-size: 10px;
  color: var(--app-text-3);
  margin-top: 6px;
}

/* ---------- FAB ---------- */
.fab {
  position: fixed;
  right: 18px;
  bottom: calc(72px + var(--app-safe-bottom));
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
  color: #fff;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
}

.fab:active {
  transform: scale(0.94);
}

.quick-card__sub {
  font-size: 10px;
  color: var(--app-text-3);
  margin-bottom: 3px;
}
</style>
