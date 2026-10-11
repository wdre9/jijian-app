import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import 'vant/lib/index.css'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'

import App from './App.vue'
import router from './router'
import './plugins/echarts'
import './styles/theme.css'
import './styles/global.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Vant)

app.mount('#app')

// PWA Service Worker 仅在网页端注册。
// 原生端（Capacitor WebView）不需要 PWA：覆盖安装后旧 SW 仍会接管首次加载，
// 命中旧缓存（v1.2.4/v1.2.5）导致首帧交互被吞一次（“覆盖安装后首次进入点不动”），
// 因此原生端主动注销旧 SW 并清空缓存，保证始终加载新包资源。
if (Capacitor.isNativePlatform()) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister())
    })
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((k) => caches.delete(k))
    })
  }
} else {
  registerSW({ immediate: true })
}

// 移除启动闪屏
const splash = document.getElementById('splash')
if (splash) {
  splash.style.opacity = '0'
  window.setTimeout(() => splash.remove(), 260)
}
