<template>
  <div class="page page--plain">
    <van-nav-bar
      title="产品与工序"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    >
      <template #right>
        <span class="nav-add" @click="openAdd">新增</span>
      </template>
    </van-nav-bar>

    <div class="page__inner">
      <van-search v-model="keyword" placeholder="搜索产品名称 / 规格" shape="round" />

      <div v-if="list.length" class="plist">
        <van-swipe-cell v-for="p in list" :key="p.id">
          <div class="pcard" @click="router.push(`/product/${p.id}`)">
            <div class="pcard__main">
              <div class="pcard__top">
                <span class="pcard__name">{{ p.name }}</span>
                <span v-if="p.spec" class="pcard__spec">{{ p.spec }}</span>
              </div>
              <div class="pcard__meta">
                {{ stat(p.id).processCount }} 道工序 · 累计 {{ qty(stat(p.id).quantity) }} 件 ·
                {{ stat(p.id).times }} 笔
              </div>
              <div class="pcard__bar">
                <div
                  class="pcard__fill"
                  :style="{ width: pct(stat(p.id).amount) + '%' }"
                ></div>
              </div>
            </div>
            <div class="pcard__right">
              <div class="pcard__amount num">¥{{ money(stat(p.id).amount) }}</div>
              <van-icon name="arrow" color="#C8C9CC" />
            </div>
          </div>
          <template #right>
            <van-button square type="danger" text="删除" class="swipe-btn" @click="askRemove(p)" />
          </template>
        </van-swipe-cell>
      </div>

      <EmptyState
        v-else
        icon="apps-o"
        :text="store.products.length ? '没有匹配的产品' : '还没有产品'"
        hint="先新增产品，再为它添加工序与单价"
      />

      <div class="tip">
        提示：工序挂在产品下，每道工序可设单件工价，录入时会自动带出单价。
      </div>
    </div>

    <!-- 新增产品 -->
    <van-popup v-model:show="showAdd" position="bottom" round :style="{ paddingBottom: '20px' }">
      <div class="pop-title">新增产品</div>
      <van-cell-group inset>
        <van-field v-model="draft.name" label="产品名称" placeholder="如：法兰盘" maxlength="20" />
        <van-field v-model="draft.spec" label="规格型号" placeholder="选填，如：DN50" maxlength="20" />
        <van-field v-model="draft.note" label="备注" placeholder="选填" maxlength="40" />
      </van-cell-group>
      <div class="pop-actions">
        <van-button block round type="primary" @click="confirmAdd">确定新增</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import type { Product } from '@/types'
import { money, qty, round } from '@/utils/format'
import { byProduct } from '@/utils/stats'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const store = useAppStore()

const keyword = ref('')
const showAdd = ref(false)
const draft = reactive({ name: '', spec: '', note: '' })

onMounted(() => {
  if (!store.ready) store.init()
})

const rows = computed(() => byProduct(store.records, store.productMap))
const rowMap = computed(() => {
  const m = new Map<string, { amount: number; quantity: number; times: number }>()
  rows.value.forEach((r) => m.set(r.key, { amount: r.amount, quantity: r.quantity, times: r.times }))
  return m
})

function stat(pid: string) {
  const base = rowMap.value.get(pid) || { amount: 0, quantity: 0, times: 0 }
  return { ...base, processCount: store.processesOfProduct(pid).length }
}

const maxAmount = computed(() => Math.max(1, ...rows.value.map((r) => r.amount)))
function pct(amount: number): number {
  return Math.max(2, round((amount / maxAmount.value) * 100, 1))
}

const list = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const all = [...store.products].sort((a, b) => a.createdAt - b.createdAt)
  if (!kw) return all
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(kw) ||
      (p.spec || '').toLowerCase().includes(kw) ||
      (p.note || '').toLowerCase().includes(kw)
  )
})

function openAdd() {
  draft.name = ''
  draft.spec = ''
  draft.note = ''
  showAdd.value = true
}

async function confirmAdd() {
  if (!draft.name.trim()) return showToast('请填写产品名称')
  const p = await store.addProduct({ name: draft.name, spec: draft.spec, note: draft.note })
  showAdd.value = false
  showToast('已新增产品')
  router.push(`/product/${p.id}`)
}

function askRemove(p: Product) {
  const count = store.records.filter((r) => r.productId === p.id).length
  const msg = count
    ? `「${p.name}」下已有 ${count} 条计件记录，删除后这些记录将显示为“已删除产品”，历史金额仍保留在统计中。确定删除吗？`
    : `确定删除产品「${p.name}」及其全部工序吗？`
  showConfirmDialog({ title: '删除产品', message: msg })
    .then(async () => {
      await store.removeProduct(p.id, true)
      showToast('已删除')
    })
    .catch(() => {})
}
</script>

<style scoped>
.nav-add {
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 600;
}

.plist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pcard {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--app-card);
  border-radius: var(--app-radius);
  padding: 13px 14px;
}

.pcard__main {
  flex: 1;
  min-width: 0;
}

.pcard__top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pcard__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.pcard__spec {
  font-size: 11px;
  color: var(--app-text-3);
  background: var(--app-card-2);
  border-radius: 5px;
  padding: 1px 6px;
}

.pcard__meta {
  font-size: 12px;
  color: var(--app-text-3);
  margin: 5px 0 7px;
}

.pcard__bar {
  height: 4px;
  border-radius: 3px;
  background: var(--app-card-2);
  overflow: hidden;
}

.pcard__fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #93c5fd, #2563eb);
}

.pcard__right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pcard__amount {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text);
}

.swipe-btn {
  height: 100%;
}

.pop-title {
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  padding: 16px 0 12px;
}

.pop-actions {
  padding: 14px 16px 0;
}

.tip {
  font-size: 12px;
  color: var(--app-text-3);
  line-height: 1.7;
  padding: 14px 4px 10px;
}
</style>
