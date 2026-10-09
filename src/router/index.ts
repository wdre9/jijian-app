import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

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
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router
