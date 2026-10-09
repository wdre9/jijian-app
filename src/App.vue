<template>
  <van-config-provider :theme="themeName">
    <div class="app-shell">
      <div v-if="!store.ready" class="app-loading">
        <van-loading size="26" vertical>正在加载本地数据…</van-loading>
      </div>

      <template v-else>
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
        <AppTabBar v-if="showTab" />
        <InstallGuideSheet />
      </template>
    </div>
  </van-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import AppTabBar from '@/components/AppTabBar.vue'
import InstallGuideSheet from '@/components/InstallGuideSheet.vue'
import { initInstall } from '@/utils/install'

const store = useAppStore()
const route = useRoute()

const showTab = computed(() => route.meta?.tab === true)

/* ---------------- 主题 ---------------- */
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
media.addEventListener('change', (e) => {
  systemDark.value = e.matches
})

const themeName = computed<'light' | 'dark'>(() => {
  const mode = store.settings.theme
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  return systemDark.value ? 'dark' : 'light'
})

watchEffect(() => {
  const dark = themeName.value === 'dark'
  document.documentElement.classList.toggle('van-theme-dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0f141b' : '#3B82F6')
})

onMounted(() => {
  initInstall()
  store.init()
})
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--app-bg);
}

.app-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
