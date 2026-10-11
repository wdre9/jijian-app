import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 单元测试配置（A28）：独立于 vite 构建配置，避免 test 字段混入产物构建。
 * 仅覆盖纯逻辑单测（金额计算 / 迁移链），node 环境即可，不加载 Vue 插件。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
