<template>
  <div class="page">
    <div class="page__title">我的</div>

    <!-- 概览 -->
    <div class="page__inner">
      <div class="card profile">
        <div class="profile__logo">计</div>
        <div class="grow">
          <div class="bold" style="font-size: 15px">计件工资记账</div>
          <div class="fs-12 text-3 mt-8" style="margin-top: 3px">
            本地保存 {{ store.records.length }} 笔记录 · {{ store.products.length }} 个产品 ·
            {{ store.processes.length }} 道工序
          </div>
        </div>
        <van-tag round type="primary" plain>离线可用</van-tag>
      </div>

      <!-- 目标 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">目标设置</div>
        </div>
        <van-cell-group>
          <van-field
            label="默认工人"
            v-model="form.defaultWorker"
            placeholder="选填，记账时自动带入"
            clearable
          />
          <van-field label="日目标" type="number" v-model="dailyGoalStr" placeholder="0 表示不启用">
            <template #extra><span class="fs-12 text-3">元</span></template>
          </van-field>
          <van-field label="月目标" type="number" v-model="monthlyGoalStr" placeholder="0 表示不启用">
            <template #extra><span class="fs-12 text-3">元</span></template>
          </van-field>
        </van-cell-group>
      </div>

      <!-- 偏好 -->
      <div class="card">
        <div class="card__head">
          <div class="card__title">偏好</div>
        </div>
        <van-cell-group>
          <van-cell title="主题外观">
            <template #value>
              <van-radio-group v-model="theme" direction="horizontal">
                <van-radio name="light">浅色</van-radio>
                <van-radio name="dark">深色</van-radio>
                <van-radio name="auto">跟随系统</van-radio>
              </van-radio-group>
            </template>
          </van-cell>
          <van-cell title="记住上次的产品/工序" label="开启后录入更快">
            <template #right-icon>
              <van-switch v-model="rememberLast" size="20" />
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <!-- 功能入口 -->
      <van-cell-group inset>
        <van-cell title="产品与工序" is-link :value="`${store.products.length} 个产品`" @click="go('/products')" />
        <van-cell title="工人管理" is-link :value="`${store.workerOptions.length} 人`" @click="go('/workers')" />
        <van-cell title="数据与导出" is-link label="导出 Excel / 备份与还原" @click="go('/data')" />
        <van-cell title="关于" is-link label="版本信息与安装到桌面" @click="go('/about')" />
        <van-cell
          title="添加到手机主屏幕"
          is-link
          :label="installLabel"
          @click="openInstallGuide"
        />
      </van-cell-group>

      <div class="fs-12 text-3 mt-16" style="text-align: center; padding: 6px 0 10px">
        所有数据仅保存在本机浏览器中，不上传服务器
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import type { ThemeMode } from '@/types'
import { toNum } from '@/utils/format'
import { env, openInstallGuide } from '@/utils/install'

const store = useAppStore()
const router = useRouter()

/** 安装引导入口的说明文字：已安装时给出状态，否则显示当前浏览器 */
const installLabel = computed(() =>
  env.value.standalone ? '已添加到主屏幕' : `当前：${env.value.platformLabel} · ${env.value.browserLabel}`
)

const form = reactive({ defaultWorker: '' })
const dailyGoalStr = ref('0')
const monthlyGoalStr = ref('0')
const theme = ref<ThemeMode>('light')
const rememberLast = ref(true)

onMounted(async () => {
  if (!store.ready) await store.init()
  sync()
})

function sync() {
  form.defaultWorker = store.settings.defaultWorker
  dailyGoalStr.value = String(store.settings.dailyGoal || 0)
  monthlyGoalStr.value = String(store.settings.monthlyGoal || 0)
  theme.value = store.settings.theme
  rememberLast.value = store.settings.rememberLast
}

let saving = false
async function persist() {
  if (saving) return
  saving = true
  try {
    await store.updateSettings({
      defaultWorker: form.defaultWorker.trim(),
      dailyGoal: toNum(dailyGoalStr.value) || 0,
      monthlyGoal: toNum(monthlyGoalStr.value) || 0,
      theme: theme.value,
      rememberLast: rememberLast.value
    })
  } finally {
    saving = false
  }
}

watch([theme, rememberLast], persist)
watch([dailyGoalStr, monthlyGoalStr], debounce(persist, 600))
watch(
  () => form.defaultWorker,
  debounce(persist, 600)
)

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let timer: number | undefined
  return (...args: Parameters<T>) => {
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), ms)
  }
}

function go(path: string) {
  router.push(path)
}
</script>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile__logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
