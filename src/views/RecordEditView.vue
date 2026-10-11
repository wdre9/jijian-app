<template>
  <div class="page page--plain">
    <van-nav-bar
      :title="isEdit ? '编辑记录' : '新增记录'"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <div class="page__inner">
      <van-cell-group inset>
        <van-field
          label="生产日期"
          readonly
          is-link
          :model-value="`${friendlyDate(form.date)} ${weekdayCn(form.date)}`"
          @click="showDate = true"
        />
        <van-field
          label="产品"
          readonly
          is-link
          :model-value="productText || '请选择产品'"
          placeholder="请选择产品"
          @click="openProductPicker"
        />
        <van-field
          label="工序"
          readonly
          is-link
          :model-value="processText || '请选择工序'"
          placeholder="请选择工序"
          @click="openProcessPicker"
        />
      </van-cell-group>

      <van-cell-group inset>
        <van-field label="数量" type="number" v-model="qtyStr" placeholder="0">
          <template #extra><span class="fs-12 text-3">件</span></template>
        </van-field>
        <van-field label="单价" type="number" v-model="priceStr" placeholder="0.00">
          <template #extra><span class="fs-12 text-3">元/件</span></template>
        </van-field>
        <van-field label="金额" readonly :model-value="amountText" />
      </van-cell-group>

      <van-cell-group inset>
        <van-field
          label="工人"
          :model-value="form.worker"
          placeholder="选填，用于按人统计"
          clearable
          @update:model-value="(v: string) => (form.worker = v)"
        />
        <div v-if="store.workerOptions.length" class="kw-wrap">
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
        <div v-if="store.workerOptions.length" class="chips">
          <span
            v-for="w in filteredWorkers"
            :key="w"
            class="chip"
            :class="{ 'is-on': form.worker === w }"
            @click="form.worker = w"
          >
            {{ w }}
          </span>
          <div v-if="!filteredWorkers.length" class="no-match">无匹配项</div>
        </div>
        <van-field label="班次">
          <template #input>
            <van-radio-group v-model="form.shift" direction="horizontal">
              <van-radio name="day">白班</van-radio>
              <van-radio name="night">夜班</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field
          label="备注"
          type="textarea"
          rows="2"
          maxlength="60"
          show-word-limit
          autosize
          v-model="form.note"
          placeholder="选填，如批次号 / 返工说明"
        />
        <van-field label="次数">
          <template #input>
            <div class="count-cell">
              <van-radio-group
                v-model="countMode"
                direction="horizontal"
                class="count-cell__modes"
                @change="onCountModeChange"
              >
                <van-radio name="auto">自动</van-radio>
                <van-radio name="manual">手动</van-radio>
              </van-radio-group>
              <div v-if="countMode === 'auto'" class="count-cell__value">{{ autoText }}</div>
              <template v-else>
                <div class="count-cell__manual">
                  <input
                    v-model="manualCountStr"
                    class="count-cell__input"
                    type="number"
                    inputmode="numeric"
                    placeholder="填次数"
                    @blur="normalizeManualCount"
                  />
                  <span class="count-cell__unit">次</span>
                </div>
                <div v-if="lastManualTip" class="count-cell__tip">{{ lastManualTip }}</div>
              </template>
            </div>
          </template>
        </van-field>
      </van-cell-group>

      <div class="submit">
        <van-button type="primary" block round size="large" :loading="saving" :disabled="saving" @click="save">
          {{ isEdit ? '保存修改' : '保存记录' }}
        </van-button>
        <van-button
          v-if="isEdit"
          class="del-btn"
          block
          round
          plain
          type="danger"
          @click="onDelete"
        >
          删除这条记录
        </van-button>
      </div>
    </div>

    <!-- 日期 -->
    <van-calendar
      v-model:show="showDate"
      :default-date="parseDate(form.date)"
      :max-date="maxDate"
      :min-date="minDate"
      color="#3B82F6"
      @confirm="onPickDate"
    />

    <!-- 产品选择 -->
    <SearchPickerSheet
      v-model:show="showProduct"
      title="选择产品"
      :options="productOptions"
      :selected="form.productId"
      @confirm="onPickProduct"
      @cancel="showProduct = false"
    />

    <!-- 工序选择（三态：已有工序 / 手动输入 / 不填） -->
    <van-popup
      v-model:show="showProcess"
      position="bottom"
      round
      :style="{ maxHeight: '78vh' }"
      :safe-area-inset-bottom="true"
    >
      <div class="pps">
        <div class="pps__head">
          <span class="pps__title">工序</span>
          <van-icon name="cross" size="18" color="#9CA3AF" @click="showProcess = false" />
        </div>

        <div class="pps__body">
          <!-- 已有工序选择 -->
          <div class="pps__block">
            <div class="pps__label">已有工序（点选自动带出单价）</div>
            <div v-if="processOptions.length" class="kw-wrap">
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
            <div v-if="processOptions.length" class="pps__list">
              <template v-if="filteredProcessOptions.length">
                <div
                  v-for="o in filteredProcessOptions"
                  :key="o.value"
                  class="pps__item"
                  :class="{ 'is-active': tmpMode === 'exist' && tmpProcessId === o.value }"
                  @click="pickExistProcess(o.value)"
                >
                  <span class="pps__text ellipsis">{{ o.text }}</span>
                  <span class="pps__sub">{{ o.sub }}</span>
                </div>
              </template>
              <div v-else class="pps__empty">无匹配项</div>
            </div>
            <div v-else class="pps__empty">该产品暂无工序，可手动输入或选择不填</div>
          </div>

          <!-- 手动输入 -->
          <div class="pps__block">
            <div class="pps__label">手动输入自定义工序</div>
            <div class="pps__manual" :class="{ 'is-on': tmpMode === 'manual' }" @click="tmpMode = 'manual'">
              <input
                v-model="tmpManualName"
                class="pps__input"
                placeholder="输入工序名称（不自动带出单价）"
                @click.stop="tmpMode = 'manual'"
              />
            </div>
          </div>

          <!-- 不填 -->
          <div class="pps__block">
            <button
              type="button"
              class="pps__none"
              :class="{ 'is-on': tmpMode === 'none' }"
              @click="tmpMode = 'none'"
            >
              不填工序（留空）
            </button>
          </div>
        </div>

        <div class="pps__foot">
          <van-button round plain block @click="showProcess = false">取消</van-button>
          <van-button round type="primary" block @click="confirmProcess">确认</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import { confirmAction } from '@/utils/dialog'
import { runGuarded } from '@/utils/async'
import type { Shift } from '@/types'
import { money, priceText, round, toNum } from '@/utils/format'
import { addDays, parseDate, todayStr, weekdayCn, friendlyDate } from '@/utils/date'
import SearchPickerSheet from '@/components/SearchPickerSheet.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const editId = computed(() => (route.params.id as string) || '')
const isEdit = computed(() => !!editId.value)

const form = reactive({
  date: todayStr(),
  productId: '',
  processId: '',
  /** 工序三态：exist=已有工序；manual=手动输入自定义工序；none=不填工序（留空） */
  processMode: 'none' as 'exist' | 'manual' | 'none',
  /** 手动输入的自定义工序名（快照来源） */
  manualProcessName: '',
  quantity: 1,
  price: 0,
  worker: store.settings.defaultWorker,
  shift: 'day' as Shift,
  note: ''
})

const qtyStr = ref('1')
const priceStr = ref('')
const saving = ref(false)

/** 次数：auto=自动实时计算；manual=手动输入 */
const countMode = ref<'auto' | 'manual'>('auto')
const manualCountStr = ref('')
const lastManualTip = ref('')

/** 自动次数：新增时 = 该产品历史记录数 + 1（第 N+1 次）；编辑时不含本条（第 N 次） */
const autoCount = computed(() => {
  if (!form.productId) return 0
  const list = store.records.filter(
    (r) => r.productId === form.productId && (isEdit.value ? r.id !== editId.value : true)
  )
  return list.length + 1
})

const autoText = computed(() => {
  if (!form.productId) return '请先选择产品'
  return `第 ${autoCount.value} 次（按该产品历史实时计算）`
})

/** 该产品最近一条手动记录的次数；无则返回 null（编辑时排除本条） */
function lastManualCountOf(): number | null {
  if (!form.productId) return null
  const list = store.records
    .filter(
      (r) =>
        r.productId === form.productId &&
        r.countMode === 'manual' &&
        (isEdit.value ? r.id !== editId.value : true)
    )
    .sort((a, b) => b.createdAt - a.createdAt)
  return list.length ? list[0].count ?? 0 : null
}

/** 切到手动模式：预填该产品上次手动次数 +1，并提示上次 */
function onCountModeChange(v: 'auto' | 'manual') {
  if (v !== 'manual') return
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

const showDate = ref(false)
const showProduct = ref(false)
const showProcess = ref(false)

const today = todayStr()
const maxDate = new Date()
const minDate = parseDate(addDays(today, -1095))

const productText = computed(() => store.productMap.get(form.productId)?.name || '')
/** 工序展示：手动输入显示自定义名；不填显示「未填工序」；已有工序按 map 解析 */
const processText = computed(() => {
  if (form.processMode === 'manual') return form.manualProcessName.trim()
  if (form.processMode === 'none') return '未填工序'
  return store.processMap.get(form.processId)?.name || ''
})
const amountText = computed(
  () => `¥${money(round((toNum(qtyStr.value) || 0) * (toNum(priceStr.value) || 0), 2))}`
)

const productOptions = computed(() =>
  store.products.map((p) => ({ text: p.name, value: p.id, sub: p.spec || '' }))
)

const processOptions = computed(() =>
  store
    .processesOfProduct(form.productId)
    .map((o) => ({ text: o.name, value: o.id, sub: `¥${priceText(o.price)}/件` }))
)

/** 工序弹层内部状态 */
const tmpMode = ref<'exist' | 'manual' | 'none'>('none')
const tmpProcessId = ref('')
const tmpManualName = ref('')
const processKw = ref('')
const filteredProcessOptions = computed(() => {
  const kw = processKw.value.trim().toLowerCase()
  if (!kw) return processOptions.value
  return processOptions.value.filter((o) => o.text.toLowerCase().includes(kw))
})

const workerKw = ref('')
const filteredWorkers = computed(() => {
  const kw = workerKw.value.trim().toLowerCase()
  if (!kw) return store.workerOptions
  return store.workerOptions.filter((w) => w.toLowerCase().includes(kw))
})

onMounted(() => {
  if (!store.ready) store.init()
  if (isEdit.value) {
    const rec = store.records.find((r) => r.id === editId.value)
    if (!rec) {
      showToast('记录不存在或已被删除')
      router.replace('/records')
      return
    }
    form.date = rec.date
    form.productId = rec.productId
    // 工序三态回显：优先快照，其次按 processId 解析
    if (rec.processId) {
      form.processMode = 'exist'
      form.processId = rec.processId
    } else if (rec.processNameSnapshot) {
      form.processMode = 'manual'
      form.manualProcessName = rec.processNameSnapshot
    } else {
      form.processMode = 'none'
    }
    form.quantity = rec.quantity
    form.price = rec.price
    form.worker = rec.worker
    form.shift = rec.shift
    form.note = rec.note
    qtyStr.value = String(rec.quantity)
    priceStr.value = String(rec.price)
    // 恢复次数：手动模式带回原次数；自动模式实时计算（编辑时不含本条）
    countMode.value = rec.countMode || 'auto'
    if (countMode.value === 'manual') {
      manualCountStr.value = rec.count != null ? String(rec.count) : ''
      lastManualTip.value = ''
    }
    return
  }

  // 从产品详情页跳转过来时，带上产品与工序
  const s = store.settings
  const qp = (route.query.productId as string) || ''
  const qo = (route.query.processId as string) || ''
  const pid0 = qp || (s.rememberLast ? s.lastProductId : '')
  const oid0 = qo || (s.rememberLast ? s.lastProcessId : '')
  if (pid0 && store.productMap.has(pid0)) {
    form.productId = pid0
    const proc = store.processMap.get(oid0)
    if (proc && proc.productId === pid0) {
      form.processId = oid0
      form.price = proc.price
      priceStr.value = String(proc.price)
    }
  }
  if (!form.worker) form.worker = s.defaultWorker
})

function onPickDate(v: Date | Date[]) {
  const d = Array.isArray(v) ? v[0] : v
  form.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
  showDate.value = false
}

function openProductPicker() {
  if (!store.products.length) {
    showToast('还没有产品，请先在产品与工序中新增')
    return
  }
  showProduct.value = true
}

function openProcessPicker() {
  if (!form.productId) {
    showToast('请先选择产品')
    return
  }
  tmpMode.value = form.processMode
  tmpProcessId.value = form.processId
  tmpManualName.value = form.manualProcessName
  processKw.value = ''
  showProcess.value = true
}

function onPickProduct(id: string) {
  if (id !== form.productId) {
    form.productId = id
    form.processId = ''
    form.processMode = 'none'
    form.manualProcessName = ''
    priceStr.value = ''
    // 换产品后，手动模式需重新按新产品查上次次数预填
    if (countMode.value === 'manual') onCountModeChange('manual')
  }
  showProduct.value = false
}

/** 弹层内点选已有工序：标记为已选，不立即回填（确认时才生效） */
function pickExistProcess(id: string) {
  tmpMode.value = 'exist'
  tmpProcessId.value = id
}

/** 确认工序选择：按三态回填表单 */
function confirmProcess() {
  if (tmpMode.value === 'manual') {
    const name = tmpManualName.value.trim()
    if (!name) {
      showToast('请输入工序名称')
      return
    }
    form.processMode = 'manual'
    form.manualProcessName = name
    form.processId = ''
  } else if (tmpMode.value === 'none') {
    form.processMode = 'none'
    form.manualProcessName = ''
    form.processId = ''
  } else {
    if (!tmpProcessId.value) {
      showToast('请选择工序或使用其他方式')
      return
    }
    form.processMode = 'exist'
    form.processId = tmpProcessId.value
    form.manualProcessName = ''
    const proc = store.processMap.get(tmpProcessId.value)
    if (proc) priceStr.value = String(proc.price)
  }
  showProcess.value = false
}

async function save() {
  if (!form.productId) return showToast('请选择产品')
  const quantity = round(toNum(qtyStr.value), 2)
  const price = round(toNum(priceStr.value), 4)
  if (!(quantity > 0)) return showToast('数量需大于 0')

  // 工序三态落库：选已有→写 processId+快照；手动输入→写快照、processId 留空；不填→两者皆空
  const isExist = form.processMode === 'exist'
  if (isExist && !form.processId) return showToast('请选择工序')
  const processId = isExist ? form.processId : ''
  const processNameSnapshot = isExist
    ? store.processMap.get(form.processId)?.name || ''
    : form.processMode === 'manual'
      ? form.manualProcessName.trim()
      : ''

  try {
    await runGuarded(saving, async () => {
      const payload = {
        date: form.date,
        productId: form.productId,
        processId,
        processNameSnapshot,
        quantity,
        price,
        worker: form.worker.trim(),
        shift: form.shift,
        note: form.note.trim(),
        countMode: countMode.value,
        count: countMode.value === 'manual' ? Math.round(toNum(manualCountStr.value) || 0) : undefined
      }
      if (isEdit.value) {
        await store.updateRecord(editId.value, payload)
        showToast('已保存')
      } else {
        await store.addRecord(payload)
        showToast('记账成功')
      }
      router.back()
    }, { label: '保存' })
  } catch (e) {
    showToast('保存失败，请重试')
  }
}

async function onDelete() {
  const ok = await confirmAction({
    title: '删除记录',
    message: '确定删除这条计件记录吗？删除后可在「数据与导出」中通过备份恢复。'
  })
  if (!ok) return
  await store.removeRecord(editId.value)
  showToast('已删除')
  router.replace('/records')
}
</script>

<style scoped>
.submit {
  padding: 4px 0 20px;
}

.del-btn {
  margin-top: 10px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 16px 2px;
}

.chip {
  font-size: 12px;
  padding: 4px 11px;
  border-radius: 14px;
  background: var(--app-card-2);
  color: var(--app-text-2);
  border: 1px solid var(--app-line);
}

.chip.is-on {
  background: var(--app-primary-weak);
  border-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 600;
}

.kw-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 16px 2px;
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
  font-size: 12px;
  color: var(--app-text-3);
  text-align: center;
  padding: 6px 0;
}

.fs-12 {
  font-size: 12px;
}

.count-cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  width: 100%;
}

.count-cell__modes {
  flex-wrap: wrap;
}

.count-cell__value {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-2);
}

.count-cell__manual {
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-cell__input {
  flex: 1;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: var(--app-card-2);
  padding: 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
  font-family: inherit;
  outline: none;
}

.count-cell__unit {
  font-size: 12px;
  color: var(--app-text-3);
}

.count-cell__tip {
  font-size: 12px;
  color: var(--app-text-3);
}

/* 工序三态弹层 */
.pps {
  display: flex;
  flex-direction: column;
  height: 72vh;
}

.pps__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
}

.pps__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.pps__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 8px;
}

.pps__block {
  margin-bottom: 14px;
}

.pps__label {
  font-size: 12px;
  color: var(--app-text-3);
  margin-bottom: 6px;
}

.pps__list {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--app-line);
  border-radius: 10px;
}

.pps__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--app-text);
  border-bottom: 1px solid var(--app-line);
}

.pps__item:last-child {
  border-bottom: none;
}

.pps__item.is-active {
  background: var(--app-primary-weak);
  color: var(--app-primary);
  font-weight: 600;
}

.pps__text {
  flex: 1;
  min-width: 0;
}

.pps__sub {
  font-size: 12px;
  color: var(--app-text-3);
  flex-shrink: 0;
}

.pps__empty {
  padding: 14px 0;
  font-size: 12px;
  color: var(--app-text-3);
  text-align: center;
}

.pps__manual {
  border: 1px solid var(--app-line);
  border-radius: 10px;
  background: var(--app-card-2);
  padding: 8px 12px;
}

.pps__manual.is-on {
  border-color: var(--app-primary);
  background: var(--app-primary-weak);
}

.pps__input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--app-text);
  font-family: inherit;
  outline: none;
}

.pps__input::placeholder {
  color: var(--app-text-3);
}

.pps__none {
  width: 100%;
  padding: 12px 0;
  border: 1px dashed var(--app-line);
  border-radius: 10px;
  background: var(--app-card-2);
  font-size: 14px;
  color: var(--app-text-2);
  font-family: inherit;
}

.pps__none.is-on {
  border-color: var(--app-primary);
  border-style: solid;
  background: var(--app-primary-weak);
  color: var(--app-primary);
  font-weight: 600;
}

.pps__foot {
  display: flex;
  gap: 10px;
  padding: 10px 16px 14px;
}

.pps__foot .van-button {
  flex: 1;
}
</style>
