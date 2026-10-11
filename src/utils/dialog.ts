/* ==========================================================================
   统一弹窗封装
   - confirmAction：确认弹窗。强制 closeOnClickOverlay: true + closeOnPopstate: true，
     避免命令式 Dialog 在路由切换 / 返回键触发后 overlay 残留在 body 上拦截全屏点击
     （这是 jijian-app 偶发"按键失灵"的核心根因之一）。
     确认回调统一在弹窗关闭之后执行，保证组件卸载时序安全。
   - alertAction：信息提示弹窗，同样强制遮罩可关、返回键可关。
   ========================================================================== */
import { showConfirmDialog, showDialog } from 'vant'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmButtonText?: string
  cancelButtonText?: string
  confirmButtonColor?: string
  /** 是否允许点击遮罩关闭弹窗（默认 true，防止遮罩残留） */
  closeOnClickOverlay?: boolean
}

export interface ConfirmActionOptions extends ConfirmOptions {
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}

/** 统一确认弹窗：返回 true=用户确认（回调已执行完），false=取消/遮罩关闭/返回键关闭 */
export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  let confirmed = false
  try {
    await showConfirmDialog({
      title: options.title,
      message: options.message,
      confirmButtonText: options.confirmButtonText,
      cancelButtonText: options.cancelButtonText,
      confirmButtonColor: options.confirmButtonColor,
      closeOnClickOverlay: options.closeOnClickOverlay ?? true,
      closeOnPopstate: true
    })
    confirmed = true
  } catch {
    confirmed = false
  }
  if (confirmed) {
    try {
      await options.onConfirm?.()
    } catch (e) {
      // 组件可能已卸载（回调访问已卸载状态时兜底），避免未捕获异常击穿调用栈
      console.warn('[dialog] onConfirm 回调执行异常', e)
    }
  } else {
    try {
      options.onCancel?.()
    } catch (e) {
      console.warn('[dialog] onCancel 回调执行异常', e)
    }
  }
  return confirmed
}

/** 统一信息提示弹窗：关闭后 Promise resolve（遮罩/返回键也可关闭） */
export async function alertAction(options: ConfirmOptions): Promise<void> {
  try {
    await showDialog({
      title: options.title,
      message: options.message,
      confirmButtonText: options.confirmButtonText,
      closeOnClickOverlay: options.closeOnClickOverlay ?? true,
      closeOnPopstate: true
    })
  } catch {
    // 用户通过遮罩/返回键关闭同样视为已读，不抛错
  }
}
