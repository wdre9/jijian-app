<template>
  <div class="seg">
    <button
      v-for="o in options"
      :key="o.value"
      class="seg__item"
      :class="{ 'is-active': o.value === modelValue }"
      type="button"
      @click="emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
interface Option {
  label: string
  value: string
}

defineProps<{
  modelValue: string
  options: Option[]
}>()

// 使用宽松的出参类型，方便上层以联合类型（如 'day' | 'night'）双向绑定
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emit = defineEmits<{ (e: 'update:modelValue', value: any): void }>()
</script>

<style scoped>
.seg {
  display: flex;
  padding: 3px;
  background: var(--app-card-2);
  border-radius: 11px;
  gap: 3px;
}

.seg__item {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--app-text-2);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 4px;
  border-radius: 9px;
  transition: all 0.16s ease;
  font-family: inherit;
}

.seg__item.is-active {
  background: var(--app-card);
  color: var(--app-primary);
  font-weight: 700;
  box-shadow: 0 1px 6px rgba(17, 24, 39, 0.08);
}
</style>
