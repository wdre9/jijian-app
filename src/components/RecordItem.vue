<template>
  <div class="rrow" @click="onClick">
    <div class="rrow__left">
      <div class="rrow__title ellipsis">
        {{ row.productName }}
        <span class="rrow__sep">·</span>
        <span class="rrow__process">{{ row.processName }}</span>
      </div>
      <div class="rrow__meta">
        <span class="num">{{ qty(row.quantity) }} 件</span>
        <span class="dot">·</span>
        <span>¥{{ priceText(row.price) }}/件</span>
        <span v-if="row.worker" class="dot">·</span>
        <span v-if="row.worker">{{ row.worker }}</span>
        <span v-if="row.shift === 'night'" class="tag tag--night">夜班</span>
      </div>
      <div v-if="row.note" class="rrow__note ellipsis">{{ row.note }}</div>
    </div>
    <div class="rrow__right">
      <div class="rrow__amount num">+{{ money(row.amount) }}</div>
      <div class="rrow__time">{{ timeText }}</div>
    </div>
    <van-icon v-if="clickable" class="rrow__arrow" name="arrow" size="13" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { RecordRow } from '@/types'
import { money, priceText, qty } from '@/utils/format'
import { formatTime } from '@/utils/date'

const props = withDefaults(
  defineProps<{
    row: RecordRow
    clickable?: boolean
    /** 多选模式：左侧显示勾选圈，点击整行即切换选中状态 */
    selectable?: boolean
    selected?: boolean
  }>(),
  { clickable: true, selectable: false, selected: false }
)

const emit = defineEmits<{ (e: 'select'): void }>()

const router = useRouter()

const timeText = computed(() => formatTime(props.row.updatedAt || props.row.createdAt))

function onClick() {
  if (props.selectable) {
    emit('select')
    return
  }
  if (props.clickable) router.push(`/record/${props.row.id}`)
}
</script>

<style scoped>
.rrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  background: var(--app-card);
  border-bottom: 1px solid var(--app-line);
}

.rrow:active {
  background: var(--app-card-2);
}

.rrow__check {
  flex-shrink: 0;
  margin-right: 2px;
}

.rrow__left {
  flex: 1;
  min-width: 0;
}

.rrow__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.rrow__sep {
  color: var(--app-text-3);
  margin: 0 2px;
}

.rrow__process {
  color: var(--app-primary);
  font-weight: 600;
}

.rrow__meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-text-2);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.dot {
  color: var(--app-text-3);
}

.tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 5px;
  font-weight: 600;
}

.tag--night {
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.12);
}

.rrow__note {
  margin-top: 3px;
  font-size: 11px;
  color: var(--app-text-3);
}

.rrow__right {
  text-align: right;
  flex-shrink: 0;
}

.rrow__amount {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.rrow__time {
  font-size: 11px;
  color: var(--app-text-3);
  margin-top: 3px;
}

.rrow__arrow {
  color: var(--app-text-3);
  margin-left: 2px;
}
</style>
