<template>
  <div class="page page--plain">
    <van-nav-bar
      :title="product ? product.name : '产品详情'"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    >
      <template #right>
        <span v-if="product" class="nav-add" @click="goAddRecord">记一笔</span>
      </template>
    </van-nav-bar>

    <template v-if="product">
      <div class="page__inner">
        <!-- 产品信息 -->
        <div class="card">
          <div class="ph">
            <div>
              <div class="ph__name">{{ product.name }}</div>
              <div class="ph__meta">
                <span v-if="product.spec">{{ product.spec }}</span>
                <span v-if="product.note"> · {{ product.note }}</span>
              </div>
            </div>
            <van-button size="mini" round plain @click="openEditProduct">编辑</van-button>
          </div>
          <div class="ph__grid">
            <div class="ph__item">
              <div class="ph__v num">¥{{ money(stat.amount) }}</div>
              <div class="ph__l">累计金额</div>
            </div>
            <div class="ph__item">
              <div class="ph__v num">{{ qty(stat.quantity) }}</div>
              <div class="ph__l">累计件数</div>
            </div>
            <div class="ph__item">
              <div class="ph__v num">{{ stat.times }}</div>
              <div class="ph__l">计件笔数</div>
            </div>
          </div>
        </div>

        <!-- 工序 -->
        <div class="card">
          <div class="card__head">
            <div class="card__title">工序与单价（{{ processes.length }}）</div>
            <van-button size="mini" round type="primary" plain @click="openAddProcess">
              新增工序
            </van-button>
          </div>

          <div v-if="processes.length" class="procs">
            <div v-for="(o, i) in processes" :key="o.id" class="proc">
              <div class="proc__main">
                <div class="proc__top">
                  <span class="proc__name" :class="{ 'is-off': !o.active }">{{ o.name }}</span>
                  <span class="proc__price num">¥{{ priceText(o.price) }}/件</span>
                </div>
                <div class="proc__meta">
                  本站已做 {{ qty(procStat(o.id).quantity) }} 件 · ¥{{ money(procStat(o.id).amount) }}
                </div>
              </div>
              <div class="proc__ops">
                <van-icon
                  name="arrow-up"
                  :class="{ 'op-disable': i === 0 }"
                  @click="i > 0 && store.moveProcess(o.id, -1)"
                />
                <van-icon
                  name="arrow-down"
                  :class="{ 'op-disable': i === processes.length - 1 }"
                  @click="i < processes.length - 1 && store.moveProcess(o.id, 1)"
                />
                <van-switch
                  :model-value="o.active"
                  size="18"
                  @update:model-value="(v: boolean) => toggleActive(o.id, v)"
                />
                <van-icon name="edit" @click="openEditProcess(o.id)" />
                <van-icon name="delete-o" color="#EE0A24" @click="askRemoveProcess(o.id)" />
              </div>
            </div>
          </div>
          <EmptyState v-else icon="todo-list-o" text="还没有工序" hint="为产品添加工序并设置单价" />
        </div>

        <!-- 工序金额分布 -->
        <div class="card" v-if="procRows.length">
          <div class="card__head">
            <div class="card__title">工序金额分布</div>
          </div>
          <div class="dist">
            <div v-for="r in procRows" :key="r.key" class="dist__row">
              <span class="dist__name">{{ r.label }}</span>
              <div class="dist__bar">
                <div class="dist__fill" :style="{ width: distPct(r.amount) + '%' }"></div>
              </div>
              <span class="dist__amt num">{{ moneyShort(r.amount) }}</span>
            </div>
          </div>
        </div>

        <!-- 最近记录 -->
        <div class="card" v-if="recent.length">
          <div class="card__head">
            <div class="card__title">最近计件记录</div>
            <span class="fs-12 text-3" @click="router.push('/records')">查看全部</span>
          </div>
          <RecordItem
            v-for="r in recent"
            :key="r.id"
            :row="r"
            @click="router.push(`/record/${r.id}`)"
          />
        </div>
      </div>
    </template>

    <EmptyState v-else text="产品不存在" hint="可能已被删除，请返回上一页" />

    <!-- 编辑产品 -->
    <van-popup v-model:show="showEditProduct" position="bottom" round :style="{ paddingBottom: '20px' }">
      <div class="pop-title">编辑产品</div>
      <van-cell-group inset>
        <van-field v-model="pDraft.name" label="产品名称" maxlength="20" />
        <van-field v-model="pDraft.spec" label="规格型号" maxlength="20" />
        <van-field v-model="pDraft.note" label="备注" maxlength="40" />
      </van-cell-group>
      <div class="pop-actions">
        <van-button block round type="primary" @click="confirmEditProduct">保存</van-button>
      </div>
    </van-popup>

    <!-- 新增/编辑工序 -->
    <van-popup v-model:show="showProc" position="bottom" round :style="{ paddingBottom: '20px' }">
      <div class="pop-title">{{ procEditId ? '编辑工序' : '新增工序' }}</div>
      <van-cell-group inset>
        <van-field v-model="oDraft.name" label="工序名称" placeholder="如：钻孔" maxlength="16" />
        <van-field
          v-model="oDraft.price"
          label="单件工价"
          type="number"
          placeholder="0.00"
        >
          <template #extra><span class="fs-12 text-3">元/件</span></template>
        </van-field>
        <van-field v-model="oDraft.note" label="备注" placeholder="选填" maxlength="40" />
        <van-cell title="启用（出现在录入快捷区）">
          <template #right-icon>
            <van-switch v-model="oDraft.active" size="20" />
          </template>
        </van-cell>
      </van-cell-group>
      <div class="pop-actions">
        <van-button block round type="primary" @click="confirmProc">保存</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import { money, moneyShort, priceText, qty, round, toNum } from '@/utils/format'
import { byProcess, enrich, sumAmount, sumQty } from '@/utils/stats'
import EmptyState from '@/components/EmptyState.vue'
import RecordItem from '@/components/RecordItem.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const pid = computed(() => (route.params.id as string) || '')
const product = computed(() => store.products.find((p) => p.id === pid.value) || null)

onMounted(() => {
  if (!store.ready) store.init()
})

const productRecords = computed(() => store.records.filter((r) => r.productId === pid.value))

const stat = computed(() => ({
  amount: sumAmount(productRecords.value),
  quantity: sumQty(productRecords.value),
  times: productRecords.value.length
}))

const processes = computed(() => store.processesOfProduct(pid.value))

const procRows = computed(() =>
  byProcess(productRecords.value, store.processMap, store.productMap).sort((a, b) => b.amount - a.amount)
)

const maxProc = computed(() => Math.max(1, ...procRows.value.map((r) => r.amount)))
function distPct(amount: number): number {
  return Math.max(2, round((amount / maxProc.value) * 100, 1))
}

function procStat(processId: string) {
  const rows = productRecords.value.filter((r) => r.processId === processId)
  return { quantity: sumQty(rows), amount: sumAmount(rows) }
}

const recent = computed(() =>
  enrich(
    [...productRecords.value].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    store.productMap,
    store.processMap
  )
)

/* ---------------- 产品编辑 ---------------- */
const showEditProduct = ref(false)
const pDraft = reactive({ name: '', spec: '', note: '' })

function openEditProduct() {
  if (!product.value) return
  pDraft.name = product.value.name
  pDraft.spec = product.value.spec
  pDraft.note = product.value.note
  showEditProduct.value = true
}

async function confirmEditProduct() {
  if (!pDraft.name.trim()) return showToast('请填写产品名称')
  await store.updateProduct(pid.value, {
    name: pDraft.name.trim(),
    spec: pDraft.spec.trim(),
    note: pDraft.note.trim()
  })
  showEditProduct.value = false
  showToast('已保存')
}

/* ---------------- 工序编辑 ---------------- */
const showProc = ref(false)
const procEditId = ref('')
const oDraft = reactive({ name: '', price: '', note: '', active: true })

function openAddProcess() {
  procEditId.value = ''
  oDraft.name = ''
  oDraft.price = ''
  oDraft.note = ''
  oDraft.active = true
  showProc.value = true
}

function openEditProcess(id: string) {
  const o = store.processMap.get(id)
  if (!o) return
  procEditId.value = id
  oDraft.name = o.name
  oDraft.price = String(o.price)
  oDraft.note = o.note
  oDraft.active = o.active
  showProc.value = true
}

async function confirmProc() {
  if (!oDraft.name.trim()) return showToast('请填写工序名称')
  const price = round(toNum(oDraft.price), 4)
  if (!(price >= 0)) return showToast('单件工价不能为负')
  if (procEditId.value) {
    await store.updateProcess(procEditId.value, {
      name: oDraft.name.trim(),
      price,
      note: oDraft.note.trim(),
      active: oDraft.active
    })
  } else {
    await store.addProcess({
      productId: pid.value,
      name: oDraft.name,
      price,
      note: oDraft.note,
      active: oDraft.active
    })
  }
  showProc.value = false
  showToast('已保存')
}

async function toggleActive(id: string, v: boolean) {
  await store.updateProcess(id, { active: v })
}

function askRemoveProcess(id: string) {
  const o = store.processMap.get(id)
  if (!o) return
  const count = store.records.filter((r) => r.processId === id).length
  showConfirmDialog({
    title: '删除工序',
    message: count
      ? `工序「${o.name}」已有 ${count} 条记录，删除后这些记录仍保留（显示为“已删除工序”）。确定删除吗？`
      : `确定删除工序「${o.name}」吗？`,
    confirmButtonText: '删除',
    confirmButtonColor: '#EE0A24'
  })
    .then(async () => {
      await store.removeProcess(id, true)
      showToast('已删除')
    })
    .catch(() => {})
}

function goAddRecord() {
  router.push({ path: '/record/new', query: { productId: pid.value } })
}
</script>

<style scoped>
.nav-add {
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 600;
}

.ph {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.ph__name {
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text);
}

.ph__meta {
  font-size: 12px;
  color: var(--app-text-3);
  margin-top: 3px;
}

.ph__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--app-line);
}

.ph__item {
  text-align: center;
}

.ph__v {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text);
}

.ph__l {
  font-size: 11px;
  color: var(--app-text-3);
  margin-top: 3px;
}

.procs {
  display: flex;
  flex-direction: column;
}

.proc {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 0;
  border-bottom: 1px solid var(--app-line);
}

.proc:last-child {
  border-bottom: none;
}

.proc__main {
  flex: 1;
  min-width: 0;
}

.proc__top {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.proc__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.proc__name.is-off {
  color: var(--app-text-3);
  text-decoration: line-through;
}

.proc__price {
  font-size: 12px;
  color: var(--app-primary);
  font-weight: 600;
}

.proc__meta {
  font-size: 11px;
  color: var(--app-text-3);
  margin-top: 4px;
}

.proc__ops {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--app-text-2);
  font-size: 16px;
}

.op-disable {
  opacity: 0.28;
}

.dist__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.dist__name {
  width: 72px;
  font-size: 12px;
  color: var(--app-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dist__bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--app-card-2);
  overflow: hidden;
}

.dist__fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #93c5fd, #2563eb);
}

.dist__amt {
  width: 56px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
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

.fs-12 {
  font-size: 12px;
}

.card :deep(.rrow) {
  padding-left: 0;
  padding-right: 0;
  background: transparent;
}

.card :deep(.rrow:last-child) {
  border-bottom: none;
  padding-bottom: 0;
}
</style>
