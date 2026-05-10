/**
 * @file lib/soundManager.js
 * @description 音效管理器 - 支持 Web Audio API 生成音效和音频文件两种模式
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 支持两种音效播放方式：
 *
 * 1. Web Audio API 程序化生成音效
 *    - 木质/大理石/塑料三种材料风格
 *    - 真实的棋子落子声模拟
 *
 * 2. 音频文件播放模式
 *    - 加载外部音频文件
 *    - 更真实的音效体验
 *
 * ============================================================================
 * 使用方式
 * ============================================================================
 *
 * ```javascript
 * import { soundManager, initSounds, playMoveSound, playCheckSound, playCheckmateSound, setSoundSource } from './lib/soundManager'
 *
 * // 使用音频文件模式
 * setSoundSource('files', {
 *   move: '/sounds/move.mp3',
 *   check: '/sounds/check.mp3',
 *   checkmate: '/sounds/checkmate.mp3'
 * })
 *
 * // 或使用 Web Audio API 模式（默认）
 * setSoundSource('generated')
 *
 * // 播放落子音
 * playMoveSound()
 * ```
 */

// ==================== 音效类型枚举 ====================

export const SoundType = {
  MOVE: 'move',
  CAPTURE: 'capture',      // 吃子音
  CHECK: 'check',
  CHECKMATE: 'checkmate', // 将死音
  WIN: 'win',             // 胜利音
  DRAW: 'draw',           // 和棋音
  INVALID_MOVE: 'invalid_move',  // 非法走子警告音
}

// ==================== 音效风格枚举 ====================

export const SoundStyle = {
  WOODEN: 'wooden',
  MARBLE: 'marble',
  PLASTIC: 'plastic',
}

export const SoundStyleLabels = {
  [SoundStyle.WOODEN]: '木质',
  [SoundStyle.MARBLE]: '大理石',
  [SoundStyle.PLASTIC]: '塑料',
}

// ==================== 音频源类型枚举 ====================

export const SoundSourceType = {
  GENERATED: 'generated',  // Web Audio API 生成
  FILES: 'files',          // 音频文件
}

// ==================== 音效管理器类 ====================

class SoundManager {
  constructor() {
    /** @type {AudioContext|null} Web Audio API 上下文 */
    this.audioContext = null

    /** @type {GainNode|null} 主音量增益节点 */
    this.masterGain = null

    /** 当前音效风格（用于生成模式） */
    this.currentStyle = SoundStyle.WOODEN

    /** 音频源类型 */
    this.sourceType = SoundSourceType.GENERATED

    /** 音频文件缓存 */
    this.audioBuffers = {}

    /** 音频文件对应的 Audio 对象（用于预加载） */
    this.audioElements = {}

    /** 音量 (0-1) */
    this.volume = 0.5

    /** 是否静音 */
    this.muted = false

    /** 是否已初始化 */
    this.initialized = false

    /** 待加载的音频文件URL */
    this.pendingFiles = null
  }

  /**
   * 初始化音频上下文
   */
  async init() {
    if (this.initialized) return

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContextClass()

      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = this.muted ? 0 : this.volume
      this.masterGain.connect(this.audioContext.destination)

      this.initialized = true

      // 如果有待加载的音频文件，加载它们
      if (this.pendingFiles) {
        await this.loadAudioFiles(this.pendingFiles)
        this.pendingFiles = null
      }
    } catch (e) {
      console.warn('Failed to initialize Web Audio API:', e)
      this.initialized = true
    }
  }

  /**
   * 设置音频源类型
   *
   * @param {string} type - 'generated' 或 'files'
   * @param {Object} files - 当 type 为 'files' 时，传入 { move, check, checkmate } 的 URL
   */
  async setSourceType(type, files = null) {
    this.sourceType = type

    if (type === SoundSourceType.FILES && files) {
      await this.loadAudioFiles(files)
    }
  }

  /**
   * 加载音频文件
   */
  async loadAudioFiles(files) {
    if (!this.initialized) {
      this.pendingFiles = files
      return
    }

    const loadPromises = Object.entries(files).map(async ([key, url]) => {
      try {
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
        this.audioBuffers[key] = audioBuffer

        // 同时创建 Audio 对象用于预加载
        const audio = new Audio(url)
        audio.preload = 'auto'
        this.audioElements[key] = audio
      } catch (e) {
        console.warn(`Failed to load audio file: ${key}`, e)
      }
    })

    await Promise.all(loadPromises)
  }

  /**
   * 播放落子音
   */
  playMoveSound() {
    this.play(SoundType.MOVE)
  }

  /**
   * 播放吃子音
   */
  playCaptureSound() {
    this.play(SoundType.CAPTURE)
  }

  /**
   * 播放将军音
   */
  playCheckSound() {
    this.play(SoundType.CHECK)
  }

  /**
   * 播放将死音
   */
  playCheckmateSound() {
    this.play(SoundType.CHECKMATE)
  }

  /**
   * 播放胜利音效
   */
  playWinSound() {
    this.play(SoundType.WIN)
  }

  /**
   * 播放和棋音效
   */
  playDrawSound() {
    this.play(SoundType.DRAW)
  }

  /**
   * 播放非法走子警告音
   */
  playInvalidMoveSound() {
    this.play(SoundType.INVALID_MOVE)
  }

  /**
   * 通用播放方法
   */
  play(type) {
    if (this.muted || !this.masterGain) return

    // 确保上下文处于运行状态
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {})
    }

    if (this.sourceType === SoundSourceType.FILES && this.audioBuffers[type]) {
      this.playFromBuffer(type)
    } else {
      this.playGenerated(type)
    }
  }

  /**
   * 从音频缓冲区播放
   */
  playFromBuffer(type) {
    if (!this.audioContext || !this.audioBuffers[type]) return

    const source = this.audioContext.createBufferSource()
    source.buffer = this.audioBuffers[type]

    const gainNode = this.audioContext.createGain()
    gainNode.gain.value = this.volume

    source.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    source.start(0)

    source.onended = () => {
      source.disconnect()
      gainNode.disconnect()
    }
  }

  /**
   * 播放生成的音效
   */
  playGenerated(type) {
    if (!this.audioContext || !this.masterGain) return

    const now = this.audioContext.currentTime

    switch (type) {
      case SoundType.MOVE:
        this.generateMoveSound(now)
        break
      case SoundType.CAPTURE:
        this.generateCaptureSound(now)
        break
      case SoundType.CHECK:
        this.generateCheckSound(now)
        break
      case SoundType.CHECKMATE:
        this.generateCheckmateSound(now)
        break
      case SoundType.WIN:
        this.generateWinSound(now)
        break
      case SoundType.DRAW:
        this.generateDrawSound(now)
        break
      case SoundType.INVALID_MOVE:
        this.generateInvalidMoveSound(now)
        break
    }
  }

  /**
   * 生成落子音效
   */
  generateMoveSound(startTime) {
    const params = this.getMoveSoundParams()
    const ctx = this.audioContext
    const now = startTime || ctx.currentTime

    // 创建噪声（用于敲击声的初始冲击）
    const noiseBuffer = this.createNoiseBuffer(params.noiseDuration)
    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = noiseBuffer

    // 噪声滤波器
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = params.noiseFreq
    noiseFilter.Q.value = params.noiseQ

    // 噪声增益
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(params.peakGain * 0.6, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + params.noiseDuration)

    // 创建主振荡器
    const oscillator = ctx.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(params.baseFreq, now)
    oscillator.frequency.exponentialRampToValueAtTime(params.baseFreq * 0.85, now + params.duration)

    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0, now)
    oscGain.gain.linearRampToValueAtTime(params.peakGain, now + params.attackTime)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + params.duration)

    // 创建第二个振荡器
    const oscillator2 = ctx.createOscillator()
    oscillator2.type = 'sine'
    oscillator2.frequency.setValueAtTime(params.baseFreq * 1.5, now)
    oscillator2.frequency.exponentialRampToValueAtTime(params.baseFreq * 1.2, now + params.duration)

    const oscGain2 = ctx.createGain()
    oscGain2.gain.setValueAtTime(0, now)
    oscGain2.gain.linearRampToValueAtTime(params.peakGain * 0.3, now + params.attackTime)
    oscGain2.gain.exponentialRampToValueAtTime(0.001, now + params.duration * 0.8)

    // 连接节点
    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)

    oscillator.connect(oscGain)
    oscGain.connect(this.masterGain)

    oscillator2.connect(oscGain2)
    oscGain2.connect(this.masterGain)

    // 启动并停止
    noiseSource.start(now)
    noiseSource.stop(now + params.noiseDuration)

    oscillator.start(now)
    oscillator.stop(now + params.duration)

    oscillator2.start(now)
    oscillator2.stop(now + params.duration * 0.8)

    // 清理
    noiseSource.onended = () => {
      noiseSource.disconnect()
      noiseFilter.disconnect()
      noiseGain.disconnect()
    }
    oscillator.onended = () => {
      oscillator.disconnect()
      oscGain.disconnect()
    }
    oscillator2.onended = () => {
      oscillator2.disconnect()
      oscGain2.disconnect()
    }
  }

  /**
   * 生成吃子音效 - 比普通走子更厚重
   */
  generateCaptureSound(startTime) {
    const params = this.getMoveSoundParams()
    const ctx = this.audioContext
    const now = startTime || ctx.currentTime

    // 吃子音效参数：更低频、更大声、更长
    const captureParams = {
      baseFreq: params.baseFreq * 0.7,  // 更低频
      noiseFreq: params.noiseFreq * 0.8,
      noiseQ: 2,
      noiseDuration: 0.08,  // 更长的冲击
      duration: 0.25,  // 更长的余音
      attackTime: 0.005,
      peakGain: params.peakGain * 1.4,  // 更大声
    }

    // 创建更强的噪声冲击
    const noiseBuffer = this.createNoiseBuffer(captureParams.noiseDuration)
    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = noiseBuffer

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'  // 低通滤波，更有冲击感
    noiseFilter.frequency.value = 600

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(captureParams.peakGain * 0.8, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + captureParams.noiseDuration)

    // 主振荡器 - 低频共鸣
    const oscillator = ctx.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(captureParams.baseFreq, now)
    oscillator.frequency.exponentialRampToValueAtTime(captureParams.baseFreq * 0.75, now + captureParams.duration)

    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0, now)
    oscGain.gain.linearRampToValueAtTime(captureParams.peakGain, now + captureParams.attackTime)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + captureParams.duration)

    // 谐波振荡器
    const oscillator2 = ctx.createOscillator()
    oscillator2.type = 'triangle'
    oscillator2.frequency.setValueAtTime(captureParams.baseFreq * 2, now)

    const oscGain2 = ctx.createGain()
    oscGain2.gain.setValueAtTime(0, now)
    oscGain2.gain.linearRampToValueAtTime(captureParams.peakGain * 0.5, now + captureParams.attackTime)
    oscGain2.gain.exponentialRampToValueAtTime(0.001, now + captureParams.duration * 0.6)

    // 连接节点
    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)

    oscillator.connect(oscGain)
    oscGain.connect(this.masterGain)

    oscillator2.connect(oscGain2)
    oscGain2.connect(this.masterGain)

    // 启动并停止
    noiseSource.start(now)
    noiseSource.stop(now + captureParams.noiseDuration)

    oscillator.start(now)
    oscillator.stop(now + captureParams.duration)

    oscillator2.start(now)
    oscillator2.stop(now + captureParams.duration * 0.6)

    // 清理
    noiseSource.onended = () => {
      noiseSource.disconnect()
      noiseFilter.disconnect()
      noiseGain.disconnect()
    }
    oscillator.onended = () => {
      oscillator.disconnect()
      oscGain.disconnect()
    }
    oscillator2.onended = () => {
      oscillator2.disconnect()
      oscGain2.disconnect()
    }
  }

  /**
   * 生成将军音效
   */
  generateCheckSound(startTime) {
    const ctx = this.audioContext
    const now = startTime || ctx.currentTime
    const frequencies = [440, 554]

    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'triangle'
      oscillator.frequency.value = freq

      const gain = ctx.createGain()
      const time = now + i * 0.1

      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(0.3, time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25)

      oscillator.connect(gain)
      gain.connect(this.masterGain)

      oscillator.start(time)
      oscillator.stop(time + 0.3)

      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    })
  }

  /**
   * 生成将死音效
   */
  generateCheckmateSound(startTime) {
    const ctx = this.audioContext
    const now = startTime || ctx.currentTime
    const notes = [523, 466, 392, 349, 294]

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'triangle'
      oscillator.frequency.value = freq

      const gain = ctx.createGain()
      const time = now + i * 0.15

      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(0.25, time + 0.02)
      gain.gain.setValueAtTime(0.25, time + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4)

      oscillator.connect(gain)
      gain.connect(this.masterGain)

      oscillator.start(time)
      oscillator.stop(time + 0.5)

      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    })
  }

  /**
   * 生成胜利音效
   */
  generateWinSound(startTime) {
    const ctx = this.audioContext
    const now = startTime || ctx.currentTime
    const notes = [392, 523, 659, 784]

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'triangle'
      oscillator.frequency.value = freq

      const gain = ctx.createGain()
      const time = now + i * 0.11

      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(0.22, time + 0.015)
      gain.gain.setValueAtTime(0.22, time + 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32)

      oscillator.connect(gain)
      gain.connect(this.masterGain)

      oscillator.start(time)
      oscillator.stop(time + 0.36)

      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    })
  }

  /**
   * 生成和棋音效
   */
  generateDrawSound(startTime) {
    const ctx = this.audioContext
    const now = startTime || ctx.currentTime
    const notes = [440, 392, 440]

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = freq

      const gain = ctx.createGain()
      const time = now + i * 0.14

      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(0.16, time + 0.02)
      gain.gain.setValueAtTime(0.16, time + 0.09)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.34)

      oscillator.connect(gain)
      gain.connect(this.masterGain)

      oscillator.start(time)
      oscillator.stop(time + 0.38)

      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    })
  }

  /**
   * 生成非法走子警告音效 - 两次"噔噔"声（更高频）
   */
  generateInvalidMoveSound(startTime) {
    const ctx = this.audioContext
    const now = startTime || ctx.currentTime

    // 两次警告"噔噔"
    const times = [0, 0.2]

    times.forEach((delay) => {
      const time = now + delay

      // 主振荡器 - 更高的频率，更尖锐的警告音
      const oscillator = ctx.createOscillator()
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(800, time)
      oscillator.frequency.exponentialRampToValueAtTime(500, time + 0.12)

      // 增益包络 - 更短促
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(0.35, time + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15)

      // 尖锐的警告音
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1000
      filter.Q.value = 2

      oscillator.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)

      oscillator.start(time)
      oscillator.stop(time + 0.2)

      oscillator.onended = () => {
        oscillator.disconnect()
        filter.disconnect()
        gain.disconnect()
      }
    })
  }
  getMoveSoundParams() {
    switch (this.currentStyle) {
      case SoundStyle.MARBLE:
        return {
          baseFreq: 1200,
          noiseFreq: 2500,
          noiseQ: 8,
          noiseDuration: 0.03,
          duration: 0.15,
          attackTime: 0.002,
          peakGain: 0.4,
        }
      case SoundStyle.PLASTIC:
        return {
          baseFreq: 800,
          noiseFreq: 1800,
          noiseQ: 5,
          noiseDuration: 0.025,
          duration: 0.12,
          attackTime: 0.001,
          peakGain: 0.35,
        }
      case SoundStyle.WOODEN:
      default:
        return {
          baseFreq: 400,
          noiseFreq: 1200,
          noiseQ: 3,
          noiseDuration: 0.05,
          duration: 0.18,
          attackTime: 0.003,
          peakGain: 0.4,
        }
    }
  }

  /**
   * 创建噪声缓冲
   */
  createNoiseBuffer(duration) {
    const sampleRate = this.audioContext.sampleRate
    const bufferSize = sampleRate * duration
    const buffer = this.audioContext.createBuffer(1, bufferSize, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    return buffer
  }

  /**
   * 设置音效风格（仅影响生成模式）
   */
  setStyle(style) {
    if (Object.values(SoundStyle).includes(style)) {
      this.currentStyle = style
    }
  }

  /**
   * 获取当前音效风格
   */
  getStyle() {
    return this.currentStyle
  }

  /**
   * 获取当前音频源类型
   */
  getSourceType() {
    return this.sourceType
  }

  /**
   * 设置音量
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol))
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume
    }
  }

  /**
   * 获取当前音量
   */
  getVolume() {
    return this.volume
  }

  /**
   * 设置静音状态
   */
  setMuted(muted) {
    this.muted = muted
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.volume
    }
  }

  /**
   * 获取静音状态
   */
  isMuted() {
    return this.muted
  }

  /**
   * 切换静音状态
   */
  toggleMute() {
    this.muted = !this.muted
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume
    }
    return this.muted
  }

  /**
   * 重置到默认设置
   */
  reset() {
    this.currentStyle = SoundStyle.WOODEN
    this.sourceType = SoundSourceType.GENERATED
    this.volume = 0.5
    this.muted = false
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume
    }
  }

  /**
   * 释放音频资源
   */
  dispose() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
      this.masterGain = null
    }
    this.audioBuffers = {}
    this.audioElements = {}
    this.initialized = false
  }
}

// ==================== 导出单例 ====================

export const soundManager = new SoundManager()

// ==================== 便捷函数 ====================

/**
 * 初始化音效系统
 */
export async function initSounds() {
  await soundManager.init()
}

/**
 * 设置音频源
 *
 * @param {string} sourceType - 'generated' 或 'files'
 * @param {Object} files - 音频文件对象 { move, check, checkmate }
 */
export async function setSoundSource(sourceType, files = null) {
  await soundManager.setSourceType(sourceType, files)
}

/**
 * 播放落子音
 */
export function playMoveSound() {
  soundManager.playMoveSound()
}

/**
 * 播放吃子音
 */
export function playCaptureSound() {
  soundManager.playCaptureSound()
}

/**
 * 播放将军音
 */
export function playCheckSound() {
  soundManager.playCheckSound()
}

/**
 * 播放将死音
 */
export function playCheckmateSound() {
  soundManager.playCheckmateSound()
}

/**
 * 播放胜利音效
 */
export function playWinSound() {
  soundManager.playWinSound()
}

/**
 * 播放和棋音效
 */
export function playDrawSound() {
  soundManager.playDrawSound()
}

/**
 * 播放非法走子警告音
 */
export function playInvalidMoveSound() {
  soundManager.playInvalidMoveSound()
}
