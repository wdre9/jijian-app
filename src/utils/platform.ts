/* ==========================================================================
   运行环境识别
   仅读取 User-Agent 与媒体查询，判断当前设备平台 / 浏览器 / 是否已独立窗口运行，
   用于给出平台自适应的「添加到主屏幕」入口路径。不做任何数据写入。
   ========================================================================== */

/** 设备平台 */
export type PlatformKind = 'android' | 'ios' | 'desktop' | 'other'

/** 浏览器类型（含应用内置浏览器） */
export type BrowserKind =
  | 'chrome'
  | 'edge'
  | 'safari'
  | 'firefox'
  | 'samsung'
  | 'xiaomi'
  | 'huawei'
  | 'uc'
  | 'quark'
  | 'wechat'
  | 'qq'
  | 'inapp'
  | 'other'

export interface EnvInfo {
  platform: PlatformKind
  browser: BrowserKind
  /** 平台中文名，如「Android 手机」「iPhone / iPad」「电脑」 */
  platformLabel: string
  /** 浏览器中文名，如「Chrome 浏览器」「微信内置浏览器」 */
  browserLabel: string
  /** 是否运行在应用内置浏览器中（微信 / QQ / 钉钉 / 飞书 / 支付宝等） */
  inApp: boolean
  /** 是否已处于独立窗口模式（已添加到主屏幕 / 已安装为应用） */
  standalone: boolean
}

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
}

/** 是否已独立窗口运行（添加到主屏幕 / 安装为应用后） */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const modes = ['(display-mode: standalone)', '(display-mode: fullscreen)', '(display-mode: minimal-ui)']
    if (modes.some((m) => window.matchMedia && window.matchMedia(m).matches)) return true
  } catch {
    /* 忽略不支持 matchMedia 的环境 */
  }
  const legacy = (navigator as unknown as { standalone?: boolean }).standalone === true
  const fromApp =
    typeof document !== 'undefined' && typeof document.referrer === 'string'
      ? document.referrer.indexOf('android-app://') === 0
      : false
  return legacy || fromApp
}

function detectPlatform(s: string): { platform: PlatformKind; label: string } {
  const touch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0
  const iPadOsDesktop = /Macintosh/.test(s) && touch > 1
  if (/iPhone|iPod/.test(s) || /iPad/.test(s) || iPadOsDesktop) {
    return { platform: 'ios', label: 'iPhone / iPad' }
  }
  if (/Android|HarmonyOS|OpenHarmony/i.test(s)) {
    return { platform: 'android', label: 'Android 手机' }
  }
  if (/Windows NT|Macintosh|X11|CrOS|Linux|Ubuntu/i.test(s)) {
    return { platform: 'desktop', label: '电脑' }
  }
  return { platform: 'other', label: '当前设备' }
}

function detectBrowser(s: string): { browser: BrowserKind; label: string; inApp: boolean } {
  const at = (browser: BrowserKind, label: string, inApp = false) => ({ browser, label, inApp })
  if (!s) return at('other', '当前浏览器')

  /* --- 应用内置浏览器优先判断 --- */
  if (/MicroMessenger/i.test(s)) return at('wechat', '微信内置浏览器', true)
  if (/DingTalk/i.test(s)) return at('inapp', '钉钉内置浏览器', true)
  if (/Lark|Feishu/i.test(s)) return at('inapp', '飞书内置浏览器', true)
  if (/Weibo/i.test(s)) return at('inapp', '微博内置浏览器', true)
  if (/AlipayClient|Alipay/i.test(s)) return at('inapp', '支付宝内置浏览器', true)
  if (/\bQQ\//.test(s) && !/QQBrowser/i.test(s)) return at('qq', 'QQ 内置浏览器', true)

  /* --- 独立浏览器 --- */
  if (/QQBrowser|MQQBrowser/i.test(s)) return at('qq', 'QQ 浏览器')
  if (/UCBrowser|UBrowser|UCWEB/i.test(s)) return at('uc', 'UC 浏览器')
  if (/Quark/i.test(s)) return at('quark', '夸克浏览器')
  if (/MiuiBrowser|XiaoMi|HMSCore.*Browser/i.test(s)) return at('xiaomi', '小米浏览器')
  if (/HuaweiBrowser|HBPC|HonorBrowser/i.test(s)) return at('huawei', '华为浏览器')
  if (/SamsungBrowser/i.test(s)) return at('samsung', '三星浏览器')
  if (/EdgA?\//i.test(s) || /EdgiOS/i.test(s)) return at('edge', 'Edge 浏览器')
  if (/OPR\//i.test(s)) return at('other', 'Opera 浏览器')
  if (/Firefox|FxiOS/i.test(s)) return at('firefox', 'Firefox 浏览器')
  if (/CriOS/i.test(s)) return at('chrome', 'Chrome 浏览器')
  if (/Chrome\//i.test(s)) return at('chrome', 'Chrome 浏览器')
  if (/Safari\//i.test(s)) return at('safari', 'Safari 浏览器')
  return at('other', '当前浏览器')
}

/** 识别当前运行环境 */
export function detectEnv(): EnvInfo {
  const s = ua()
  const { platform, label: platformLabel } = detectPlatform(s)
  const { browser, label: browserLabel, inApp } = detectBrowser(s)
  return { platform, browser, platformLabel, browserLabel, inApp, standalone: isStandalone() }
}
