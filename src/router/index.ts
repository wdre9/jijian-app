import { Capacitor } from '@capacitor/core'
import { createRouter, createWebHashHistory, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { closeDialog, closeToast } from 'vant'

/**
 * 使用 Hash 路由：静态托管（GitHub Pages 等）无需任何服务端 rewrite 配置，
 * 刷新页面、微信内置浏览器打开均不会 404。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { tab: true, title: '记账' }
  },
  {
    path: '/records',
    name: 'records',
    component: () => import('@/views/RecordsView.vue'),
    meta: { tab: true, title: '明细' }
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/StatsView.vue'),
    meta: { tab: true, title: '统计' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { tab: true, title: '我的' }
  },
  {
    path: '/record/new',
    name: 'record-new',
    component: () => import('@/views/RecordEditView.vue'),
    meta: { title: '新增记录' }
  },
  {
    path: '/record/:id/edit',
    name: 'record-edit',
    component: () => import('@/views/RecordEditView.vue'),
    meta: { title: '编辑记录' }
  },
  {
    path: '/record/:id',
    name: 'record-detail',
    component: () => import('@/views/RecordDetailView.vue'),
    meta: { title: '记录详情' }
  },
  {
    path: '/products',
    name: 'products',
    component: () => import('@/views/ProductsView.vue'),
    meta: { title: '产品与工序' }
  },
  {
    path: '/product/:id',
    name: 'product-detail',
    component: () => import('@/views/ProductDetailView.vue'),
    meta: { title: '产品详情' }
  },
  {
    path: '/workers',
    name: 'workers',
    component: () => import('@/views/WorkersView.vue'),
    meta: { title: '工人管理' }
  },
  {
    path: '/data',
    name: 'data',
    component: () => import('@/views/DataView.vue'),
    meta: { title: '数据与导出' }
  },
  {
    path: '/import',
    name: 'import',
    component: () => import('@/views/ImportView.vue'),
    meta: { title: '批量导入' }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  // 原生端（Capacitor WebView 以 http://localhost 提供资源）用 history 模式，避免 hash 丢失；
  // Web/PWA（GitHub Pages 等静态托管）保留 hash 模式保证刷新可用。
  history: Capacitor.isNativePlatform() ? createWebHistory() : createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

/**
 * 路由切换后统一清理命令式弹窗/轻提示：
 * Vant showConfirmDialog 挂载在 body 级 overlay（z-index 2000+），
 * 若在弹窗打开时通过底部导航等切走页面，overlay 不会自动销毁，
 * 会残留拦截整屏点击（jijian-app 偶发"按键失灵"根因之一）。
 */
router.afterEach(() => {
  closeDialog()
  closeToast()
})

export default router
