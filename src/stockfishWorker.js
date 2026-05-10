/**
 * @file stockfishWorker.js
 * @description Stockfish 引擎 Worker
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * Web Worker，封装 Stockfish UCI 引擎：
 *
 * 1. 引擎初始化
 *    - 加载 Stockfish WASM 模块
 *    - 发送 UCI 初始化命令
 *    - 配置 Hash 大小和分析模式
 *
 * 2. 难度配置
 *    - 困难：深度 8，限制强度 ELO 1700
 *    - 大师：深度 20，最高技能
 *
 * 3. 搜索执行
 *    - 发送 UCI position 命令设置局面
 *    - 发送 UCI go 命令开始搜索
 *    - 解析 bestmove 返回结果
 *
 * 4. 请求管理
 *    - 支持取消当前搜索
 *    - 使用 requestId 忽略过期结果
 *
 * ============================================================================
 * UCI 协议说明
 * ============================================================================
 *
 * UCI (Universal Chess Interface) 是国际象棋引擎的标准通信协议：
 *
 * 初始化流程：
 * 1. uci -> 通知引擎使用 UCI 模式
 * 2. setoption name Hash value 16 -> 设置 Hash 表大小
 * 3. setoption name UCI_AnalyseMode value false -> 关闭分析模式
 * 4. isready -> 等待引擎就绪
 *
 * 搜索流程：
 * 1. ucinewgame -> 开始新游戏
 * 2. position fen <fen> -> 设置局面
 * 3. go depth <n> -> 开始搜索到指定深度
 *
 * 响应：
 * - readyok -> 引擎就绪
 * - bestmove <move> -> 最佳走法
 *
 * ============================================================================
 * Stockfish 配置
 * ============================================================================
 *
 * | 难度 | 深度 | 技能等级 | 限制强度 | ELO |
 * |------|------|----------|----------|-----|
 * | 困难 | 8   | -       | true     | 1700 |
 * | 大师 | 20  | 20      | false    | -    |
 *
 * Skill Level: 0-20，影响随机性（越高越强）
 * UCI_LimitStrength: true 时，ELO 生效
 * UCI_Elo: 限制的 ELO 等级
 */

import { DIFFICULTY_BY_KEY } from './ai/config'
import stockfishEngineUrl from 'stockfish/bin/stockfish-18-asm.js?url'

// ==================== Stockfish 配置 ====================

/**
 * Stockfish 难度配置
 *
 * 针对困难和大师难度定制
 */
const STOCKFISH_CONFIG = {
  // ========== 困难难度 ==========
  hard: {
    depth: DIFFICULTY_BY_KEY.hard.stockfishDepth, // 8层搜索
    movetime: null, // 不限制时间
    limitStrength: true, // 开启强度限制
    elo: 1700, // ELO 限制
  },

  // ========== 大师难度 ==========
  master: {
    depth: DIFFICULTY_BY_KEY.master.stockfishDepth, // 20层搜索
    movetime: null,
    skillLevel: 20, // 最高技能
    limitStrength: false, // 不限制强度
    elo: null,
  },
}

// ==================== 引擎状态 ====================

/** Stockfish Worker 实例 */
let engine = null

/** 引擎是否就绪 */
let engineReady = false

/** 当前活跃请求信息 */
let currentRequest = null

/** 等待 readyok 的 Promise 解决函数队列 */
let readyResolvers = []

/** 重试次数计数器 */
let retryCount = 0

/** 最大重试次数 */
const MAX_RETRIES = 2

/** 引擎初始化失败标志 */
let engineFailed = false

// ==================== 错误恢复 ====================

/**
 * 重置引擎状态
 *
 * 在发生错误后调用，清空状态以便重新初始化
 */
function resetEngine() {
  if (engine) {
    try {
      engine.terminate()
    } catch {
      // 忽略终止错误
    }
    engine = null
  }
  engineReady = false
  engineFailed = false
  retryCount = 0
  readyResolvers = []
}

/**
 * 通知主线程引擎失败
 *
 * @param {number} requestId - 请求 ID
 * @param {string} error - 错误信息
 */
function notifyFailure(requestId, error) {
  self.postMessage({
    requestId,
    error,
    engineFailed: true,
  })
  currentRequest = null
}

// ==================== 引擎初始化 ====================

/**
 * 解决所有等待的 Promise
 * 当收到 readyok 时调用
 */
function resolveReady() {
  engineReady = true
  readyResolvers.forEach((resolve) => resolve())
  readyResolvers = []
}

/**
 * 等待引擎就绪
 *
 * @returns {Promise} 当引擎就绪时 resolve
 */
function waitForReady() {
  if (engineReady) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    readyResolvers.push(resolve)
    engine.postMessage('isready')
  })
}

/**
 * 解析 bestmove 行
 *
 * @param {string} line - UCI 输出行
 * @returns {Object|null} 走法对象 {from, to, promotion} 或 null
 *
 * 格式：bestmove e2e4
 *      bestmove e7e8q（升变）
 */
function parseBestMove(line) {
  // 匹配 bestmove 格式：e2e4 或 e7e8q
  const match = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/)

  if (!match) {
    return null
  }

  const moveText = match[1]

  return {
    from: moveText.slice(0, 2),
    to: moveText.slice(2, 4),
    promotion: moveText[4] ?? undefined, // 升变字符
  }
}

/**
 * 确保引擎已初始化
 *
 * 懒加载模式：第一次使用时才初始化
 * 包含错误恢复机制：如果引擎加载失败会自动重试
 */
function ensureEngine() {
  // 如果引擎已存在，直接返回
  if (engine && engineReady) {
    return
  }

  // 如果已经失败过且达到最大重试次数，不再重试
  if (engineFailed && retryCount >= MAX_RETRIES) {
    return
  }

  // 如果引擎正在初始化但尚未就绪，不重复创建
  if (retryCount > 0 && !engineReady) {
    return
  }

  try {
    // 重置旧引擎（如果有）
    resetEngine()

    // 创建 Worker
    engine = new Worker(stockfishEngineUrl)

    // 消息处理
    engine.onmessage = (event) => {
      const line = typeof event.data === 'string' ? event.data : ''

      // ========== 引擎就绪 ==========
      if (line.includes('readyok')) {
        resolveReady()
        return
      }

      // ========== 最佳走法 ==========
      if (line.startsWith('bestmove') && currentRequest) {
        const move = parseBestMove(line)
        self.postMessage({ requestId: currentRequest.requestId, move })
        currentRequest = null
      }
    }

    // 错误处理
    engine.onerror = (error) => {
      retryCount++

      if (retryCount < MAX_RETRIES) {
        // 尝试重新初始化
        console.warn(`Stockfish error, retrying (${retryCount}/${MAX_RETRIES})...`, error)
        engine = null
        engineReady = false
        return
      }

      // 达到最大重试次数，标记为失败
      engineFailed = true
      console.error('Stockfish failed to initialize after retries', error)

      if (currentRequest) {
        notifyFailure(currentRequest.requestId, 'Stockfish engine failed to load')
      }
    }

    // ========== UCI 初始化 ==========
    engine.postMessage('uci')
    engine.postMessage('setoption name Hash value 16')
    engine.postMessage('setoption name UCI_AnalyseMode value false')
    engine.postMessage('isready')
  } catch (e) {
    retryCount++
    console.error('Stockfish initialization error:', e)

    if (retryCount >= MAX_RETRIES) {
      engineFailed = true
      if (currentRequest) {
        notifyFailure(currentRequest.requestId, 'Failed to create Stockfish engine')
      }
    }
  }
}

// ==================== 主消息处理 ====================

/**
 * Worker 消息处理
 *
 * @param {MessageEvent} event - 主线程消息事件
 *
 * 输入消息格式：
 * {
 *   requestId: number,
 *   fen: string,
 *   difficultyKey: 'hard' | 'master',
 *   cancel?: boolean  // 是否取消当前搜索
 * }
 */
self.onmessage = async (event) => {
  const { requestId, fen, difficultyKey, cancel } = event.data

  // ========== 引擎失败检查 ==========
  if (engineFailed) {
    self.postMessage({
      requestId,
      engineFailed: true,
      error: 'Stockfish engine unavailable',
      fallback: true, // 通知主线程可以降级到自定义 AI
    })
    return
  }

  // 确保引擎已初始化
  ensureEngine()

  // 如果引擎初始化仍在进行中但尚未就绪，延迟处理
  if (!engineReady && retryCount === 0) {
    // 等待引擎就绪
    await new Promise((resolve) => {
      readyResolvers.push(resolve)
      if (engine) {
        engine.postMessage('isready')
      }
    })
  }

  // 再次检查引擎状态
  if (!engineReady || engineFailed) {
    self.postMessage({
      requestId,
      engineFailed: true,
      error: 'Stockfish not ready',
      fallback: true,
    })
    return
  }

  // ========== 取消请求 ==========
  if (cancel) {
    currentRequest = null
    engine.postMessage('stop')
    return
  }

  // 获取难度配置
  const config = STOCKFISH_CONFIG[difficultyKey]

  if (!config) {
    self.postMessage({ requestId, error: `Unsupported Stockfish difficulty: ${difficultyKey}` })
    return
  }

  // 等待引擎就绪
  await waitForReady()

  // ========== 新请求开始前停止旧搜索 ==========
  // 避免旧结果污染新局面
  if (currentRequest) {
    engine.postMessage('stop')
  }

  // 记录当前请求
  currentRequest = { requestId }

  // 开始新游戏
  engine.postMessage('ucinewgame')

  // ========== 设置技能等级 ==========
  if (typeof config.skillLevel === 'number') {
    engine.postMessage(`setoption name Skill Level value ${config.skillLevel}`)
  }

  // ========== 设置强度限制 ==========
  engine.postMessage(`setoption name UCI_LimitStrength value ${config.limitStrength ? 'true' : 'false'}`)

  if (config.limitStrength && config.elo) {
    engine.postMessage(`setoption name UCI_Elo value ${config.elo}`)
  }

  // ========== 设置局面并搜索 ==========
  engine.postMessage(`position fen ${fen}`)

  if (config.movetime) {
    // 按时间搜索
    engine.postMessage(`go movetime ${config.movetime}`)
    return
  }

  // 按深度搜索
  engine.postMessage(`go depth ${config.depth}`)
}