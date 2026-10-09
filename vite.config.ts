import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 使用相对资源路径：部署到 GitHub Pages 的项目子路径、任意静态托管的子目录
  // 甚至本地直接打开 dist/index.html 都能正常工作，无需改配置
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '计件工资记账',
        short_name: '计件记账',
        description: '本地离线的计件工资记账工具：记账、统计、导出，一步到位',
        lang: 'zh-CN',
        theme_color: '#3B82F6',
        background_color: '#F5F7FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'es2018',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          vant: ['vant'],
          echarts: ['echarts', 'vue-echarts'],
          xlsx: ['xlsx'],
          html2canvas: ['html2canvas']
        }
      }
    }
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 }
})
