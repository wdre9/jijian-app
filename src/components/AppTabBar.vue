<template>
  <nav class="tabbar">
    <router-link
      v-for="t in tabs"
      :key="t.path"
      :to="t.path"
      class="tabbar__item"
      :class="{ 'is-active': active(t.path) }"
    >
      <van-icon :name="active(t.path) ? t.iconActive : t.icon" :size="21" />
      <span class="tabbar__label">{{ t.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { path: '/', label: '记账', icon: 'edit', iconActive: 'edit' },
  { path: '/records', label: '明细', icon: 'orders-o', iconActive: 'orders' },
  { path: '/stats', label: '统计', icon: 'bar-chart-o', iconActive: 'bar-chart' },
  { path: '/settings', label: '我的', icon: 'user-o', iconActive: 'user' }
]

function active(path: string): boolean {
  const cur = route.path
  if (path === '/') return cur === '/'
  return cur === path || cur.startsWith(path + '/')
}
</script>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  height: calc(56px + var(--app-safe-bottom));
  padding-bottom: var(--app-safe-bottom);
  background: var(--app-card);
  border-top: 1px solid var(--app-line);
  box-shadow: 0 -2px 14px rgba(17, 24, 39, 0.05);
}

.tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--app-text-3);
  text-decoration: none;
  transition: color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.tabbar__item.is-active {
  color: var(--app-primary);
}

.tabbar__label {
  font-size: 11px;
  line-height: 1;
}
</style>
