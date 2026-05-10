/**
 * @file hooks/useComputerMove.js
 * @description 电脑走棋调度 Hook
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 隔离 AI 调度的复杂性，提供简洁的接口给 UI 层：
 *
 * 1. Worker 生命周期管理
 *    - 创建和销毁自定义 AI Worker 池
 *    - 创建和销毁 Stockfish Worker
 *
 * 2. 请求管理
 *    - 生成请求 ID 防止过期结果
 *    - 取消待处理的请求
 *
 * 3. 调度决策
 *    - 根据难度选择引擎（自定义 AI / Stockfish）
 *    - 处理开局库走法
 *    - 走法分片并行计算
 *
 * 4. 状态暴露
 *    - isComputerThinking: 电脑是否在思考
 *    - cancelPendingComputerMove: 取消函数
 *
 * ============================================================================
 * 引擎选择策略
 * ============================================================================
 *
 * | 难度   | 引擎         | 说明                      |
 * |--------|-------------|--------------------------|
 * | 新手   | 自定义 AI   | Worker 池并行计算          |
 * | 中等   | 自定义 AI   | Worker 池并行计算          |
 * | 困难   | Stockfish   | UCI 引擎                  |
 * | 大师   | Stockfish   | UCI 引擎，更深深度         |
 *
 * ============================================================================
 * 并行计算说明
 * ============================================================================
 *
 * 自定义 AI 使用 Worker 池进行并行计算：
 * 1. 候选走法被分成多个 chunk
 * 2. 每个 chunk 分配给一个 Worker
 * 3. Worker 独立评分后返回结果
 * 4. 主线程汇总所有结果，选择最佳走法
 *
 * Worker 数量根据 CPU 线程数确定（见 workerUtils.js）
 */

import { useEffect, useRef, useState } from 'react'
import { getBookOrForcedMove, getCandidateMoves, pickBestMove } from '../chess-ai'
import {
  createComputerMoveRequestContext,
} from '../lib/computerMoveRequest'
import { shouldUseStockfishBookMove } from '../lib/computerMoveScheduling'
import { chunkMoves, getWorkerCount } from '../lib/workerUtils'

/**
 * 电脑走棋调度 Hook
 *
 * @param {Object} params
 * @param {import('chess.js').Chess} params.game - 棋局实例
 * @param {string} params.gameMode - 游戏模式
 * @param {string} params.computerColor - 电脑执棋颜色
 * @param {string} params.difficultyKey - 难度键值
 * @param {boolean} params.usesStockfish - 是否使用 Stockfish
 * @param {Function} params.applyComputerMove - 应用电脑走法的回调
 *
 * @returns {Object}
 * @returns {boolean} returns.isComputerThinking - 电脑是否正在思考
 * @returns {Function} returns.cancelPendingComputerMove - 取消待处理走棋
 */
export function useComputerMove({
  game,
  computerColor,
  difficultyKey,
  usesStockfish,
  minMoveDisplayMs = 800,
  gameSessionId,
  runtimeKey,
  suppressNewTurns = false,
  onEngineCrash,
  applyComputerMove,
}) {
  // ========== 状态 ==========

  /** 电脑是否正在计算走法 */
  const [isComputerThinking, setIsComputerThinking] = useState(false)

  /** 思考状态引用，避免重复 setState */
  const isComputerThinkingRef = useRef(false)

  // ========== Refs（避免闭包问题）==========

  /** 自定义 AI Worker 池引用 */
  const workersRef = useRef([])

  /** Stockfish Worker 引用 */
  const stockfishWorkerRef = useRef(null)

  /**
   * 当前请求 ID
   * 用于忽略过期结果
   */
  const pendingRequestRef = useRef(0)

  /**
   * 当前活跃搜索的信息
   * 用于追踪分片计算进度
   */
  const activeSearchRef = useRef(null)

  /** 当前请求开始时间，用于控制最短展示时长 */
  const requestStartedAtRef = useRef(0)

  /** 延迟应用走法的定时器 */
  const applyMoveTimerRef = useRef(null)

  /** 最新棋局引用，避免 Worker 回调使用过期闭包 */
  const latestGameRef = useRef(game)

  /** 最新电脑颜色引用 */
  const latestComputerColorRef = useRef(computerColor)

  /** 最新难度引用 */
  const latestDifficultyKeyRef = useRef(difficultyKey)

  /** 最新最短展示时长引用 */
  const latestMinMoveDisplayMsRef = useRef(minMoveDisplayMs)

  /** 最新应用走法回调引用 */
  const latestApplyComputerMoveRef = useRef(applyComputerMove)

  /** 当前请求锁定的展示时长 */
  const requestDisplayMsRef = useRef(0)

  /** 最新对局代际 */
  const latestGameSessionIdRef = useRef(gameSessionId)

  /** 当前请求所属的对局代际 */
  const requestSessionIdRef = useRef(gameSessionId)

  /** 最新是否抑制新回合 */
  const suppressNewTurnsRef = useRef(suppressNewTurns)

  latestGameRef.current = game
  latestComputerColorRef.current = computerColor
  latestDifficultyKeyRef.current = difficultyKey
  latestMinMoveDisplayMsRef.current = minMoveDisplayMs
  latestApplyComputerMoveRef.current = applyComputerMove
  latestGameSessionIdRef.current = gameSessionId
  suppressNewTurnsRef.current = suppressNewTurns
  isComputerThinkingRef.current = isComputerThinking

  // ========== 取消待处理请求 ==========

  /**
   * 取消待处理的电脑走棋
   *
   * 功能：
   * 1. 增加请求 ID（使旧结果被忽略）
   * 2. 清除活跃搜索引用
   * 3. 通知 Stockfish Worker 停止
   * 4. 更新思考状态
   */
  function cancelPendingComputerMoveInternal({ updateThinkingState }) {
    console.info('[useComputerMove] Cancel pending computer move', {
      updateThinkingState,
      pendingRequestId: pendingRequestRef.current,
      gameSessionId: latestGameSessionIdRef.current,
    })
    pendingRequestRef.current += 1
    activeSearchRef.current = null
    requestStartedAtRef.current = 0
    requestDisplayMsRef.current = 0
    window.clearTimeout(applyMoveTimerRef.current)
    applyMoveTimerRef.current = null
    stockfishWorkerRef.current?.postMessage({ cancel: true })

    if (updateThinkingState && isComputerThinkingRef.current) {
      setIsComputerThinking(false)
    }
  }

  function cancelPendingComputerMove() {
    cancelPendingComputerMoveInternal({ updateThinkingState: true })
  }

  function applyMoveWithMinimumDelay(move, requestId) {
    const targetDisplayMs = requestDisplayMsRef.current
    const requestSessionId = requestSessionIdRef.current
    const elapsed = performance.now() - requestStartedAtRef.current
    const remaining = Math.max(0, targetDisplayMs - elapsed)

    console.info('[useComputerMove] Queue computer move', {
      move,
      requestId,
      requestSessionId,
      targetDisplayMs,
      elapsed,
      remaining,
    })

    window.clearTimeout(applyMoveTimerRef.current)
    applyMoveTimerRef.current = window.setTimeout(() => {
      applyMoveTimerRef.current = null

      if (requestId !== pendingRequestRef.current) {
        console.info('[useComputerMove] Skip queued move due to stale request id', {
          requestId,
          latestPendingRequestId: pendingRequestRef.current,
        })
        return
      }

      setIsComputerThinking(false)
      latestApplyComputerMoveRef.current(move, requestSessionId)
    }, remaining)
  }

  function initializeRequestContext() {
    const context = createComputerMoveRequestContext({
      minMoveDisplayMs: latestMinMoveDisplayMsRef.current,
      gameSessionId: latestGameSessionIdRef.current,
    })

    requestStartedAtRef.current = context.startedAt
    requestDisplayMsRef.current = context.displayMs
    requestSessionIdRef.current = context.sessionId
  }

  // ========== 自定义 AI Worker 管理 ==========

  useEffect(() => {
    // 创建 Worker 池
    const workers = Array.from(
      { length: getWorkerCount() },
      () => new Worker(new URL('../chessWorker.js', import.meta.url), { type: 'module' })
    )

    // 设置消息处理
    for (const worker of workers) {
      worker.onmessage = (event) => {
        const { requestId, move, error, scoredMoves } = event.data

        // ========== 过期结果检查 ==========
        // 如果请求 ID 不匹配，说明是旧结果，直接忽略
        if (requestId !== pendingRequestRef.current || error) {
          if (requestId === pendingRequestRef.current) {
            setIsComputerThinking(false)
          }
          return
        }

        // ========== 直接返回最佳走法 ==========
        // 当未提供候选走法时，Worker 直接返回最佳走法
        if (move) {
          activeSearchRef.current = null
          applyMoveWithMinimumDelay(move, requestId)
          return
        }

        // ========== 分片计算结果汇总 ==========
        const activeSearch = activeSearchRef.current

        if (!activeSearch || activeSearch.requestId !== requestId) {
          return
        }

        // 累加完成的 Worker 数量和评分结果
        activeSearch.completedWorkers += 1
        activeSearch.scoredMoves.push(...(scoredMoves ?? []))

        // 检查是否所有 Worker 都完成
        if (activeSearch.completedWorkers !== activeSearch.expectedWorkers) {
          return
        }

        // 所有 Worker 完成，选择最佳走法
        const bestMove = pickBestMove(activeSearch.scoredMoves, latestComputerColorRef.current)
        activeSearchRef.current = null

        if (bestMove) {
          applyMoveWithMinimumDelay(bestMove, requestId)
        }
      }
    }

    workersRef.current = workers

    // ========== 清理函数 ==========
    return () => {
      pendingRequestRef.current += 1
      activeSearchRef.current = null
      for (const worker of workers) {
        worker.terminate()
      }
      workersRef.current = []
    }
  }, [applyComputerMove, computerColor, runtimeKey])

  // ========== Stockfish Worker 管理 ==========

  useEffect(() => {
    // 创建 Stockfish Worker
    const worker = new Worker(
      new URL('../stockfishWorker.js', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event) => {
      const { requestId, move, error, engineFailed } = event.data

      // 过期结果检查
      if (requestId !== pendingRequestRef.current) {
        return
      }

      if (engineFailed) {
        console.warn('[useComputerMove] Stockfish worker reported engine failure', {
          requestId,
          error,
          runtimeKey,
        })
        setIsComputerThinking(false)
        activeSearchRef.current = null
        onEngineCrash?.()
        return
      }

      // 正常结果
      if (error) {
        console.error('[useComputerMove] Stockfish worker returned error', {
          requestId,
          error,
        })
        setIsComputerThinking(false)
        activeSearchRef.current = null
        return
      }

      activeSearchRef.current = null
      applyMoveWithMinimumDelay(move, requestId)
    }

    stockfishWorkerRef.current = worker

    // 清理函数
    return () => {
      pendingRequestRef.current += 1
      activeSearchRef.current = null
      worker.postMessage({ cancel: true })
      worker.terminate()
      stockfishWorkerRef.current = null
    }
  }, [applyComputerMove, runtimeKey])

  useEffect(() => {
    const shouldThink =
      Boolean(computerColor)
      && Boolean(difficultyKey)
      && game.turn() === computerColor
      && !game.isGameOver()

    if (!shouldThink) {
      cancelPendingComputerMoveInternal({ updateThinkingState: false })
      return undefined
    }

    if (suppressNewTurns) {
      console.info('[useComputerMove] Suppress starting new computer turn', {
        computerColor,
        difficultyKey,
        gameSessionId: latestGameSessionIdRef.current,
      })
      return undefined
    }

    const indicatorTimer = window.setTimeout(() => {
      setIsComputerThinking(true)
    }, 0)

    return () => {
      window.clearTimeout(indicatorTimer)
    }
  }, [computerColor, difficultyKey, game, suppressNewTurns])

  // ========== 主调度逻辑 ==========

  useEffect(() => {
    // ========== 触发条件检查 ==========
    // 仅在以下条件满足时触发电脑走棋：
    // 1. 不是双人模式
    // 2. 轮到电脑行棋
    // 3. 游戏未结束
    const shouldThink =
      Boolean(computerColor)
      && Boolean(difficultyKey)
      && game.turn() === computerColor
      && !game.isGameOver()

    if (!shouldThink) {
      cancelPendingComputerMoveInternal({ updateThinkingState: false })
      return undefined
    }

    if (suppressNewTurns) {
      console.info('[useComputerMove] Suppress new move scheduling while reset is pending', {
        computerColor,
        difficultyKey,
        gameSessionId: latestGameSessionIdRef.current,
      })
      return undefined
    }

    if (shouldUseStockfishBookMove({ difficultyKey, usesStockfish })) {
      const forcedMove = getBookOrForcedMove(game.fen(), difficultyKey)

      if (forcedMove) {
        initializeRequestContext()
        pendingRequestRef.current += 1
        const requestId = pendingRequestRef.current
        applyMoveWithMinimumDelay(forcedMove, requestId)

        return () => {
          if (suppressNewTurnsRef.current) {
            return
          }
          cancelPendingComputerMoveInternal({ updateThinkingState: false })
        }
      }
    }

    initializeRequestContext()
    console.info('[useComputerMove] Start computer turn', {
      computerColor,
      difficultyKey,
      usesStockfish,
      requestSessionId: requestSessionIdRef.current,
    })

    // ========== Stockfish 模式 ==========
    if (usesStockfish) {
      if (!stockfishWorkerRef.current) {
        return () => {
          if (suppressNewTurnsRef.current) {
            return
          }
          cancelPendingComputerMoveInternal({ updateThinkingState: false })
        }
      }

      // 生成新请求 ID
      pendingRequestRef.current += 1
      const requestId = pendingRequestRef.current

      // 记录活跃搜索
      activeSearchRef.current = { requestId, mode: 'stockfish' }

      // 发送请求到 Stockfish
      stockfishWorkerRef.current.postMessage({
        requestId,
        fen: game.fen(),
        difficultyKey,
      })

      return () => {
        if (suppressNewTurnsRef.current) {
          return
        }
        cancelPendingComputerMoveInternal({ updateThinkingState: false })
      }
    }

    // ========== 自定义 AI 模式 ==========

    if (workersRef.current.length === 0) {
      return () => {
        if (suppressNewTurnsRef.current) {
          return
        }
        cancelPendingComputerMoveInternal({ updateThinkingState: false })
      }
    }

    // 优先检查开局库或强制走法
    const forcedMove = getBookOrForcedMove(game.fen(), difficultyKey)

    if (forcedMove) {
      initializeRequestContext()
      pendingRequestRef.current += 1
      const requestId = pendingRequestRef.current
      applyMoveWithMinimumDelay(forcedMove, requestId)

      return () => {
        if (suppressNewTurnsRef.current) {
          return
        }
        cancelPendingComputerMoveInternal({ updateThinkingState: false })
      }
    }

    // 获取候选走法
    const candidateMoves = getCandidateMoves(game.fen(), difficultyKey)

    if (candidateMoves.length === 0) {
      return () => {
        if (suppressNewTurnsRef.current) {
          return
        }
        cancelPendingComputerMoveInternal({ updateThinkingState: false })
      }
    }

    // 生成请求 ID
    pendingRequestRef.current += 1
    const requestId = pendingRequestRef.current

    // 将候选走法分片
    const moveChunks = chunkMoves(
      candidateMoves,
      Math.min(workersRef.current.length, candidateMoves.length)
    )

    // 记录活跃搜索信息
    activeSearchRef.current = {
      requestId,
      expectedWorkers: moveChunks.length,
      completedWorkers: 0,
      scoredMoves: [],
    }

    // 分发任务到各个 Worker
    moveChunks.forEach((moves, index) => {
      workersRef.current[index].postMessage({
        requestId,
        fen: game.fen(),
        computerColor,
        difficultyKey,
        candidateMoves: moves,
      })
    })

    return () => {
      if (suppressNewTurnsRef.current) {
        return
      }
      cancelPendingComputerMoveInternal({ updateThinkingState: false })
    }
  }, [applyComputerMove, computerColor, difficultyKey, game, suppressNewTurns, usesStockfish])

  // ========== 返回值 ==========

  return {
    /** 电脑是否正在计算 */
    isComputerThinking,
    /** 取消待处理的走棋请求 */
    cancelPendingComputerMove,
  }
}
