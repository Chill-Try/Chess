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
  applyComputerMove,
}) {
  // ========== 状态 ==========

  /** 电脑是否正在计算走法 */
  const [isComputerThinking, setIsComputerThinking] = useState(false)

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
  function cancelPendingComputerMove() {
    pendingRequestRef.current += 1
    activeSearchRef.current = null
    stockfishWorkerRef.current?.postMessage({ cancel: true })
    setIsComputerThinking(false)
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
          setIsComputerThinking(false)
          applyComputerMove(move)
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
        const bestMove = pickBestMove(activeSearch.scoredMoves, computerColor)
        activeSearchRef.current = null
        setIsComputerThinking(false)

        if (bestMove) {
          applyComputerMove(bestMove)
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
  }, [applyComputerMove, computerColor])

  // ========== Stockfish Worker 管理 ==========

  useEffect(() => {
    // 创建 Stockfish Worker
    const worker = new Worker(
      new URL('../stockfishWorker.js', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (event) => {
      const { requestId, move, error, engineFailed, fallback } = event.data

      // 过期结果检查
      if (requestId !== pendingRequestRef.current) {
        return
      }

      // 如果 Stockfish 失败且需要降级
      if ((engineFailed || error) && fallback) {
        setIsComputerThinking(false)
        activeSearchRef.current = null

        // 降级到自定义 AI
        if (workersRef.current.length > 0) {
          console.info('Stockfish unavailable, falling back to custom AI')

          // 优先检查开局库或强制走法
          const forcedMove = getBookOrForcedMove(game.fen(), difficultyKey)

          if (forcedMove) {
            applyComputerMove(forcedMove)
            return
          }

          // 直接计算走法
          pendingRequestRef.current += 1
          const newRequestId = pendingRequestRef.current

          activeSearchRef.current = { requestId: newRequestId, mode: 'fallback' }
          setIsComputerThinking(true)

          // 使用第一个 Worker 计算
          const candidateMoves = getCandidateMoves(game.fen(), difficultyKey)

          if (candidateMoves.length > 0) {
            workersRef.current[0].postMessage({
              requestId: newRequestId,
              fen: game.fen(),
              computerColor,
              difficultyKey,
              candidateMoves: null, // 让 Worker 自己计算所有走法
            })
          }
        }
        return
      }

      // 正常结果
      if (error) {
        setIsComputerThinking(false)
        activeSearchRef.current = null
        return
      }

      activeSearchRef.current = null
      setIsComputerThinking(false)
      applyComputerMove(move)
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
  }, [applyComputerMove])

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
      return () => {
        cancelPendingComputerMove()
      }
    }

    // ========== 延迟触发 ==========
    // 450ms 延迟让玩家看到上一手的结果
    const timer = window.setTimeout(() => {
      // ========== Stockfish 模式 ==========
      if (usesStockfish) {
        if (!stockfishWorkerRef.current) {
          return
        }

        // 生成新请求 ID
        pendingRequestRef.current += 1
        const requestId = pendingRequestRef.current

        // 记录活跃搜索
        activeSearchRef.current = { requestId, mode: 'stockfish' }
        setIsComputerThinking(true)

        // 发送请求到 Stockfish
        stockfishWorkerRef.current.postMessage({
          requestId,
          fen: game.fen(),
          difficultyKey,
        })
        return
      }

      // ========== 自定义 AI 模式 ==========

      if (workersRef.current.length === 0) {
        return
      }

      // 优先检查开局库或强制走法
      const forcedMove = getBookOrForcedMove(game.fen(), difficultyKey)

      if (forcedMove) {
        applyComputerMove(forcedMove)
        return
      }

      // 获取候选走法
      const candidateMoves = getCandidateMoves(game.fen(), difficultyKey)

      if (candidateMoves.length === 0) {
        return
      }

      // 生成请求 ID
      pendingRequestRef.current += 1
      const requestId = pendingRequestRef.current

      // 将候选走法分片
      const moveChunks = chunkMoves(
        candidateMoves,
        Math.min(workersRef.current.length, candidateMoves.length)
      )

      setIsComputerThinking(true)

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
    }, 450)

    // ========== 清理函数 ==========
    return () => {
      window.clearTimeout(timer)
      cancelPendingComputerMove()
    }
  }, [applyComputerMove, computerColor, difficultyKey, game, usesStockfish])

  // ========== 返回值 ==========

  return {
    /** 电脑是否正在计算 */
    isComputerThinking,
    /** 取消待处理的走棋请求 */
    cancelPendingComputerMove,
  }
}
