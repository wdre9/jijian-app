<template>
  <van-popup
    v-model:show="visible"
    position="bottom"
    round
    closeable
    :style="{ maxHeight: '88%' }"
  >
    <div class="guide">
      <div class="guide__head">
        <div class="guide__title">添加到主屏幕</div>
        <div class="guide__env">{{ guide.envLabel }}</div>
      </div>

      <div class="guide__body">
        <div class="guide__summary">{{ guide.summary }}</div>

        <div v-if="guide.needSwitch" class="switch">
          <van-icon name="info-o" size="14" />
          <span>请改用 <b>{{ guide.recommend }}</b> 浏览器打开本页后再添加。</span>
        </div>

        <div class="steps">
          <div v-for="(s, i) in guide.steps" :key="i" class="step">
            <div class="step__no">{{ i + 1 }}</div>
            <div class="step__body">
              <div class="step__t">{{ s.title }}</div>
              <div class="step__d">{{ s.desc }}</div>
            </div>
          </div>
        </div>

        <div v-if="guide.tips.length" class="tips">
          <div v-for="(t, i) in guide.tips" :key="i" class="tips__item">{{ t }}</div>
        </div>

        <div class="backup">
          <div class="backup__t">数据备份提醒</div>
          <div class="backup__d">
            全部数据只保存在本机浏览器（IndexedDB）中，清理缓存或站点数据可能一并清除且无法恢复。
            <template v-if="backupText">最近一次备份：{{ backupText }}。</template>
            <template v-else>目前还没有导出过备份，建议现在导出一份。</template>
          </div>
        </div>
      </div>

      <div class="guide__foot">
        <van-button v-if="installPromptReady" type="primary" block round size="small" @click="onInstall">
          立即安装
        </van-button>
        <van-button v-else type="primary" block round size="small" @click="onCopy">
          复制应用网址
        </van-button>
        <div class="guide__links">
          <span @click="goBackup">去导出备份</span>
          <i></i>
          <span @click="onSnooze">暂不提示</span>
          <i></i>
          <span @click="onNever">不再提示</span>
        </div>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  backupStatusText,
  closeInstallGuide,
  copyCurrentUrl,
  dismissInstallTipForever,
  guide,
  installGuideVisible,
  installPromptReady,
  promptInstall,
  snoozeInstallTip
} from '@/utils/install'

const router = useRouter()

const visible = computed({
  get: () => installGuideVisible.value,
  set: (v: boolean) => {
    installGuideVisible.value = v
  }
})

const backupText = computed(() => backupStatusText())

async function onInstall() {
  const accepted = await promptInstall()
  if (accepted) {
    showToast('已开始安装')
    closeInstallGuide()
  } else {
    showToast('未完成安装，可按下方步骤手动添加')
  }
}

async function onCopy() {
  const ok = await copyCurrentUrl()
  showToast(ok ? '网址已复制，粘贴到浏览器打开' : '复制失败，请手动复制地址栏网址')
}

function goBackup() {
  closeInstallGuide()
  router.push('/data')
}

function onSnooze() {
  snoozeInstallTip()
  closeInstallGuide()
  showToast('3 天内不再提示')
}

function onNever() {
  dismissInstallTipForever()
  closeInstallGuide()
  showToast('已关闭安装提示')
}
</script>

<style scoped>
.guide {
  padding: 16px 16px calc(16px + var(--app-safe-bottom));
  max-height: 88vh;
  overflow-y: auto;
  background: var(--app-card);
}

.guide__head {
  padding-right: 24px;
}

.guide__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--app-text);
}

.guide__env {
  margin-top: 3px;
  font-size: 12px;
  color: var(--app-text-3);
}

.guide__body {
  margin-top: 12px;
}

.guide__summary {
  font-size: 13px;
  line-height: 1.6;
  color: var(--app-text-2);
}

.switch {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
  padding: 9px 10px;
  border-radius: var(--app-radius-sm);
  background: rgba(59, 130, 246, 0.1);
  color: var(--app-primary);
  font-size: 12px;
  line-height: 1.55;
}

.steps {
  margin-top: 14px;
}

.step {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
}

.step__no {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--app-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.step__body {
  flex: 1;
  min-width: 0;
}

.step__t {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.step__d {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--app-text-3);
  word-break: break-all;
}

.tips {
  padding: 10px;
  border-radius: var(--app-radius-sm);
  background: var(--app-card-2);
}

.tips__item {
  font-size: 12px;
  line-height: 1.65;
  color: var(--app-text-2);
  word-break: break-all;
}

.backup {
  margin-top: 12px;
  padding: 10px;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--app-line);
}

.backup__t {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
}

.backup__d {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--app-text-3);
}

.guide__foot {
  margin-top: 16px;
}

.guide__links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--app-text-3);
}

.guide__links i {
  width: 1px;
  height: 10px;
  background: var(--app-line);
}
</style>
