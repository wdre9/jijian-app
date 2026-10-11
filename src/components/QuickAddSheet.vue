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
          <div class="kw-wrap">
            <van-icon name="search" size="14" color="var(--app-text-3)" />
            <input v-model="productKw" class="kw-input" placeholder="搜索产品名称 / 规格" />
            <van-icon
              v-if="productKw"
              name="clear"
              size="14"
              color="var(--app-text-3)"
              @click="productKw = ''"
            />
          </div>
          <div class="chips">
            <template v-if="filteredProducts.length">
              <button
                v-for="p in filteredProducts"
                :key="p.id"
                type="button"
                class="chip"
                :class="{ 'is-active': p.id === form.productId }"
                @click="pickProduct(p.id)"
              >
                {{ p.name }}
                <em v-if="p.spec">{{ p.spec }}</em>
              </button>
            </template>
            <div v-else class="hint-line">无匹配项</div>
          </div>
        </div>
        <van-empty v-else image-size="70" description="还没有产品，先去「产品与工序」添加" />

        <!-- 工序 -->
        <div v-if="form.productId" class="field">
          <div class="field__label">工序</div>
          <div v-if="currentProcesses.length" class="kw-wrap">
            <van-icon name="search" size="14" color="var(--app-text-3)" />
            <input v-model="processKw" class="kw-input" placeholder="搜索工序" />
            <van-icon
              v-if="processKw"
              name="clear"
              size="14"
              color="var(--app-text-3)"
              @click="processKw = ''"
            />
          </div>
          <div v-if="currentProcesses.length" class="chips chips--grid">
            <template v-if="filteredProcesses.length">
              <button
                v-for="o in filteredProcesses"
                :key="o.id"
                type="button"
                class="chip chip--process"
                :class="{ 'is-active': form.processMode === 'exist' && o.id === form.processId }"
                @click="pickProcess(o.id)"
              >
                <span class="chip__name ellipsis">{{ o.name }}</span>
                <span class="chip__price num">¥{{ priceText(o.price) }}</span>
              </button>
            </template>
            <div v-else class="hint-line no-match">无匹配项</div>
          </div>
          <div v-else class="hint-line">该产品暂无工序，可手动输入或选择不填</div>

          <div class="chips chips--opt" style="margin-top: 8px">
            <button
              type="button"
              class="chip chip--opt"
              :class="{ 'is-active': form.processMode === 'manual' }"
              @click="pickManual"
            >
              手动输入
            </button>
            <button
              type="button"
              class="chip chip--opt"
              :class="{ 'is-active': form.processMode === 'none' }"
              @click="pickNone"
            >
              不填工序
            </button>
          </div>
          <div v-if="form.processMode === 'manual'" class="manual-line">
            <input
              class="text-input"
              v-model="form.manualProcessName"
              placeholder="输入自定义工序名（不自动带出单价）"
            />
          </div>
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
          <div v-if="workerOptions.length" class="kw-wrap" style="margin-top: 8px">
            <van-icon name="search" size="14" color="var(--app-text-3)" />
            <input v-model="workerKw" class="kw-input" placeholder="搜索工人" />
            <van-icon
              v-if="workerKw"
              name="clear"
              size="14"
              color="var(--app-text-3)"
              @click="workerKw = ''"
            />
          </div>
          <div v-if="workerOptions.length" class="chips" style="margin-top: 8px">
            <template v-if="filteredWorkers.length">
              <button
                v-for="w in filteredWorkers"
                :key="w"
                type="button"
                class="chip chip--sm"
                :class="{ 'is-active': w === form.worker }"
                @click="form.worker = w"
              >
                {{ w }}
              </button>
            </template>
            <div v-else class="hint-line no-match">无匹配项</div>
          </div>
        </div>

        <!-- 备注 -->
        <div class="field">
          <div class="field__label">备注（可选）</div>
          <input class="text-input" v-model="form.note" placeholder="如：返工 5 件、加急单" />
        </div>

        <!-- 次数 -->
        <div class="field">
          <div class="field__label">次数</div>
          <RangeTabs v-model="countMode" :options="countModeOptions" />
          <div v-if="countMode === 'auto'" class="count-line">{{ autoText }}</div>
          <template v-else>
            <div class="count-line count-line--manual">
              <input
                class="count-input"
                type="number"
                inputmode="numeric"
                v-model="manualCountStr"
                placeholder="填次数"
                @blur="normalizeManualCount"
              />
              <span class="count-unit">次</span>
            </div>
            <div v-if="lastManualTip" class="count-tip">{{ lastManualTip }}</div>
          </template>
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
            :disabled="!canSave || saving"
            :loading="saving"
            @click="save(true)"
          >
            保存并再记一笔
          </van-button>
          <van-button class="btn-save" type="primary" round :disabled="!canSave || saving" :loading="saving" @click="save(false)">
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
import { runGuarded } from '@/utils/async'
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

const countModeOptions = [
  { label: '自动', value: 'auto' },
  { label: '手动', value: 'manual' }
]

/** 次数：auto=自动实时计算；manual=手动输入 */
const countMode = ref<'auto' | 'manual'>('auto')
const manualCountStr = ref('')
const lastManualTip = ref('')

/** 自动次数：= 该产品历史记录数 + 1（第 N+1 次） */
const autoText = computed(() => {
  if (!form.productId) return '请先选择产品'
  const n = store.records.filter((r) => r.productId === form.productId).length + 1
  return `第 ${n} 次（按该产品历史实时计算）`
})

/** 该产品最近一条手动记录的次数；无则返回 null */
function lastManualCountOf(): number | null {
  if (!form.productId) return null
  const list = store.records
    .filter((r) => r.productId === form.productId && r.countMode === 'manual')
    .sort((a, b) => b.createdAt - a.createdAt)
  return list.length ? list[0].count ?? 0 : null
}

/** 切到手动模式：预填该产品上次手动次数 +1，并提示上次 */
function refreshManualPrefill() {
  if (countMode.value !== 'manual') return
  const last = lastManualCountOf()
  if (last !== null) {
    manualCountStr.value = String(last + 1)
    lastManualTip.value = `上次：第 ${last} 次`
  } else {
    manualCountStr.value = ''
    lastManualTip.value = '暂无手动次数记录，请填写次数'
  }
}

function normalizeManualCount() {
  manualCountStr.value = String(Math.max(0, Math.round(toNum(manualCountStr.value) || 0)))
}

watch(countMode, () => {
  refreshManualPrefill()
})

const quickQty = [10, 50, 100]

const form = reactive({
  date: todayStr(),
  productId: '',
  processId: '',
  /** 工序三态：exist=已有工序；manual=手动输入自定义工序；none=不填工序（留空） */
  processMode: 'none' as 'exist' | 'manual' | 'none',
  /** 手动输入的自定义工序名（快照来源） */
  manualProcessName: '',
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

const productKw = ref('')
const processKw = ref('')
const workerKw = ref('')

const filteredProducts = computed(() => {
  const kw = productKw.value.trim().toLowerCase()
  if (!kw) return products.value
  return products.value.filter(
    (p) =>
      p.name.toLowerCase().includes(kw) ||
      (p.spec || '').toLowerCase().includes(kw)
  )
})

const filteredProcesses = computed(() => {
  const kw = processKw.value.trim().toLowerCase()
  if (!kw) return currentProcesses.value
  return currentProcesses.value.filter((o) => o.name.toLowerCase().includes(kw))
})

const filteredWorkers = computed(() => {
  const kw = workerKw.value.trim().toLowerCase()
  if (!kw) return workerOptions.value
  return workerOptions.value.filter((w) => w.toLowerCase().includes(kw))
})
const amount = computed(() => round(toNum(form.quantity) * toNum(form.price), 2))
/** 可保存：产品必填、数量必填；工序三态中 exist 需已选工序、manual 需输入名称、none 允许留空 */
const canSave = computed(() => {
  if (!form.productId || toNum(form.quantity) <= 0) return false
  if (form.processMode === 'exist') return !!form.processId
  if (form.processMode === 'manual') return !!form.manualProcessName.trim()
  return true
})

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
  form.processMode = 'none'
  form.manualProcessName = ''

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
    form.processMode = 'exist'
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
  form.processMode = hit ? 'exist' : 'none'
  form.manualProcessName = ''
  if (!form.processId) showToast('该产品暂无工序，可手动输入或选择不填')
  // 换产品后，手动模式需重新按新产品查上次次数预填
  refreshManualPrefill()
}

function pickProcess(id: string) {
  form.processMode = 'exist'
  form.processId = id
  const o = store.processes.find((x) => x.id === id)
  if (o) form.price = o.price
}

/** 手动输入模式：清空已选工序，单价由用户自填 */
function pickManual() {
  form.processMode = 'manual'
  form.processId = ''
}

/** 不填工序模式：两者皆空 */
function pickNone() {
  form.processMode = 'none'
  form.processId = ''
  form.manualProcessName = ''
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

const saving = ref(false)

async function save(again: boolean) {
  normalizeQty()
  normalizePrice()
  if (!canSave.value) {
    showToast('请选择产品，并填写数量与工序（或不填）')
    return
  }
  // 工序三态落库：选已有→写 processId+快照；手动输入→写快照、processId 留空；不填→两者皆空
  const isExist = form.processMode === 'exist'
  const processId = isExist ? form.processId : ''
  const processNameSnapshot = isExist
    ? store.processMap.get(form.processId)?.name || ''
    : form.processMode === 'manual'
      ? form.manualProcessName.trim()
      : ''
  await runGuarded(saving, async () => {
    await store.addRecord({
      date: form.date,
      productId: form.productId,
      processId,
      processNameSnapshot,
      quantity: form.quantity,
      price: form.price,
      worker: form.worker.trim(),
      shift: form.shift,
      note: form.note.trim(),
      countMode: countMode.value,
      count: countMode.value === 'manual' ? Math.round(toNum(manualCountStr.value) || 0) : undefined
    })
    emit('saved')
    if (again) {
      showToast('已保存，继续记下一笔')
      form.quantity = 0
      form.note = ''
      // 再记一笔：清空次数输入但保持模式；手动模式提示最新上次次数
      manualCountStr.value = ''
      if (countMode.value === 'manual') {
        const last = lastManualCountOf()
        lastManualTip.value = last !== null ? `上次：第 ${last} 次` : '暂无手动次数记录，请填写次数'
      }
    } else {
      showToast('已保存')
      emit('update:show', false)
    }
  }, { label: '保存' })
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

.kw-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 8px;
  padding: 0 10px;
  height: 36px;
  border-radius: 9px;
  background: var(--app-card-2);
}

.kw-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--app-text);
  font-family: inherit;
  outline: none;
}

.kw-input::placeholder {
  color: var(--app-text-3);
}

.no-match {
  width: 100%;
  text-align: center;
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

.count-line {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-2);
}

.count-line--manual {
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  border: 1px solid var(--app-line);
  border-radius: 10px;
  background: var(--app-card-2);
  padding: 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text);
  font-family: inherit;
  outline: none;
}

.count-unit {
  font-size: 12px;
  color: var(--app-text-3);
}

.count-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-text-3);
}
</style>
