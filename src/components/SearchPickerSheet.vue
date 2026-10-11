<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    :style="{ maxHeight: '78vh' }"
    :safe-area-inset-bottom="true"
  >
    <div class="sps">
      <div class="sps__head">
        <span class="sps__title">{{ title }}</span>
        <van-icon name="cross" size="18" color="#9CA3AF" @click="cancel" />
      </div>

      <div class="sps__search">
        <van-search
          v-model="keyword"
          placeholder="搜索名称 / 编号"
          shape="round"
          background="transparent"
        />
      </div>

      <div class="sps__list" ref="listEl">
        <div
          v-for="(opt, idx) in filtered"
          :key="opt.value"
          :id="`sps-item-${idx}`"
          class="sps__item"
          :class="{ 'is-active': opt.value === current }"
          @click="current = opt.value"
        >
          <div class="sps__main">
            <div class="sps__text ellipsis">{{ opt.text }}</div>
            <div v-if="opt.sub" class="sps__sub ellipsis">{{ opt.sub }}</div>
          </div>
          <van-icon v-if="opt.value === current" name="success" size="18" color="var(--app-primary)" />
        </div>
        <div v-if="!filtered.length" class="sps__empty">无匹配项</div>
      </div>

      <div class="sps__foot">
        <van-button round plain block @click="cancel">取消</van-button>
        <van-button round type="primary" block @click="confirm">确认</van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  title: string
  options: Array<{ text: string; value: string; sub?: string }>
  selected?: string
}>()

const emit = defineEmits<{
  'update:show': [v: boolean]
  confirm: [value: string]
  cancel: []
}>()

const visible = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v)
})

const keyword = ref('')
const current = ref('')
const listEl = ref<HTMLElement | null>(null)

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.options
  return props.options.filter((o) => `${o.text} ${o.sub || ''}`.toLowerCase().includes(kw))
})

function scrollToCurrent() {
  nextTick(() => {
    const el = listEl.value
    if (!el) return
    const idx = filtered.value.findIndex((o) => o.value === current.value)
    if (idx < 0) return
    const target = document.getElementById(`sps-item-${idx}`)
    if (!target) return
    el.scrollTop = Math.max(0, target.offsetTop - el.clientHeight / 2 + target.clientHeight / 2)
  })
}

watch(
  () => props.show,
  (v) => {
    if (!v) return
    keyword.value = ''
    current.value = props.selected || ''
    scrollToCurrent()
  }
)

watch(
  () => props.options,
  () => {
    if (props.show) scrollToCurrent()
  }
)

function cancel() {
  emit('cancel')
}

function confirm() {
  emit('confirm', current.value)
}
</script>

<style scoped>
.sps {
  display: flex;
  flex-direction: column;
  max-height: 78vh;
  background: var(--app-card);
}

.sps__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 4px;
}

.sps__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.sps__search {
  padding: 4px 12px 6px;
}

.sps__search :deep(.van-search) {
  padding: 0;
}

.sps__list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 4px 12px 8px;
}

.sps__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 10px;
  border-radius: 10px;
}

.sps__item.is-active {
  background: var(--app-primary-weak);
}

.sps__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sps__text {
  font-size: 15px;
  color: var(--app-text);
  font-weight: 500;
}

.sps__item.is-active .sps__text {
  color: var(--app-primary);
  font-weight: 600;
}

.sps__sub {
  font-size: 12px;
  color: var(--app-text-3);
}

.sps__empty {
  padding: 28px 0;
  text-align: center;
  font-size: 13px;
  color: var(--app-text-3);
}

.sps__foot {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + var(--app-safe-bottom));
  border-top: 1px solid var(--app-line);
}
</style>
