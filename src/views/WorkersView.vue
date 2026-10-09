<template>
  <div class="page page--plain">
    <van-nav-bar
      title="工人管理"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    >
      <template #right>
        <span class="nav-add" @click="openAdd">新增</span>
      </template>
    </van-nav-bar>

    <div class="page__inner">
      <div v-if="list.length" class="wlist">
        <van-swipe-cell v-for="w in list" :key="w.name">
          <div class="wcard">
            <div class="wavatar">{{ w.name.slice(0, 1) }}</div>
            <div class="grow">
              <div class="wcard__name">
                {{ w.name }}
                <van-tag v-if="w.name === store.settings.defaultWorker" round type="primary" plain>
                  默认
                </van-tag>
              </div>
              <div class="wcard__meta">
                {{ qty(w.quantity) }} 件 · {{ w.times }} 笔 · 最近 {{ w.lastDate ? friendlyDate(w.lastDate) : '—' }}
              </div>
            </div>
            <div class="wcard__amount num">¥{{ money(w.amount) }}</div>
          </div>
          <template #right>
            <van-button square type="danger" text="删除" class="swipe-btn" @click="askRemove(w.name)" />
          </template>
        </van-swipe-cell>
      </div>

      <EmptyState
        v-else
        icon="friends-o"
        text="还没有工人"
        hint="新增工人后可在录入时快速选择，也支持录入时直接输入姓名"
      />

      <div class="tip">
        删除工人只是从名单中移除，不会影响已有的计件记录；历史记录中的姓名仍会参与统计。
      </div>
    </div>

    <van-popup v-model:show="showAdd" position="bottom" round :style="{ paddingBottom: '20px' }">
      <div class="pop-title">新增工人</div>
      <van-cell-group inset>
        <van-field v-model="name" label="姓名" placeholder="请输入工人姓名" maxlength="12" />
      </van-cell-group>
      <div class="pop-actions">
        <van-button block round type="primary" @click="confirmAdd">确定</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useAppStore } from '@/stores/app'
import { money, qty } from '@/utils/format'
import { friendlyDate } from '@/utils/date'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const store = useAppStore()

const showAdd = ref(false)
const name = ref('')

onMounted(() => {
  if (!store.ready) store.init()
})

const list = computed(() => {
  const map = new Map<string, { quantity: number; amount: number; times: number; lastDate: string }>()
  store.records.forEach((r) => {
    const key = r.worker || '未填写'
    const cur = map.get(key) || { quantity: 0, amount: 0, times: 0, lastDate: '' }
    cur.quantity += Number(r.quantity) || 0
    cur.amount += Number(r.amount) || 0
    cur.times += 1
    if (r.date > cur.lastDate) cur.lastDate = r.date
    map.set(key, cur)
  })

  const names = new Set<string>(store.workerOptions)
  Array.from(map.keys()).forEach((n) => names.add(n))

  return Array.from(names)
    .map((n) => {
      const s = map.get(n) || { quantity: 0, amount: 0, times: 0, lastDate: '' }
      return { name: n, ...s }
    })
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
})

function openAdd() {
  name.value = ''
  showAdd.value = true
}

async function confirmAdd() {
  const n = name.value.trim()
  if (!n) return showToast('请输入姓名')
  await store.addWorker(n)
  if (!store.settings.defaultWorker) await store.updateSettings({ defaultWorker: n })
  showAdd.value = false
  showToast('已新增')
}

function askRemove(n: string) {
  const used = store.records.filter((r) => r.worker === n).length
  showConfirmDialog({
    title: '删除工人',
    message: used
      ? `「${n}」已有 ${used} 条计件记录，删除后记录仍保留，统计不受影响。确定删除吗？`
      : `确定从名单中删除「${n}」吗？`,
    confirmButtonText: '删除',
    confirmButtonColor: '#EE0A24'
  })
    .then(async () => {
      await store.removeWorker(n)
      if (store.settings.defaultWorker === n) await store.updateSettings({ defaultWorker: '' })
      showToast('已删除')
    })
    .catch(() => {})
}
</script>

<style scoped>
.nav-add {
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 600;
}

.wlist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wcard {
  display: flex;
  align-items: center;
  gap: 11px;
  background: var(--app-card);
  border-radius: var(--app-radius);
  padding: 13px 14px;
}

.wavatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(180deg, #93c5fd, #3b82f6);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wcard__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.wcard__meta {
  font-size: 11px;
  color: var(--app-text-3);
  margin-top: 4px;
}

.wcard__amount {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-text);
}

.swipe-btn {
  height: 100%;
}

.pop-title {
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  padding: 16px 0 12px;
}

.pop-actions {
  padding: 14px 16px 0;
}

.tip {
  font-size: 12px;
  color: var(--app-text-3);
  line-height: 1.7;
  padding: 14px 4px 10px;
}
</style>
