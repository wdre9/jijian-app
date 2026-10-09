/**
 * OCR 统一入口（utils/ocr.ts）
 *
 * 平台分流：
 * - 原生 App（Capacitor）：@capacitor-mlkit/text-recognition，ML Kit 中文模型随包打包，全离线；
 * - Web / PWA：tesseract.js chi_sim，首次使用联网下载语言包后缓存（IndexedDB），后续离线可用。
 *
 * 上层（导入视图等）只依赖本模块的 recognizeImage / preloadOcr / releaseOcr / isNativeOcr，
 * 不感知底层引擎差异。
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Script, TextRecognition } from '@capacitor-mlkit/text-recognition'
import * as Tesseract from 'tesseract.js'

/** 识别进度回调（Web 端 tesseract 进度；原生端为整体阶段提示） */
export interface OcrProgress {
  status: string
  /** 0-1，可能缺省 */
  progress?: number
}

export function isNativeOcr(): boolean {
  return Capacitor.isNativePlatform()
}

/* ----------------------------- Web：tesseract.js ----------------------------- */

let workerPromise: Promise<Tesseract.Worker> | null = null
let progressHandler: ((m: OcrProgress) => void) | null = null

function setProgress(p: OcrProgress): void {
  progressHandler?.(p)
}

async function getTesseractWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('chi_sim', 1, {
      // 首次使用从 CDN 下载 chi_sim 语言包后自动缓存（IndexedDB），后续离线可复用；
      // 图片数据全程在本机识别，不出设备。
      cacheMethod: 'refresh',
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress({ status: m.status, progress: m.progress })
        }
      }
    })
  }
  return workerPromise
}

/* ----------------------------- 原生：ML Kit ----------------------------- */

/** 把 Blob 写入缓存目录，返回可供 processImage 使用的本地 URI */
async function writeToCache(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob)
  const name = `ocr-${Date.now()}.png`
  const res = await Filesystem.writeFile({
    path: name,
    directory: Directory.Cache,
    data: base64
  })
  return res.uri
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '')
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

async function recognizeNative(file: Blob): Promise<string> {
  const uri = await writeToCache(file)
  try {
    const { text } = await TextRecognition.processImage({
      path: uri,
      script: Script.Chinese
    })
    return text || ''
  } finally {
    // 尽力清理临时图片
    try {
      const name = uri.substring(uri.lastIndexOf('/') + 1)
      await Filesystem.deleteFile({ path: name, directory: Directory.Cache })
    } catch {
      /* ignore */
    }
  }
}

/* ----------------------------- 对外 API ----------------------------- */

/** 设置识别进度监听 */
export function setOcrProgressListener(cb: ((m: OcrProgress) => void) | null): void {
  progressHandler = cb
}

/** 预载 OCR 引擎（原生端无需预载；Web 端预热 worker 与语言包） */
export async function preloadOcr(): Promise<void> {
  if (isNativeOcr()) return
  try {
    await getTesseractWorker()
  } catch (e) {
    console.warn('[ocr] 预载失败，将在首次识别时重试', e)
  }
}

/** 识别单张图片，返回识别文本 */
export async function recognizeImage(file: Blob): Promise<string> {
  if (isNativeOcr()) {
    setProgress({ status: 'recognizing text' })
    return recognizeNative(file)
  }
  const worker = await getTesseractWorker()
  const { data } = await worker.recognize(file)
  return data.text || ''
}

/** 释放 OCR 引擎（组件卸载时调用；原生端无需释放） */
export async function releaseOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise
    try {
      await w.terminate()
    } catch {
      /* ignore */
    }
    workerPromise = null
  }
}
