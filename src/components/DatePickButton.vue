<template>
  <div class="date-btn" @click="open">
    <van-icon name="calendar-o" size="15" />
    <span>{{ label }}</span>
  </div>

  <van-calendar
    v-model:show="show"
    :default-date="defaultDate"
    :min-date="minDate"
    :max-date="maxDate"
    :show-confirm="false"
    color="#3B82F6"
    @confirm="onConfirm"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { friendlyDate, parseDate, toDateStr, todayStr, weekdayCn } from '@/utils/date'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** 相对今天的偏移上限（不允许选未来日期） */
    maxOffset?: number
    /** 相对今天的偏移下限（允许往前选多少天） */
    minOffset?: number
  }>(),
  { maxOffset: 0, minOffset: -730 }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const show = ref(false)

const today = todayStr()
const maxDate = (() => {
  const d = parseDate(today)
  d.setDate(d.getDate() + props.maxOffset)
  return d
})()
const minDate = (() => {
  const d = parseDate(today)
  d.setDate(d.getDate() + props.minOffset)
  return d
})()

const defaultDate = computed(() => parseDate(props.modelValue || today))
const label = computed(() => `${friendlyDate(props.modelValue)} ${weekdayCn(props.modelValue)}`)

function open() {
  show.value = true
}

function onConfirm(value: Date | Date[]) {
  const d = Array.isArray(value) ? value[0] : value
  emit('update:modelValue', toDateStr(d))
  show.value = false
}
</script>

<style scoped>
.date-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 10px;
  background: var(--app-card-2);
  color: var(--app-text);
  font-size: 13px;
  font-weight: 500;
}

.date-btn:active {
  opacity: 0.75;
}
</style>
