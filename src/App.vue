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
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { closeDialog, closeToast } from 'vant'
import { useAppStore } from '@/stores/app'
import AppTabBar from '@/components/AppTabBar.vue'
import InstallGuideSheet from '@/components/InstallGuideSheet.vue'
import { initInstall, env } from '@/utils/install'

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

/* ---------------- 弹窗遮罩兜底清理 ---------------- */
/** 强制关闭命令式 Dialog / Toast，避免 overlay 残留拦截整屏点击 */
function clearOverlay() {
  closeDialog()
  closeToast()
}

function onVisibilityChange() {
  // Android WebView 切后台再回前台时，清理可能残留的弹窗遮罩
  if (document.visibilityState === 'visible') {
    clearOverlay()
  }
}

onMounted(() => {
  initInstall()
  store.init()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
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
