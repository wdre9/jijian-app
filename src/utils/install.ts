/* ==========================================================================
   「添加到主屏幕」引导
   按平台与浏览器给出正确的入口路径与文案，并统一管理引导的显示偏好、
   浏览器原生安装事件、以及最近一次导出备份的时间（仅界面提示，不动业务数据）。
   ========================================================================== */

import { computed, ref } from 'vue'
import { detectEnv, type EnvInfo } from './platform'

export interface GuideStep {
  title: string
  desc: string
}

export interface InstallGuide {
  /** 当前环境标签，如「Android 手机 · Chrome 浏览器」 */
  envLabel: string
  /** 一句话结论 */
  summary: string
  /** 首页提示卡片上的一行说明 */
  shortHint: string
  /** 是否需要更换浏览器后才能添加 */
  needSwitch: boolean
  /** 推荐使用的浏览器 */
  recommend: string
  steps: GuideStep[]
  tips: string[]
}

/* ------------------------------ 当前环境 ------------------------------ */

export const env = ref<EnvInfo>(detectEnv())

export function refreshEnv(): void {
  env.value = detectEnv()
}

export const guide = computed<InstallGuide>(() => buildGuide(env.value))

/* ------------------------------ 引导弹层显隐 ------------------------------ */

export const installGuideVisible = ref(false)

export function openInstallGuide(): void {
  installGuideVisible.value = true
}

export function closeInstallGuide(): void {
  installGuideVisible.value = false
}

/* ------------------------------ 界面偏好 ------------------------------ */

const PREF_KEY = 'jijian:ui-prefs'

interface UiPrefs {
  /** 永久不再提示安装引导 */
  installTipDismissed: boolean
  /** 「稍后提示」的截止时间戳 */
  installTipSnoozeUntil: number
  /** 最近一次导出备份的时间戳，0 表示从未备份 */
  lastBackupAt: number
}

const DEFAULT_PREFS: UiPrefs = {
  installTipDismissed: false,
  installTipSnoozeUntil: 0,
  lastBackupAt: 0
}

function readPrefs(): UiPrefs {
  try {
    const raw = window.localStorage.getItem(PREF_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UiPrefs>) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

const prefs = ref<UiPrefs>(readPrefs())

function savePrefs(): void {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs.value))
  } catch {
    /* 隐私模式等场景写入失败时忽略，仅本次会话有效 */
  }
}

export const installTipDismissed = computed(() => prefs.value.installTipDismissed)

export const lastBackupAt = computed(() => prefs.value.lastBackupAt)

/** 是否需要在首页显示安装 / 备份提示卡片 */
export const showInstallTip = computed(() => {
  if (env.value.standalone) return false
  if (prefs.value.installTipDismissed) return false
  return Date.now() >= prefs.value.installTipSnoozeUntil
})

/** 距离上次备份超过 7 天（或从未备份）时提醒 */
export const needBackupReminder = computed(() => {
  const at = prefs.value.lastBackupAt
  if (!at) return true
  return Date.now() - at > 7 * 86400000
})

/** 最近备份时间的中文描述，从未备份时返回空串 */
export function backupStatusText(): string {
  const at = prefs.value.lastBackupAt
  if (!at) return ''
  const d = new Date(at)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const days = Math.floor((Date.now() - at) / 86400000)
  if (days <= 0) return `今天（${stamp}）`
  if (days === 1) return `昨天（${stamp}）`
  return `${days} 天前（${stamp}）`
}

/** 稍后提示（默认 3 天） */
export function snoozeInstallTip(days = 3): void {
  prefs.value = { ...prefs.value, installTipSnoozeUntil: Date.now() + days * 86400000 }
  savePrefs()
}

/** 不再提示 */
export function dismissInstallTipForever(): void {
  prefs.value = { ...prefs.value, installTipDismissed: true }
  savePrefs()
}

/** 记录一次成功导出备份 */
export function markBackedUp(): void {
  prefs.value = { ...prefs.value, lastBackupAt: Date.now() }
  savePrefs()
}

/* ------------------------------ 浏览器原生安装 ------------------------------ */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: InstallPromptEvent | null = null

/** Chromium 内核浏览器是否已抛出可直接触发的安装事件 */
export const installPromptReady = ref(false)

/** 触发浏览器原生安装（可用时返回 true） */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  const evt = deferredPrompt
  deferredPrompt = null
  installPromptReady.value = false
  try {
    await evt.prompt()
    const choice = await evt.userChoice
    return choice?.outcome === 'accepted'
  } catch {
    return false
  }
}

/** 应用启动时调用一次：监听安装事件与显示模式变化 */
export function initInstall(): void {
  refreshEnv()

  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as InstallPromptEvent
    installPromptReady.value = true
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installPromptReady.value = false
    dismissInstallTipForever()
    refreshEnv()
  })

  try {
    const mql = window.matchMedia('(display-mode: standalone)')
    if (mql && typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', refreshEnv)
    }
  } catch {
    /* 忽略 */
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshEnv()
  })
}

/* ------------------------------ 网址复制 ------------------------------ */

export function currentUrl(): string {
  if (typeof window === 'undefined') return 'https://wdre9.github.io/jijian-pwa/'
  return window.location.href
}

export async function copyCurrentUrl(): Promise<boolean> {
  const url = currentUrl()
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch {
    /* 降级到 execCommand */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = url
    ta.setAttribute('readonly', 'readonly')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/* ------------------------------ 引导内容 ------------------------------ */

export function buildGuide(info: EnvInfo): InstallGuide {
  const envLabel = `${info.platformLabel} · ${info.browserLabel}`
  const isIos = info.platform === 'ios'
  const isAndroid = info.platform === 'android'
  const isDesktop = info.platform === 'desktop'
  const isChromium = info.browser === 'chrome' || info.browser === 'edge'

  /* ---------- 应用内置浏览器（微信 / QQ / 钉钉 / 飞书 / 支付宝等） ---------- */
  if (info.inApp) {
    const recommend = isIos ? 'Safari' : 'Chrome'
    return {
      envLabel,
      needSwitch: true,
      recommend,
      summary: `${info.browserLabel}无法把网页添加到主屏幕，请先用 ${recommend} 打开本页，再执行添加。`,
      shortHint: `请改用 ${recommend} 浏览器打开`,
      steps: [
        {
          title: '点开右上角「…」菜单',
          desc: `当前是${info.browserLabel}，先点开页面右上角的「…」或「⋯」菜单。`
        },
        {
          title: '选择「在浏览器打开」',
          desc: '菜单里选择「在浏览器打开 / 在默认浏览器打开」；若没有这一项，先点「复制链接」。'
        },
        {
          title: `用 ${recommend} 打开本页`,
          desc: isIos
            ? '打开手机上的 Safari，把网址粘贴到地址栏后访问。'
            : '打开手机上的 Chrome，把网址粘贴到地址栏后访问。'
        },
        {
          title: '按对应步骤添加到主屏幕',
          desc: isIos
            ? '在 Safari 底部点「分享」按钮，选择「添加到主屏幕」。'
            : '在 Chrome 右上角「⋮」菜单里选择「添加到主屏幕」。'
        }
      ],
      tips: [
        '微信 / QQ 等内置浏览器里没有独立窗口，也无法生成桌面图标，不推荐作为日常使用方式。',
        `本应用网址：${currentUrl()}（可用下方按钮一键复制）`
      ]
    }
  }

  /* ---------- iPhone / iPad：仅 Safari 可添加 ---------- */
  if (isIos && info.browser === 'safari') {
    return {
      envLabel,
      needSwitch: false,
      recommend: 'Safari',
      summary: '在 Safari 点底部的「分享」按钮，选择「添加到主屏幕」即可安装到桌面。',
      shortHint: 'Safari「分享」按钮 → 添加到主屏幕',
      steps: [
        {
          title: '点底部的「分享」按钮',
          desc: '在 Safari 底部（iPad 在顶部）点中间的分享按钮：方框内一个向上箭头。'
        },
        {
          title: '选择「添加到主屏幕」',
          desc: '在分享面板中向下滑动，点击「添加到主屏幕」；iOS 17 起也可在「编辑操作」里把该选项加到列表。'
        },
        {
          title: '点右上角「添加」',
          desc: '确认名称后点「添加」，桌面就会出现应用图标。'
        }
      ],
      tips: [
        'iPhone / iPad 上只有 Safari 支持把网页添加到主屏幕，Chrome、微信等都不行。',
        '添加后从桌面图标启动：全屏显示、可离线使用，体验接近原生应用。'
      ]
    }
  }

  if (isIos) {
    return {
      envLabel,
      needSwitch: true,
      recommend: 'Safari',
      summary: `${info.browserLabel}无法添加到主屏幕，请复制网址后用 Safari 打开再添加。`,
      shortHint: '复制网址 → 用 Safari 打开 → 添加到主屏幕',
      steps: [
        { title: '复制当前网址', desc: '点下方「复制应用网址」按钮，或长按地址栏复制网址。' },
        { title: '用 Safari 打开', desc: '打开 iPhone / iPad 上的 Safari，把网址粘贴到地址栏并访问。' },
        {
          title: '点「分享」→「添加到主屏幕」',
          desc: '在 Safari 底部分享按钮里选择「添加到主屏幕」。'
        },
        { title: '点右上角「添加」', desc: '确认后桌面出现图标，之后从图标启动即可。' }
      ],
      tips: ['iOS 上的浏览器都基于 WebKit，但只有 Safari 本身支持「添加到主屏幕」。']
    }
  }

  /* ---------- Android ---------- */
  if (isAndroid) {
    if (info.browser === 'chrome') {
      return {
        envLabel,
        needSwitch: false,
        recommend: 'Chrome',
        summary: '在 Chrome 右上角「⋮」菜单里选择「添加到主屏幕」，即可装到手机桌面。',
        shortHint: 'Chrome 右上角「⋮」→ 添加到主屏幕',
        steps: [
          { title: '点右上角的「⋮」菜单', desc: '在 Chrome 右上角点击三个点。' },
          {
            title: '选择「添加到主屏幕」',
            desc: '在菜单里向下滑动，点击「添加到主屏幕」；部分版本显示为「安装应用」或「添加到主屏幕并创建快捷方式」。'
          },
          { title: '点「添加 / 安装」确认', desc: '在弹窗里点「添加」，桌面就会出现应用图标。' }
        ],
        tips: [
          '若菜单里没有这一项：把页面下拉刷新、等页面完全加载后再打开菜单重试。',
          '页面顶部若出现「安装应用」提示条，直接点「安装」效果相同。',
          '添加后从桌面图标启动：全屏无地址栏、断网也能继续记账。'
        ]
      }
    }

    if (info.browser === 'edge' || info.browser === 'samsung') {
      return {
        envLabel,
        needSwitch: false,
        recommend: 'Chrome',
        summary: `在${info.browserLabel}的菜单里选择「添加到主屏幕 / 安装应用」即可；若没有该选项，改用 Chrome 添加。`,
        shortHint: '浏览器菜单 → 添加到主屏幕（推荐 Chrome）',
        steps: [
          { title: '打开浏览器菜单', desc: `在${info.browserLabel}右上角或底部点开「⋮ / ≡」菜单。` },
          {
            title: '选择「添加到主屏幕 / 安装应用」',
            desc: '不同浏览器名称略有差异，也可能是「添加到桌面」「添加书签到主屏幕」。'
          },
          { title: '确认添加', desc: '按提示确认后，桌面会出现应用图标。' }
        ],
        tips: ['若菜单里找不到相关选项，请改用 Chrome 浏览器打开本页后再添加。']
      }
    }

    return {
      envLabel,
      needSwitch: false,
      recommend: 'Chrome',
      summary: `在${info.browserLabel}的菜单里找「添加到主屏幕 / 安装应用」；找不到时请改用 Chrome 打开本页添加。`,
      shortHint: '浏览器菜单 → 添加到主屏幕（推荐 Chrome）',
      steps: [
        { title: '打开浏览器菜单', desc: `在${info.browserLabel}里点开「⋮ / ≡ / 更多」菜单。` },
        {
          title: '选择「添加到主屏幕」',
          desc: '部分浏览器显示为「安装应用」「添加到桌面」「添加书签到主屏幕」。'
        },
        { title: '确认添加', desc: '按提示确认，桌面会出现应用图标。' }
      ],
      tips: [
        'UC、夸克、小米、华为等浏览器对 PWA 支持不一：推荐用 Chrome 打开本页再添加，离线能力与稳定性最好。'
      ]
    }
  }

  /* ---------- 桌面浏览器 ---------- */
  if (isDesktop) {
    if (isChromium) {
      const isEdge = info.browser === 'edge'
      return {
        envLabel,
        needSwitch: false,
        recommend: isEdge ? 'Edge' : 'Chrome',
        summary: isEdge
          ? '在 Edge 里点地址栏的「应用可用」图标，或从「… → 应用」菜单把本页安装为桌面应用。'
          : '在 Chrome 里点地址栏右侧的安装图标，或从「⋮」菜单把本页安装为桌面应用。',
        shortHint: isEdge
          ? '地址栏「应用可用」图标 / 「…」→ 应用'
          : '地址栏安装图标 / 「⋮」→ 安装页面为应用',
        steps: isEdge
          ? [
              {
                title: '看地址栏右侧图标',
                desc: '地址栏右侧出现「应用可用」图标（小方块加加号）时，直接点击它。'
              },
              { title: '或用「…」菜单', desc: '点右上角「…」→「应用」→「将此站点安装为应用」。' },
              { title: '确认安装', desc: '在弹窗里点「安装」，之后可从开始菜单或桌面启动本应用。' }
            ]
          : [
              {
                title: '看地址栏右侧图标',
                desc: '地址栏右侧出现安装图标（显示器加箭头 / 加号）时，直接点击它。'
              },
              {
                title: '或用「⋮」菜单',
                desc: '点右上角「⋮」→「投放、保存和分享 → 安装页面为应用」；部分版本在「更多工具 → 创建快捷方式」。'
              },
              { title: '确认安装', desc: '在弹窗里点「安装」，桌面与开始菜单会出现本应用。' }
            ],
        tips: [
          '需要 Chrome / Edge 桌面版；IE 与部分国产双核浏览器不支持安装为应用。',
          '电脑端适合查看报表与导出数据，日常记账建议在手机上添加到主屏幕。'
        ]
      }
    }

    return {
      envLabel,
      needSwitch: true,
      recommend: 'Chrome 或 Edge',
      summary: `${info.browserLabel}不支持把网页安装为桌面应用，请改用 Chrome 或 Edge 打开本页。`,
      shortHint: '请改用 Chrome / Edge 打开',
      steps: [
        { title: '复制当前网址', desc: '点下方「复制应用网址」按钮。' },
        { title: '用 Chrome 或 Edge 打开', desc: '在电脑上打开 Chrome / Edge，把网址粘贴到地址栏并访问。' },
        {
          title: '在地址栏或菜单里安装',
          desc: '点地址栏右侧的安装图标，或从「⋮ / …」菜单选择「安装页面为应用 / 将此站点安装为应用」。'
        }
      ],
      tips: ['macOS 的 Safari 只能「添加到程序坞」，独立窗口与离线能力有限，建议改用 Chrome。']
    }
  }

  /* ---------- 其它设备兜底 ---------- */
  return {
    envLabel,
    needSwitch: false,
    recommend: 'Chrome 或 Safari',
    summary: '请用手机浏览器打开本页：Android 用 Chrome、iPhone / iPad 用 Safari，再从菜单里「添加到主屏幕」。',
    shortHint: '手机 Chrome / Safari → 添加到主屏幕',
    steps: [
      { title: '用手机浏览器打开本页', desc: 'Android 推荐 Chrome，iPhone / iPad 推荐 Safari。' },
      {
        title: '找到「添加到主屏幕」',
        desc: 'Android：右上角「⋮」菜单；iPhone / iPad：底部的「分享」按钮。'
      },
      { title: '确认添加', desc: '桌面出现图标后，从图标启动即可全屏使用。' }
    ],
    tips: ['全部数据只保存在本机浏览器中，请定期导出备份。']
  }
}
