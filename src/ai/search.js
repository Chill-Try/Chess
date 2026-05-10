/**
 * @file ai/search.js
 * @description 搜索算法与转置表
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 本模块实现 AI 的搜索核心逻辑：
 *
 * 1. 搜索设置 (getSearchSettings)
 *    - 根据游戏阶段和难度确定搜索深度
 *    - 时间限制（当前未启用）
 *
 * 2. 走法排序 (getMoveOrderingScore)
 *    - 为走法分配排序分数
 *    - 影响搜索效率（MVV-LVA 等）
 *
 * 3. 转置表 (getTranspositionKey, transpositionTable)
 *    - 缓存已搜索过的局面
 *    - 避免重复搜索
 *
 * 4. 超时检测 (hasTimedOut)
 *    - 控制搜索时间
 *    - 防止 UI 阻塞
 *
 * 5. Minimax 算法 (minimax)
 *    - 带 Alpha-Beta 剪枝的递归搜索
 *    - 支持转置表
 *
 * ============================================================================
 * 算法说明
 * ============================================================================
 *
 * Minimax with Alpha-Beta Pruning:
 *
 * - Maximizing player: 尝试最大化分数
 * - Minimizing player: 尝试最小化分数
 * - Alpha: 最大化者当前能确保的最低分数
 * - Beta: 最小化者当前能确保的最高分数
 * - 剪枝条件: 当 beta <= alpha 时，无需继续搜索
 *
 * 转置表:
 *
 * 同一局面可能通过不同走法顺序到达（转置）
 * 使用 FEN + depth + maximizingPlayer 作为键缓存结果
 *
 * ============================================================================
 * 搜索深度说明
 * ============================================================================
 *
 * | 难度  | 搜索深度 | 说明                    |
 * |-------|----------|------------------------|
 * | 新手  | 2        | 只看2层，AI较弱        |
 * | 中等  | 3        | 能看到基本战术          |
 * | 困难  | 4        | 较深的搜索              |
 * | 大师  | 4        | 使用 Stockfish 代替     |
 *
 * 深度每增加1，搜索节点数约增加指数级
 */

import { Chess } from 'chess.js'
import { DIFFICULTY_BY_KEY, PIECE_VALUES } from './config'
import { getNonKingMaterial } from './boardUtils'
import { evaluateBoard } from './evaluation'
import { getGamePhase, isEarlyKingWalk, isEarlyQueenMove } from './moveScoringShared'
import { getDynamicStockfishDepth } from '../lib/stockfishDepth'

// ==================== 搜索限制常量 ====================

/**
 * 转置表最大容量
 * 超过此数量时清理最旧的 30% 条目
 */
const TRANSPOSITION_TABLE_MAX_SIZE = 50000

/**
 * 搜索节点硬限制
 * 单次搜索最多评估的节点数量，防止浏览器卡死
 */
const MAX_SEARCH_NODES = 100000

// ==================== 转置表工具函数 ====================

/**
 * 清理转置表
 *
 * 当转置表超过最大容量时，清理最旧的 30% 条目
 * 使用简单的 FIFO 策略：按插入顺序清除
 *
 * @param {Map} table - 转置表
 * @param {Array} accessOrder - 访问顺序记录（用于 LRU）
 */
function pruneTranspositionTable(table, accessOrder) {
  if (table.size <= TRANSPOSITION_TABLE_MAX_SIZE) {
    return
  }

  // 需要清除的数量（30%）
  const pruneCount = Math.floor(table.size * 0.3)

  // 清除最旧的条目
  for (let i = 0; i < pruneCount && accessOrder.length > 0; i++) {
    const keyToRemove = accessOrder.shift()
    table.delete(keyToRemove)
  }
}

// ==================== 搜索设置 ====================

/**
 * 获取搜索设置
 *
 * 根据游戏阶段和难度配置返回搜索深度和时间限制
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {Object} {depth, timeLimitMs}
 *
 * 如果配置了 materialDepthSettings，会根据子力调整深度
 */
export function getSearchSettings(game, difficulty) {
  // 检查是否有按子力调整深度的配置
  if (difficulty.materialDepthSettings) {
    const nonKingMaterial = getNonKingMaterial(game.board())

    // 遍历每个阶段的配置
    for (const stage of Object.values(difficulty.materialDepthSettings)) {
      if (nonKingMaterial <= stage.maxMaterial && nonKingMaterial >= stage.minMaterial) {
        return {
          depth: stage.depth,
          timeLimitMs: null,
        }
      }
    }

    // 子力不在任何阶段范围内，使用默认深度
    return {
      depth: difficulty.depth,
      timeLimitMs: null,
    }
  }

  // 根据游戏阶段获取设置
  const phase = getGamePhase(game, difficulty)

  if (!phase || !difficulty.phaseSettings?.[phase]) {
    return {
      depth: difficulty.depth,
      timeLimitMs: null,
    }
  }

  return difficulty.phaseSettings[phase]
}

/**
 * 获取当前搜索深度（用于显示给用户）
 *
 * @param {string} fen - FEN 字符串
 * @param {string} difficultyKey - 难度键值
 * @returns {number} 当前搜索深度
 */
export function getCurrentSearchDepth(fen, difficultyKey) {
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner

  // Stockfish 难度返回 engine 的深度
  if (difficulty.engine === 'stockfish') {
    return getDynamicStockfishDepth({
      fen,
      difficultyKey,
      baseDepth: difficulty.stockfishDepth ?? difficulty.depth,
    })
  }

  // 自定义 AI 计算当前深度
  const game = new Chess(fen)
  return getSearchSettings(game, difficulty).depth
}

// ==================== 走法排序 ====================

/**
 * 计算走法排序分数
 *
 * 好的走法排序能提高 Alpha-Beta 剪枝效率
 * 优先搜索更可能有价值的走法
 *
 * @param {Object} move - 走法对象
 * @param {Object} difficulty - 难度配置
 * @returns {number} 排序分数（越高越先搜索）
 *
 * 排序因素：
 * 1. 吃子（MVV-LVA: 被吃子价值 - 吃子价值）
 * 2. 升变
 * 3. 将军
 * 4. 中心控制
 * 5. 开局相关（易位、出动、过早走后/王走）
 */
export function getMoveOrderingScore(move, difficulty) {
  let score = 0

  // ========== 吃子估值 (Most Valuable Victim - Least Valuable Attacker) ==========
  if (move.captured) {
    score += 12 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece]
  }

  // ========== 升变估值 ==========
  if (move.promotion) {
    score += PIECE_VALUES[move.promotion]
  }

  // ========== 将军加分 ==========
  if (move.san.includes('+')) {
    score += 60
  }

  // ========== 中心控制 ==========
  if (difficulty.centerWeight && ['d4', 'd5', 'e4', 'e5'].includes(move.to)) {
    score += difficulty.centerWeight
  }

  // ========== 开局相关 ==========
  if (difficulty.openingWeight) {
    // 易位加分
    if (move.flags.includes('k') || move.flags.includes('q')) {
      score += difficulty.openingWeight * 2
    }

    // 马/象出动加分
    if (move.piece === 'n' || move.piece === 'b') {
      score += difficulty.openingWeight
    }

    // 过早走后减分
    if (isEarlyQueenMove(move, 6)) {
      score -= difficulty.openingWeight * 3
    }

    // 过早王走减分
    if (isEarlyKingWalk(move, 8)) {
      score -= difficulty.openingWeight * 5
    }
  }

  return score
}

// ==================== 转置表 ====================

/**
 * 生成转置表键
 *
 * 用于缓存已搜索过的局面结果
 *
 * @param {Chess} game - 棋局实例
 * @param {number} depth - 搜索深度
 * @param {boolean} maximizingPlayer - 是否为最大化玩家
 * @returns {string} 转置表键
 */
export function getTranspositionKey(game, depth, maximizingPlayer) {
  return `${game.fen()}|${depth}|${maximizingPlayer ? 'max' : 'min'}`
}

// ==================== 超时检测 ====================

/**
 * 检查是否已超时
 *
 * @param {number|null} deadlineAt - 截止时间戳
 * @returns {boolean} 是否超时
 */
export function hasTimedOut(deadlineAt) {
  return deadlineAt !== null && Date.now() >= deadlineAt
}

/**
 * 检查是否超过节点限制
 *
 * @param {number} nodeCount - 当前节点计数
 * @returns {boolean} 是否超过限制
 */
export function hasNodeLimitReached(nodeCount) {
  return nodeCount >= MAX_SEARCH_NODES
}

/**
 * 获取搜索统计信息
 *
 * @param {Object} stats - 搜索统计对象
 * @returns {Object} { nodeCount, maxNodes }
 */
export function getSearchStats(stats) {
  return {
    nodeCount: stats.nodeCount,
    maxNodes: MAX_SEARCH_NODES,
  }
}

// ==================== Minimax 算法 ====================

/**
 * Minimax 算法（带 Alpha-Beta 剪枝、转置表和节点限制）
 *
 * @param {Chess} game - 棋局实例（会被修改，需外部处理撤销）
 * @param {number} depth - 搜索深度
 * @param {number} alpha - Alpha 值（最大化者能确保的最低分）
 * @param {number} beta - Beta 值（最小化者能确保的最高分）
 * @param {boolean} maximizingPlayer - 当前是否为最大化玩家
 * @param {Object} difficulty - 难度配置
 * @param {number|null} deadlineAt - 超时截止时间
 * @param {Map} transpositionTable - 转置表
 * @param {Array} accessOrder - 转置表访问顺序（用于 LRU 淘汰）
 * @param {Object} stats - 搜索统计信息 { nodeCount }
 * @returns {number} 局面评估分数
 *
 * 算法流程：
 *
 * 1. 增加节点计数，检查是否超过限制
 *
 * 2. 检查转置表，如有直接返回缓存结果
 *    同时更新访问顺序用于 LRU
 *
 * 3. 终止条件检查：
 *    - 节点数超限
 *    - depth === 0（到达搜索深度）
 *    - game.isGameOver()（游戏结束）
 *    - hasTimedOut()（超时）
 *    → 返回静态评估
 *
 * 4. 生成并排序所有合法走法
 *
 * 5. 递归搜索：
 *    - 最大化：选择子节点最大分数
 *    - 最小化：选择子节点最小分数
 *
 * 6. 更新转置表并返回结果
 *
 * 注意：转置表使用 LRU 策略，当超过容量时自动清理最旧的条目
 */
export function minimax(
  game,
  depth,
  alpha,
  beta,
  maximizingPlayer,
  difficulty,
  deadlineAt,
  transpositionTable,
  accessOrder = [],
  stats = { nodeCount: 0 }
) {
  // ========== 节点计数和限制检查 ==========
  stats.nodeCount += 1

  if (hasNodeLimitReached(stats.nodeCount)) {
    return evaluateBoard(game, difficulty)
  }

  // ========== 转置表查询 ==========
  const key = getTranspositionKey(game, depth, maximizingPlayer)

  if (transpositionTable.has(key)) {
    // 更新访问顺序（移到末尾）
    const index = accessOrder.indexOf(key)
    if (index > -1) {
      accessOrder.splice(index, 1)
    }
    accessOrder.push(key)

    return transpositionTable.get(key)
  }

  // ========== 终止条件 ==========
  if (depth === 0 || game.isGameOver() || hasTimedOut(deadlineAt)) {
    const evaluation = evaluateBoard(game, difficulty)
    transpositionTable.set(key, evaluation)
    accessOrder.push(key)

    // 检查并清理过大的转置表
    pruneTranspositionTable(transpositionTable, accessOrder)

    return evaluation
  }

  // ========== 生成并排序走法 ==========
  const moves = game
    .moves({ verbose: true })
    .sort((left, right) => getMoveOrderingScore(right, difficulty) - getMoveOrderingScore(left, difficulty))

  // ========== 递归搜索 ==========
  let evalResult

  if (maximizingPlayer) {
    let maxEval = -Infinity

    for (const move of moves) {
      // 超时检查
      if (hasTimedOut(deadlineAt)) {
        break
      }

      // 应用走法
      game.move(move)

      // 递归搜索（下一层是最小化）
      const evaluation = minimax(
        game,
        depth - 1,
        alpha,
        beta,
        false,
        difficulty,
        deadlineAt,
        transpositionTable,
        accessOrder,
        stats
      )

      // 撤销走法
      game.undo()

      // 更新最大值
      maxEval = Math.max(maxEval, evaluation)

      // 更新 Alpha
      alpha = Math.max(alpha, evaluation)

      // ========== Alpha-Beta 剪枝 ==========
      // 如果 beta <= alpha，说明当前局面已经被"证明"不会比之前的更好
      // 无需继续搜索其他分支
      if (beta <= alpha) break
    }

    evalResult = maxEval
  } else {
    // ========== 最小化玩家 ==========
    let minEval = Infinity

    for (const move of moves) {
      // 超时检查
      if (hasTimedOut(deadlineAt)) {
        break
      }

      // 应用走法
      game.move(move)

      // 递归搜索（下一层是最大化）
      const evaluation = minimax(
        game,
        depth - 1,
        alpha,
        beta,
        true,
        difficulty,
        deadlineAt,
        transpositionTable,
        accessOrder,
        stats
      )

      // 撤销走法
      game.undo()

      // 更新最小值
      minEval = Math.min(minEval, evaluation)

      // 更新 Beta
      beta = Math.min(beta, evaluation)

      // ========== Alpha-Beta 剪枝 ==========
      if (beta <= alpha) break
    }

    evalResult = minEval
  }

  // ========== 更新转置表 ==========
  transpositionTable.set(key, evalResult)
  accessOrder.push(key)

  // 检查并清理过大的转置表
  pruneTranspositionTable(transpositionTable, accessOrder)

  return evalResult
}
