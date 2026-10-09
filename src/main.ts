import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import 'vant/lib/index.css'

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

// 移除启动闪屏
const splash = document.getElementById('splash')
if (splash) {
  splash.style.opacity = '0'
  window.setTimeout(() => splash.remove(), 260)
}
