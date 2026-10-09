<template>
  <div class="page page--plain">
    <van-nav-bar
      title="记录详情"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <template v-if="row">
      <div class="page__inner">
        <div class="hero card">
          <div class="hero__label">金额</div>
          <div class="hero__amount num">¥{{ money(row.amount) }}</div>
          <div class="hero__calc num">
            {{ qty(row.quantity) }} 件 × ¥{{ priceText(row.price) }}/件
          </div>
          <div class="hero__date">
            {{ friendlyDate(row.date) }} {{ weekdayCn(row.date) }}
            <span v-if="row.shift === 'night'" class="tag">夜班</span>
            <span v-else class="tag tag--day">白班</span>
          </div>
        </div>

        <van-cell-group inset title="计件信息">
          <van-cell title="产品" :value="row.productName" />
          <van-cell v-if="spec" title="规格" :value="spec" />
          <van-cell title="工序" :value="row.processName" />
          <van-cell title="数量" :value="`${qty(row.quantity)} 件`" />
          <van-cell title="单价" :value="`¥${priceText(row.price)} / 件`" />
          <van-cell title="金额" :value="`¥${money(row.amount)}`" />
          <van-cell title="工人" :value="row.worker || '未填写'" />
          <van-cell title="备注" :value="row.note || '无'" />
        </van-cell-group>

        <van-cell-group inset title="操作信息">
          <van-cell title="记录时间" :value="formatDateTime(row.createdAt)" />
          <van-cell v-if="row.updatedAt !== row.createdAt" title="修改时间" :value="formatDateTime(row.updatedAt)" />
        </van-cell-group>

        <div class="actions">
          <van-button type="primary" block round @click="router.push(`/record/${row.id}/edit`)">
            编辑记录
          </van-button>
          <van-button class="del" block round plain type="danger" @click="onDelete">
            删除记录
          </van-button>
          <van-button class="again" block round plain @click="addAgain">
            再记一笔（同产品·工序）
          </van-button>
        </div>
      </div>
    </template>

    <EmptyState v-else text="记录不存在" hint="可能已被删除，请返回明细页查看" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import { money, priceText, qty, round } from '@/utils/format'
import { formatDateTime, friendlyDate, todayStr, weekdayCn } from '@/utils/date'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const id = computed(() => (route.params.id as string) || '')
const row = computed(() => {
  const rec = store.records.find((r) => r.id === id.value)
  if (!rec) return null
  return {
    ...rec,
    productName: store.productName(rec.productId),
    processName: store.processName(rec.processId)
  }
})

const spec = computed(() => store.productMap.get(row.value?.productId || '')?.spec || '')

onMounted(() => {
  if (!store.ready) store.init()
})

async function addAgain() {
  const r = row.value
  if (!r) return
  await store.addRecord({
    date: todayStr(),
    productId: r.productId,
    processId: r.processId,
    quantity: r.quantity,
    price: round(store.processMap.get(r.processId)?.price || r.price, 4),
    worker: r.worker,
    shift: r.shift,
    note: ''
  })
  showToast('已按同样数量再记一笔')
}

function onDelete() {
  showConfirmDialog({
    title: '删除记录',
    message: '确定删除这条计件记录吗？'
  })
    .then(async () => {
      await store.removeRecord(id.value)
      showToast('已删除')
      router.replace('/records')
    })
    .catch(() => {})
}
</script>

<style scoped>
.hero {
  text-align: center;
  background: linear-gradient(150deg, #eff6ff, #ffffff);
  padding: 20px 16px;
}

:global(html.van-theme-dark) .hero {
  background: linear-gradient(150deg, #1e293b, #1a2029);
}

.hero__label {
  font-size: 12px;
  color: var(--app-text-2);
}

.hero__amount {
  font-size: 34px;
  font-weight: 700;
  color: var(--app-primary);
  letter-spacing: -0.5px;
  margin: 4px 0 6px;
}

.hero__calc {
  font-size: 12px;
  color: var(--app-text-2);
}

.hero__date {
  margin-top: 10px;
  font-size: 12px;
  color: var(--app-text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 5px;
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.12);
}

.tag--day {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
}

.actions {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
