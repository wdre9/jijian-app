<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    :style="{ maxHeight: '92vh' }"
    :safe-area-inset-bottom="true"
    teleport="body"
  >
    <div class="sheet">
      <div class="sheet__head">
        <span class="sheet__title">快速记账</span>
        <van-icon name="cross" size="18" color="#9CA3AF" @click="close" />
      </div>

      <div class="sheet__body">
        <!-- 产品 -->
        <div v-if="products.length" class="field">
          <div class="field__label">产品</div>
          <div class="chips">
            <button
              v-for="p in products"
              :key="p.id"
              type="button"
              class="chip"
              :class="{ 'is-active': p.id === form.productId }"
              @click="pickProduct(p.id)"
            >
              {{ p.name }}
              <em v-if="p.spec">{{ p.spec }}</em>
            </button>
          </div>
        </div>
        <van-empty v-else image-size="70" description="还没有产品，先去「产品与工序」添加" />

        <!-- 工序 -->
        <div v-if="form.productId" class="field">
          <div class="field__label">工序（点选自动带出单价）</div>
          <div v-if="currentProcesses.length" class="chips chips--grid">
            <button
              v-for="o in currentProcesses"
              :key="o.id"
              type="button"
              class="chip chip--process"
              :class="{ 'is-active': o.id === form.processId }"
              @click="pickProcess(o.id)"
            >
              <span class="chip__name ellipsis">{{ o.name }}</span>
              <span class="chip__price num">¥{{ priceText(o.price) }}</span>
            </button>
          </div>
          <div v-else class="hint-line">该产品暂无工序，请先在「产品与工序」中添加</div>
        </div>

        <!-- 数量 / 单价 -->
        <div class="two-col">
          <div class="field">
            <div class="field__label">数量（件）</div>
            <div class="stepper">
              <button type="button" class="stepper__btn" @click="stepQty(-1)">−</button>
              <input
                class="stepper__input num"
                type="number"
                inputmode="decimal"
                v-model="qtyInput"
                @blur="normalizeQty"
              />
              <button type="button" class="stepper__btn" @click="stepQty(1)">＋</button>
            </div>
          </div>
          <div class="field">
            <div class="field__label">单价（元/件）</div>
            <input
              class="text-input num"
              type="number"
              inputmode="decimal"
              v-model="priceInput"
              @blur="normalizePrice"
            />
          </div>
        </div>

        <div class="qty-quick">
          <button v-for="q in quickQty" :key="q" type="button" class="qbtn" @click="addQty(q)">
            +{{ q }}
          </button>
        </div>

        <!-- 日期 / 班次 -->
        <div class="field">
          <div class="field__label">日期</div>
          <div class="row" style="gap: 8px">
            <DatePickButton v-model="form.date" />
            <RangeTabs v-model="form.shift" :options="shiftOptions" style="flex: 1" />
          </div>
        </div>

        <!-- 工人 -->
        <div class="field">
          <div class="field__label">工人</div>
          <div class="row" style="gap: 8px">
            <input class="text-input" v-model="form.worker" placeholder="填写姓名" />
          </div>
          <div v-if="workerOptions.length" class="chips" style="margin-top: 8px">
            <button
              v-for="w in workerOptions"
              :key="w"
              type="button"
              class="chip chip--sm"
              :class="{ 'is-active': w === form.worker }"
              @click="form.worker = w"
            >
              {{ w }}
            </button>
          </div>
        </div>

        <!-- 备注 -->
        <div class="field">
          <div class="field__label">备注（可选）</div>
          <input class="text-input" v-model="form.note" placeholder="如：返工 5 件、加急单" />
        </div>
      </div>

      <div class="sheet__foot">
        <div class="amount-preview">
          <div class="amount-preview__label">本笔金额</div>
          <div class="amount-preview__value num">¥{{ money(amount) }}</div>
        </div>
        <div class="sheet__actions">
          <van-button
            class="btn-continue"
            type="default"
            round
            :disabled="!canSave"
            @click="save(true)"
          >
            保存并再记一笔
          </van-button>
          <van-button class="btn-save" type="primary" round :disabled="!canSave" @click="save(false)">
            保存
          </van-button>
        </div>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import { money, priceText, round, toNum } from '@/utils/format'
import { todayStr } from '@/utils/date'
import DatePickButton from '@/components/DatePickButton.vue'
import RangeTabs from '@/components/RangeTabs.vue'

const props = defineProps<{ show: boolean; presetProductId?: string; presetProcessId?: string }>()
const emit = defineEmits<{ 'update:show': [v: boolean]; saved: [] }>()

const store = useAppStore()

const visible = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v)
})

const shiftOptions = [
  { label: '白班', value: 'day' },
  { label: '夜班', value: 'night' }
]

const quickQty = [10, 50, 100]

const form = reactive({
  date: todayStr(),
  productId: '',
  processId: '',
  quantity: 0,
  price: 0,
  worker: '',
  shift: 'day' as 'day' | 'night',
  note: ''
})

const qtyInput = ref('0')
const priceInput = ref('0')

const products = computed(() =>
  [...store.products].sort((a, b) => b.updatedAt - a.updatedAt)
)
const currentProcesses = computed(() => store.processesOfProduct(form.productId))
const workerOptions = computed(() => store.workerOptions)
const amount = computed(() => round(toNum(form.quantity) * toNum(form.price), 2))
const canSave = computed(
  () => !!form.productId && !!form.processId && toNum(form.quantity) > 0
)

watch(
  () => props.show,
  (v) => {
    if (!v) return
    reset()
  }
)

watch(
  () => form.quantity,
  (v) => {
    qtyInput.value = String(v ?? 0)
  }
)

watch(
  () => form.price,
  (v) => {
    priceInput.value = String(v ?? 0)
  }
)

function reset() {
  const s = store.settings
  form.date = todayStr()
  form.worker = s.defaultWorker || ''
  form.shift = 'day'
  form.note = ''
  form.quantity = 0
  form.price = 0
  form.productId = props.presetProductId || (s.rememberLast ? s.lastProductId : '') || ''
  form.processId = ''

  if (form.productId && !store.products.some((p) => p.id === form.productId)) {
    form.productId = ''
  }
  if (!form.productId) {
    form.productId = products.value[0]?.id || ''
  }

  const list = store.processesOfProduct(form.productId)
  const prefer = props.presetProcessId || (s.rememberLast ? s.lastProcessId : '')
  const hit = list.find((o) => o.id === prefer) || list[0]
  if (hit) {
    form.processId = hit.id
    form.price = hit.price
  }
}

function pickProduct(id: string) {
  form.productId = id
  const list = store.processesOfProduct(id)
  const hit = list[0]
  form.processId = hit?.id || ''
  form.price = hit?.price || 0
  if (!form.processId) showToast('该产品还没有工序')
}

function pickProcess(id: string) {
  form.processId = id
  const o = store.processes.find((x) => x.id === id)
  if (o) form.price = o.price
}

function stepQty(d: number) {
  form.quantity = Math.max(0, round(toNum(form.quantity) + d, 2))
}

function addQty(q: number) {
  form.quantity = round(toNum(form.quantity) + q, 2)
}

function normalizeQty() {
  form.quantity = Math.max(0, round(toNum(qtyInput.value), 2))
  qtyInput.value = String(form.quantity)
}

function normalizePrice() {
  form.price = Math.max(0, round(toNum(priceInput.value), 4))
  priceInput.value = String(form.price)
}

async function save(again: boolean) {
  normalizeQty()
  normalizePrice()
  if (!canSave.value) {
    showToast('请选择产品与工序，并填写数量')
    return
  }
  await store.addRecord({
    date: form.date,
    productId: form.productId,
    processId: form.processId,
    quantity: form.quantity,
    price: form.price,
    worker: form.worker.trim(),
    shift: form.shift,
    note: form.note.trim()
  })
  emit('saved')
  if (again) {
    showToast('已保存，继续记下一笔')
    form.quantity = 0
    form.note = ''
  } else {
    showToast('已保存')
    emit('update:show', false)
  }
}

function close() {
  emit('update:show', false)
}

// 首次展示时初始化
watch(
  () => store.ready,
  (r) => {
    if (r && props.show) reset()
  }
)
if (props.show) reset()
</script>

<style scoped>
.sheet {
  display: flex;
  flex-direction: column;
  max-height: 92vh;
  background: var(--app-card);
}

.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 10px;
}

.sheet__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.sheet__body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 8px;
}

.field {
  margin-bottom: 14px;
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

.chips--grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.chip {
  border: 1px solid var(--app-line);
  background: var(--app-card-2);
  color: var(--app-text);
  font-size: 13px;
  padding: 7px 12px;
  border-radius: 20px;
  font-family: inherit;
  transition: all 0.14s ease;
}

.chip em {
  font-style: normal;
  font-size: 10px;
  color: var(--app-text-3);
  margin-left: 4px;
}

.chip--sm {
  font-size: 12px;
  padding: 5px 11px;
}

.chip--process {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-radius: 12px;
  padding: 8px 6px;
  overflow: hidden;
}

.chip__name {
  font-size: 12.5px;
  font-weight: 600;
  max-width: 100%;
}

.chip__price {
  font-size: 11px;
  color: var(--app-text-3);
}

.chip.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-weak);
  color: var(--app-primary);
}

.chip.is-active .chip__price {
  color: var(--app-primary);
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stepper {
  display: flex;
  align-items: center;
  background: var(--app-card-2);
  border-radius: 11px;
  overflow: hidden;
  height: 42px;
}

.stepper__btn {
  width: 42px;
  height: 42px;
  border: none;
  background: transparent;
  font-size: 19px;
  color: var(--app-primary);
  font-family: inherit;
}

.stepper__input {
  flex: 1;
  min-width: 0;
  width: 100%;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text);
  font-family: inherit;
  outline: none;
}

.text-input {
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 11px;
  background: var(--app-card-2);
  padding: 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
  font-family: inherit;
  outline: none;
}

.text-input::placeholder {
  font-weight: 400;
  color: var(--app-text-3);
}

.qty-quick {
  display: flex;
  gap: 8px;
  margin: -6px 0 14px;
}

.qbtn {
  flex: 1;
  border: 1px dashed var(--app-line);
  background: transparent;
  color: var(--app-primary);
  border-radius: 9px;
  padding: 7px 0;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
}

.hint-line {
  font-size: 12px;
  color: var(--app-text-3);
  padding: 6px 0;
}

.sheet__foot {
  border-top: 1px solid var(--app-line);
  padding: 12px 16px calc(12px + var(--app-safe-bottom));
  background: var(--app-card);
}

.amount-preview {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.amount-preview__label {
  font-size: 12px;
  color: var(--app-text-2);
}

.amount-preview__value {
  font-size: 24px;
  font-weight: 700;
  color: var(--app-primary);
}

.sheet__actions {
  display: flex;
  gap: 10px;
}

.btn-continue {
  flex: 1.1;
}

.btn-save {
  flex: 1;
}
</style>
