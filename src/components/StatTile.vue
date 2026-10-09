<template>
  <div class="tile">
    <div class="tile__label">{{ label }}</div>
    <div class="tile__value">
      <span class="num">{{ value }}</span>
      <span v-if="unit" class="tile__unit">{{ unit }}</span>
    </div>
    <div v-if="sub" class="tile__sub">{{ sub }}</div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string | number
    unit?: string
    sub?: string
  }>(),
  { unit: '', sub: '' }
)
</script>

<style scoped>
.tile {
  flex: 1;
  min-width: 0;
  padding: 10px 4px;
  text-align: center;
}

.tile__label {
  font-size: 12px;
  color: var(--app-text-2);
  margin-bottom: 5px;
}

.tile__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
  line-height: 1.15;
}

.tile__unit {
  font-size: 11px;
  font-weight: 500;
  color: var(--app-text-2);
  margin-left: 2px;
}

.tile__sub {
  font-size: 11px;
  color: var(--app-text-3);
  margin-top: 3px;
}
</style>
