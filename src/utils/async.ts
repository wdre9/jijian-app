/* ==========================================================================
   异步兜底工具
   - withTimeout：给 Promise 加超时兜底。原生桥接（Capacitor Filesystem 等）
     偶发 Promise 悬挂时，超时后按 fallback 继续，避免 await 永远不返回导致
     防重入布尔卡死（"按钮点不动"的根因之一）。
   - runGuarded：统一写操作守卫。进入置 true、finally 复位，外层兜底定时器
     在异步悬挂时强制复位并 toast，杜绝防重入布尔永远卡 true。
   ========================================================================== */
import { showToast } from 'vant'

/** 写操作守卫对外暴露的最小形状（ref / 普通对象均可） */
export type Guard<T = boolean> = { value: T }

/**
 * 给 Promise 包超时：超时后执行 fallback()，以 fallback 的返回值继续。
 * 原 promise 无论 resolve / reject 都视为"已接管"，不再影响结果。
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: () => T | Promise<T>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        Promise.resolve(fallback()).then(resolve, reject)
      } catch (e) {
        reject(e)
      }
    }, ms)

    Promise.resolve(promise).then(
      (v) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          Promise.resolve(fallback()).then(resolve, reject)
        } catch (e) {
          reject(e)
        }
      }
    )
  })
}

export interface RunGuardedOptions {
  /** 超时提示文案前缀，默认「操作」 */
  label?: string
  /** 兜底定时器时长（毫秒），默认 5000 */
  timeoutMs?: number
}

/**
 * 统一写操作守卫：
 * - 已处于运行中（guard.value === true）时直接跳过（返回 undefined）
 * - 进入时置 true，正常 / 异常结束均复位
 * - 外层兜底定时器在超时后强制复位并 toast「{label}超时，请重试」
 * - fn 抛错会原样向上抛出，由调用方 catch 处理
 */
export async function runGuarded<T>(
  guard: Guard<boolean>,
  fn: () => Promise<T>,
  options: RunGuardedOptions = {}
): Promise<T | undefined> {
  if (guard.value) return undefined
  guard.value = true
  const label = options.label ?? '操作'
  const timeoutMs = options.timeoutMs ?? 5000
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    timer = setTimeout(() => {
      if (guard.value) {
        guard.value = false
        showToast(`${label}超时，请重试`)
      }
    }, timeoutMs)
    return await fn()
  } finally {
    if (timer) clearTimeout(timer)
    if (guard.value) guard.value = false
  }
}
