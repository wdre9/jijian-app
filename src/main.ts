import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import 'vant/lib/index.css'
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
// 原生端（Capacitor WebView）的旧 SW/缓存清理已统一收敛到
// MainActivity.clearWebViewServiceWorkerData()（原生启动时执行），
// 这里不再重复注销，避免两侧重复清理。
if (!('capacitor' in window)) {
  registerSW({ immediate: true })
}

// 移除启动闪屏
const splash = document.getElementById('splash')
if (splash) {
  splash.style.opacity = '0'
  window.setTimeout(() => splash.remove(), 260)
}
