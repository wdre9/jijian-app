<template>
  <div class="empty">
    <div class="empty__icon">
      <van-icon :name="icon" />
    </div>
    <div class="empty__text">{{ text }}</div>
    <div v-if="hint" class="empty__hint">{{ hint }}</div>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
    hint?: string
    icon?: string
  }>(),
  {
    text: '暂无数据',
    hint: '',
    icon: 'records'
  }
)
</script>

<style scoped>
.empty__hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-text-3);
  opacity: 0.85;
}
</style>
