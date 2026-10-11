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

    <!-- 工序选择 -->
    <SearchPickerSheet
      v-model:show="showProcess"
      title="选择工序"
      :options="processOptions"
      :selected="form.processId"
      @confirm="onPickProcess"
      @cancel="showProcess = false"
    />
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
  quantity: 1,
  price: 0,
  worker: store.settings.defaultWorker,
  shift: 'day' as Shift,
  note: ''
})

const qtyStr = ref('1')
const priceStr = ref('')
const saving = ref(false)

const showDate = ref(false)
const showProduct = ref(false)
const showProcess = ref(false)

const today = todayStr()
const maxDate = new Date()
const minDate = parseDate(addDays(today, -1095))

const productText = computed(() => store.productMap.get(form.productId)?.name || '')
const processText = computed(() => store.processMap.get(form.processId)?.name || '')
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
    form.processId = rec.processId
    form.quantity = rec.quantity
    form.price = rec.price
    form.worker = rec.worker
    form.shift = rec.shift
    form.note = rec.note
    qtyStr.value = String(rec.quantity)
    priceStr.value = String(rec.price)
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
  if (!store.processesOfProduct(form.productId).length) {
    showToast('该产品还没有工序，请先新增工序')
    return
  }
  showProcess.value = true
}

function onPickProduct(id: string) {
  if (id !== form.productId) {
    form.productId = id
    form.processId = ''
    priceStr.value = ''
  }
  showProduct.value = false
}

function onPickProcess(id: string) {
  form.processId = id
  const proc = store.processMap.get(id)
  if (proc) priceStr.value = String(proc.price)
  showProcess.value = false
}

async function save() {
  if (!form.productId) return showToast('请选择产品')
  if (!form.processId) return showToast('请选择工序')
  const quantity = round(toNum(qtyStr.value), 2)
  const price = round(toNum(priceStr.value), 4)
  if (!(quantity > 0)) return showToast('数量需大于 0')

  try {
    await runGuarded(saving, async () => {
      const payload = {
        date: form.date,
        productId: form.productId,
        processId: form.processId,
        quantity,
        price,
        worker: form.worker.trim(),
        shift: form.shift,
        note: form.note.trim()
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
</style>
