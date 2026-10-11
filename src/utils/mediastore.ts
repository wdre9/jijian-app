/* ==========================================================================
   MediaStore 原生插件封装（仅 Android 生效）
   - Android 10+ 免任何存储权限直写公共「文档」目录，文件管理器立即可见。
   - web / 鸿蒙等其他平台 canUseMediaStore() 恒为 false，调用方自动走原有
     路径，不影响跨端格局；插件内部对 Android 9 及以下也会拒绝并回落。
   ========================================================================== */
import { Capacitor, registerPlugin } from '@capacitor/core'

export interface MediaStoreSaverPlugin {
  saveToDocuments(options: {
    base64: string
    filename: string
    mimeType?: string
    subdir?: string
  }): Promise<{ uri: string; display: string }>
  pruneDir(options: { subdir: string; prefix?: string; maxFiles?: number }): Promise<void>
}

export const MediaStoreSaver = registerPlugin<MediaStoreSaverPlugin>('MediaStoreSaver')

/** 仅 Android 原生端可用；其余平台一律 false，走原有导出路径 */
export function canUseMediaStore(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/**
 * 文本 → 纯 base64（不含 data URL 前缀）。
 * 不能用 btoa：内容含中文等非 Latin1 字符会直接抛错；FileReader 走 UTF-8 安全。
 */
export function textToBase64(text: string, mime = 'application/json'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error || new Error('文本编码失败'))
    reader.readAsDataURL(new Blob([text], { type: mime }))
  })
}
