<template>
  <div class="page page--plain">
    <van-nav-bar
      title="批量导入"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <div class="page__inner pb-88">
      <!-- 解析规则说明 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">解析规则</div>
          <van-tag round plain type="primary">本地解析</van-tag>
        </div>
        <div class="fs-12 text-3 lh-18">
          · 每日首行写日期（如 <code>10.4</code>），后续行继承该日期<br />
          · 四位数 = 货号 = 产品名；货号后的中文/英文为工序（<code>+8</code> 角标忽略，无工序归"未分类"）<br />
          · 按 <code>×数量×单价=金额</code> 提取数量与单价，金额由程序重算<br />
          · 含"计时"的行自动跳过；数据全部在本机处理，不会上传
        </div>
      </div>

      <van-tabs v-model:active="activeTab" sticky offset-top="46">
        <!-- 文本粘贴 -->
        <van-tab title="粘贴文本">
          <div class="card">
            <van-field
              v-model="textInput"
              type="textarea"
              rows="10"
              autosize
              placeholder="示例：&#10;10.4&#10;5552×20×1.2=480&#10;5552+8 钻孔×30×0.8=24&#10;5553 车外圆×50×1.5=75&#10;计时 3小时&#10;10.5&#10;5552×40×1.2=48"
            />
            <div class="btns">
              <van-button type="primary" block round @click="parseFromText">解析文本</van-button>
              <van-button plain block round @click="textInput = ''">清空</van-button>
            </div>
          </div>
        </van-tab>

        <!-- 图片 OCR -->
        <van-tab title="图片识别">
          <div class="card">
            <van-uploader v-model="images" multiple :max-count="9" accept="image/*" />
            <div class="fs-12 text-3 mt-8 lh-18">
              图片仅在本机通过 tesseract.js（中文 chi_sim）识别，不出设备。
              首次使用需联网下载语言包，之后自动缓存，可离线复用。
            </div>
            <van-button
              class="mt-8"
              type="primary"
              block
              round
              :disabled="!images.length || ocrRunning"
              :loading="ocrRunning"
              @click="runOcr"
            >
              开始识别（{{ images.length }} 张）
            </van-button>
          </div>

          <div v-if="ocrStates.length" class="card">
            <div class="card__head">
              <div class="card__title">识别进度</div>
            </div>
            <div v-for="s in ocrStates" :key="s.name" class="ocr-item">
              <span class="fs-12 text-3 ocr-item__name">{{ s.name }}</span>
              <template v-if="s.state === 'working'">
                <van-progress :percentage="Math.round(s.progress * 100)" stroke-width="6" class="ocr-item__bar" />
              </template>
              <van-tag v-else-if="s.state === 'done'" type="success" plain>完成</van-tag>
              <van-tag v-else-if="s.state === 'error'" type="danger" plain>失败</van-tag>
              <van-tag v-else type="default" plain>等待</van-tag>
            </div>
          </div>

          <div v-if="ocrMergedText" class="card">
            <van-collapse v-model="ocrCollapse">
              <van-collapse-item title="查看识别文本" :name="1">
                <div class="pre-wrap">{{ ocrMergedText }}</div>
              </van-collapse-item>
            </van-collapse>
          </div>
        </van-tab>
      </van-tabs>

      <!-- 解析结果预览 -->
      <template v-if="parsed">
        <div class="card">
          <div class="card__head">
            <div class="card__title">解析预览</div>
            <van-tag round plain type="success">{{ validRows.length }} 条可导入</van-tag>
          </div>
          <div class="grid grid--3">
            <div class="gitem">
              <div class="gitem__v num">{{ validRows.length }}</div>
              <div class="gitem__l">待导入</div>
            </div>
            <div class="gitem">
              <div class="gitem__v num">¥{{ money(totalAmount) }}</div>
              <div class="gitem__l">合计金额</div>
            </div>
            <div class="gitem">
              <div class="gitem__v num">{{ skippedCount }}</div>
              <div class="gitem__l">跳过计时</div>
            </div>
          </div>
        </div>

        <div v-if="unparsed.length" class="card card--warn">
          <div class="card__head">
            <div class="card__title">未能解析 {{ unparsed.length }} 行</div>
            <van-tag round plain type="warning">已跳过</van-tag>
          </div>
          <div class="fs-12 text-3 pre-wrap">{{ unparsed.slice(0, 8).join('\n') }}</div>
        </div>

        <div v-if="!draft.length" class="card">
          <van-empty description="没有解析出可导入的记录" />
        </div>

        <div v-for="(row, i) in draft" :key="i" class="card">
          <div class="row__head">
            <span class="fs-12 text-3">{{ i + 1 }}. {{ row.raw }}</span>
            <van-icon name="delete-o" class="row__del" @click="draft.splice(i, 1)" />
          </div>
          <div class="row__grid">
            <van-field
              :model-value="row.date"
              label="日期"
              label-width="42px"
              placeholder="YYYY-MM-DD"
              @update:model-value="setStr(row, 'date', $event)"
            />
            <van-field
              :model-value="row.productCode"
              label="货号"
              label-width="42px"
              placeholder="四位货号"
              @update:model-value="setStr(row, 'productCode', $event)"
            />
            <van-field
              :model-value="row.processName"
              label="工序"
              label-width="42px"
              placeholder="未分类"
              @update:model-value="setStr(row, 'processName', $event)"
            />
            <van-field
              :model-value="row.quantity"
              type="number"
              label="件数"
              label-width="42px"
              @update:model-value="setNum(row, 'quantity', $event)"
            />
            <van-field
              :model-value="row.price"
              type="number"
              label="单价"
              label-width="42px"
              @update:model-value="setNum(row, 'price', $event)"
            />
            <van-field
              :model-value="row.amount"
              type="number"
              label="金额"
              label-width="42px"
              @update:model-value="setAmount(row, $event)"
            />
            <van-field
              :model-value="row.worker"
              label="工人"
              label-width="42px"
              placeholder="默认工人"
              @update:model-value="setStr(row, 'worker', $event)"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- 底部导入栏 -->
    <div v-if="draft.length" class="bottom-bar">
      <div class="bottom-bar__info">
        <div class="fs-12 text-3">待导入 {{ validRows.length }} 条</div>
        <div class="num">¥{{ money(totalAmount) }}</div>
      </div>
      <van-button
        type="primary"
        round
        :loading="importing"
        :disabled="!validRows.length"
        @click="confirmImport"
      >
        确认导入
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showSuccessToast, showFailToast } from 'vant'
import type { UploaderFileListItem } from 'vant'
import { useAppStore } from '@/stores/app'
import { money, round, toNum } from '@/utils/format'
import {
  ocrImage,
  parseImportText,
  releaseOcrWorker,
  setOcrLogger,
  type DraftRow
} from '@/utils/importer'

const store = useAppStore()
const router = useRouter()

const activeTab = ref(0)
const textInput = ref('')
const images = ref<UploaderFileListItem[]>([])

const ocrStates = ref<Array<{ name: string; state: 'pending' | 'working' | 'done' | 'error'; progress: number }>>([])
const ocrMergedText = ref('')
const ocrCollapse = ref<number[]>([])
const ocrRunning = ref(false)

const draft = ref<DraftRow[]>([])
const skippedCount = ref(0)
const unparsed = ref<string[]>([])
const parsed = ref(false)
const importing = ref(false)

const defaultWorker = computed(() => store.settings.defaultWorker || '')

onMounted(async () => {
  if (!store.ready) await store.init()
})

onBeforeUnmount(() => {
  void releaseOcrWorker()
})

/** 解析一段文本到预览草稿 */
function parseFromText() {
  if (!textInput.value.trim()) {
    showFailToast('请先粘贴或输入文本')
    return
  }
  applyParse(textInput.value)
}

function applyParse(text: string) {
  const res = parseImportText(text, defaultWorker.value)
  draft.value = res.rows
  skippedCount.value = res.skippedCount
  unparsed.value = res.unparsed
  parsed.value = true
}

const validRows = computed(() =>
  draft.value.filter((r) => r.date.trim() && r.productCode.trim() && r.quantity > 0)
)
const totalAmount = computed(() => validRows.value.reduce((s, r) => s + (Number(r.amount) || 0), 0))

function setStr(row: DraftRow, key: 'date' | 'productCode' | 'processName' | 'worker', v: string | number) {
  row[key] = String(v)
}
function setNum(row: DraftRow, key: 'quantity' | 'price', v: string | number) {
  row[key] = toNum(v)
  row.amount = round(row.quantity * row.price, 3)
}
function setAmount(row: DraftRow, v: string | number) {
  row.amount = round(toNum(v), 3)
}

/* ----------------------------- OCR ----------------------------- */

let ocrCursor = 0

function runOcr() {
  const files = images.value.filter((it) => it.file)
  if (!files.length) {
    showFailToast('请先选择图片')
    return
  }
  ocrStates.value = files.map((it) => ({
    name: it.file?.name || '图片',
    state: 'pending' as const,
    progress: 0
  }))
  ocrMergedText.value = ''
  ocrCursor = 0
  ocrRunning.value = true
  setOcrLogger((m) => {
    if (m.status === 'recognizing text' && ocrStates.value[ocrCursor]) {
      ocrStates.value[ocrCursor].progress = m.progress
    }
  })
  void processNextOcr()
}

async function processNextOcr() {
  if (ocrCursor >= ocrStates.value.length) {
    finishOcr()
    return
  }
  const st = ocrStates.value[ocrCursor]
  st.state = 'working'
  st.progress = 0
  const file = images.value[ocrCursor].file
  try {
    if (!file) throw new Error('缺少图片文件')
    const text = await ocrImage(file)
    ocrMergedText.value += (ocrMergedText.value ? '\n' : '') + text
    st.state = 'done'
  } catch (e) {
    st.state = 'error'
  }
  ocrCursor++
  void processNextOcr()
}

function finishOcr() {
  ocrRunning.value = false
  if (ocrMergedText.value.trim()) {
    applyParse(ocrMergedText.value)
  } else {
    showFailToast('未识别出文字，可尝试更清晰的图片')
  }
}

/* ----------------------------- 导入 ----------------------------- */

async function confirmImport() {
  const rows = validRows.value
  if (!rows.length) return
  try {
    await showConfirmDialog({
      title: '确认导入',
      message:
        `将导入 ${rows.length} 条记录，合计 ¥${money(totalAmount.value)}。\n` +
        '不存在的产品（货号）与工序将自动创建，金额按 数量×单价 三位小数存储。',
      confirmButtonText: '导入',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  importing.value = true
  try {
    if (!store.ready) await store.init()
    for (const row of rows) {
      const code = row.productCode.trim()
      let product = store.products.find((p) => p.name === code)
      if (!product) {
        product = await store.addProduct({ name: code })
      }
      const pname = row.processName.trim() || '未分类'
      let process = store.processes.find((o) => o.productId === product.id && o.name === pname)
      if (!process) {
        process = await store.addProcess({ productId: product.id, name: pname, price: row.price })
      }
      await store.addRecord({
        date: row.date.trim(),
        productId: product.id,
        processId: process.id,
        quantity: row.quantity,
        price: row.price,
        worker: row.worker.trim(),
        shift: row.shift || 'day',
        note: row.note,
        amount: row.amount
      })
    }
    showSuccessToast(`导入成功：${rows.length} 条记录`)
    resetState()
  } catch (e) {
    showFailToast(`导入失败：${e instanceof Error ? e.message : String(e)}`)
  } finally {
    importing.value = false
  }
}

function resetState() {
  draft.value = []
  skippedCount.value = 0
  unparsed.value = []
  parsed.value = false
  textInput.value = ''
  images.value = []
  ocrStates.value = []
  ocrMergedText.value = ''
  ocrRunning.value = false
}
</script>

<style scoped>
.lh-18 {
  line-height: 18px;
}

.btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.grid--3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid {
  display: grid;
  gap: 10px;
}

.gitem {
  text-align: center;
  padding: 6px 0;
}

.gitem__v {
  font-size: 16px;
  font-weight: 700;
}

.gitem__l {
  font-size: 12px;
  color: var(--van-text-color-3);
  margin-top: 2px;
}

.card--warn {
  border-color: var(--van-warning-color);
}

.ocr-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.ocr-item__name {
  max-width: 46%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.ocr-item__bar {
  flex: 1;
}

.pre-wrap {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 18px;
}

.row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--van-border-color);
  margin-bottom: 4px;
  overflow: hidden;
}

.row__head .fs-12 {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.row__del {
  flex-shrink: 0;
  color: var(--van-danger-color);
  font-size: 16px;
}

.row__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
}

.row__grid :deep(.van-cell) {
  padding: 8px 4px;
  font-size: 13px;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}

.bottom-bar__info .num {
  font-size: 16px;
  font-weight: 700;
  color: var(--van-danger-color);
}

.pb-88 {
  padding-bottom: 88px;
}
</style>
