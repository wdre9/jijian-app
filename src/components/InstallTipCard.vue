<template>
  <div v-if="showInstallTip" class="tip">
    <div class="tip__icon">＋</div>
    <div class="tip__main">
      <div class="tip__title">添加到手机主屏幕</div>
      <div class="tip__desc">{{ guide.shortHint }}</div>
      <div class="tip__desc tip__desc--warn">
        数据只保存在本机浏览器，清理缓存会丢失，请定期导出备份。
      </div>
      <div class="tip__actions">
        <van-button type="primary" round size="mini" @click="openInstallGuide">查看步骤</van-button>
        <van-button plain round size="mini" @click="goBackup">去备份</van-button>
      </div>
    </div>
    <van-icon class="tip__close" name="cross" size="14" @click="onSnooze" />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  guide,
  openInstallGuide,
  showInstallTip,
  snoozeInstallTip
} from '@/utils/install'

const router = useRouter()

function goBackup() {
  router.push('/data')
}

function onSnooze() {
  snoozeInstallTip()
}
</script>

<style scoped>
.tip {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 12px;
  margin-bottom: 12px;
  border-radius: var(--app-radius);
  background: var(--app-card);
  box-shadow: var(--app-shadow);
  border-left: 3px solid var(--app-primary);
}

.tip__icon {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tip__main {
  flex: 1;
  min-width: 0;
  padding-right: 14px;
}

.tip__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
}

.tip__desc {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--app-text-3);
}

.tip__desc--warn {
  color: #ef4444;
}

.tip__actions {
  display: flex;
  gap: 8px;
  margin-top: 9px;
}

.tip__close {
  position: absolute;
  top: 9px;
  right: 10px;
  color: var(--app-text-3);
}
</style>
