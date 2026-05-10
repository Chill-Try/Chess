/**
 * @file chessWorker.js
 * @description 自定义 AI Worker
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * Web Worker，负责执行自定义 AI 的评分任务：
 *
 * 1. 接收主线程消息
 *    - requestId: 请求标识（用于忽略过期结果）
 *    - fen: 局面 FEN
 *    - computerColor: 电脑执棋颜色
 *    - difficultyKey: 难度键值
 *    - candidateMoves: 候选走法列表（可选）
 *
 * 2. 处理请求
 *    - 首先检查开局库或强制走法
 *    - 对候选走法进行评分
 *    - 返回结果或分片评分结果
 *
 * 3. 返回消息
 *    - requestId: 对应请求标识
 *    - move: 最佳走法（当 candidateMoves 为 null 时）
 *    - scoredMoves: 评分结果数组（当提供 candidateMoves 时）
 *    - done: 是否完成
 *    - error: 错误信息（如果有）
 *
 * ============================================================================
 * 消息格式
 * ============================================================================
 *
 * 输入消息 (主线程 -> Worker):
 * {
 *   requestId: number,
 *   fen: string,
 *   computerColor: 'w' | 'b',
 *   difficultyKey: string,
 *   candidateMoves?: Move[]  // 可选，不提供时直接计算最佳走法
 * }
 *
 * 输出消息 (Worker -> 主线程):
 * {
 *   requestId: number,
 *   move?: Move,           // 最佳走法
 *   scoredMoves?: Move[],  // 评分结果（当提供候选走法时）
 *   done: boolean,
 *   error?: string
 * }
 *
 * ============================================================================
 * 设计说明
 * ============================================================================
 *
 * Worker 独立运行，不阻塞主线程
 *
 * 支持两种模式：
 * 1. 直接模式：未提供 candidateMoves
 *    - Worker 计算所有走法并返回最佳走法
 *
 * 2. 分片模式：提供了 candidateMoves
 *    - Worker 只对提供的走法进行评分
 *    - 用于并行计算
 */

import { getBookOrForcedMove, pickBestMove, scoreComputerMoves } from './chess-ai'

/**
 * Worker 消息处理
 *
 * self.onmessage 接收主线程消息
 * self.postMessage 向主线程发送消息
 */
self.onmessage = (event) => {
  const { requestId, fen, computerColor, difficultyKey, candidateMoves } = event.data

  try {
    // ========== 优先检查开局库或强制走法 ==========
    const forcedMove = getBookOrForcedMove(fen, difficultyKey)

    if (forcedMove) {
      // 直接返回开局库走法
      self.postMessage({ requestId, move: forcedMove, done: true })
      return
    }

    // ========== 评分所有候选走法 ==========
    const scoredMoves = scoreComputerMoves(fen, computerColor, difficultyKey, candidateMoves)

    // ========== 根据请求类型返回结果 ==========

    if (!candidateMoves) {
      // 直接模式：返回最佳走法
      self.postMessage({
        requestId,
        move: pickBestMove(scoredMoves, computerColor),
        done: true,
      })
      return
    }

    // 分片模式：返回评分结果（由主线程汇总）
    self.postMessage({ requestId, scoredMoves, done: true })
  } catch (error) {
    // 错误处理
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'Unknown worker error',
    })
  }
}