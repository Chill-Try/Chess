/**
 * @file chess-ai.js
 * @description 国际象棋 AI 核心模块 - 聚合入口
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 该文件是自定义 AI 的主要入口点，负责整合各个 AI 子模块的功能：
 * - 配置管理（DIFFICULTY_LEVELS）
 * - 开局库查询（getBookOrForcedMove）
 * - 候选走法生成（getCandidateMoves）
 * - 走法评分（scoreComputerMoves）
 * - 最佳走法选择（pickBestMove）
 * - AI 决策主流程（chooseComputerMove）
 *
 * ============================================================================
 * 与其他模块的关系
 * ============================================================================
 *
 * 依赖层级：
 * chess-ai.js (本文件) - 聚合层
 *   ├── ai/config.js - AI 配置和常量
 *   ├── ai/openingBook.js - 开局库
 *   ├── ai/search.js - 搜索算法和转置表
 *   ├── ai/evaluation.js - 静态评估
 *   └── ai/moveScoring.js - 走法启发式评分
 *
 * ============================================================================
 * 难度等级说明
 * ============================================================================
 *
 * | 难度  | 引擎      | 搜索深度 | 特点                    |
 * |-------|-----------|----------|------------------------|
 * | 新手  | 自定义 AI | 2        | 随机性高，适合入门      |
 * | 中等  | 自定义 AI | 3        | 带位置和战术评估        |
 * | 困难  | Stockfish | 8        | 限强到约 ELO 1700       |
 * | 大师  | Stockfish | 16       | 最高技能，最深搜索      |
 *
 * 注意：Stockfish 相关逻辑在 stockfishWorker.js 中实现
 */

import { Chess } from 'chess.js'
import { DIFFICULTY_BY_KEY } from './ai/config'
import { getOpeningMove } from './ai/openingBook'
import { evaluateBoard } from './ai/evaluation'
import {
  evaluateCaptureDecision,
  evaluateEarlyPieceOverextension,
  evaluateIgnoredThreats,
  evaluateMovedPieceSafety,
  evaluateOpponentTacticalRisk,
  evaluateRepeatedPiecePenalty,
  evaluateStablePiecePenalty,
  evaluateTacticalMotifs,
  evaluateUnevenMinorRedeployment,
  filterOpeningMoves,
  getOpeningPhaseScore,
  getShieldPawnMovePenalty,
} from './ai/moveScoring'
import {
  getMoveOrderingScore,
  getSearchSettings,
  hasTimedOut,
  minimax,
} from './ai/search'

// 导入陷阱检测
import { findTraps } from './ai/trapBook'

// ==================== 导出配置 ====================

/** 从 ai/config.js 重新导出难度配置，供外部使用 */
export { DIFFICULTY_BY_KEY, DIFFICULTY_LEVELS } from './ai/config'

/** 从 ai/search.js 重新导出搜索深度查询函数 */
export { getCurrentSearchDepth } from './ai/search'

/** 从 ai/trapBook.js 重新导出陷阱相关函数 */
export { findTraps, TRAP_BOOK } from './ai/trapBook'

// ==================== 核心函数 ====================

/**
 * 获取陷阱走法
 *
 * 在当前局面中检测是否存在可执行的战术陷阱
 *
 * @param {string} fen - 当前局面的 FEN 字符串
 * @param {string} computerColor - 电脑执棋颜色
 * @param {string} difficultyKey - 难度键值
 * @returns {Object|null} 陷阱走法或 null
 *
 * 策略：
 * - 只在中局使用陷阱（开局阶段用开局库）
 * - 根据难度决定是否使用陷阱
 * - 高优先级陷阱直接执行，低优先级有概率执行
 */
export function getTrappedMove(fen, computerColor, difficultyKey) {
  const game = new Chess(fen)
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner

  // 只在非 Stockfish 难度下使用自定义陷阱检测
  if (difficulty.engine === 'stockfish') {
    return null // Stockfish 已有内置战术检测
  }

  return findTraps(game, computerColor, difficulty.depth)
}

/**
 * 获取候选走法列表
 *
 * @param {string} fen - 当前局面的 FEN 字符串
 * @param {string} difficultyKey - 难度键值
 * @param {Object[]|null} candidateMoves - 可选的预先生成走法列表，如果为 null 则自动生成
 * @returns {Object[]} 过滤后的候选走法数组
 *
 * 功能说明：
 * - 如果未提供 candidateMoves，则从 FEN 创建棋局并生成所有合法走法
 * - 根据难度配置过滤走法（如开局阶段排除某些不合理的走法）
 * - 详见 ai/moveScoring.js 中的 filterOpeningMoves
 *
 * 典型用途：
 * - 在 Worker 中对走法进行分片计算前调用
 * - 生成初始候选列表供后续评分使用
 */
export function getCandidateMoves(fen, difficultyKey, candidateMoves = null) {
  // 从 FEN 创建棋局对象
  const game = new Chess(fen)

  // 获取难度配置（默认为新手难度）
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner

  // 如果未提供走法列表，则生成所有合法走法
  const moves = candidateMoves ?? game.moves({ verbose: true })

  // 根据难度过滤走法
  return filterOpeningMoves(game, moves, difficulty)
}

/**
 * 获取开局库走法、陷阱走法或强制走法
 *
 * @param {string} fen - 当前局面的 FEN 字符串
 * @param {string} difficultyKey - 难度键值
 * @param {boolean} checkTraps - 是否检查陷阱
 * @returns {Object|null} 开局走法、陷阱走法、强制走法，或 null
 *
 * 决策流程：
 * 1. 如果只有一步可走，直接返回该走法（强制走子）
 * 2. 如果难度配置允许使用开局库，查询开局库
 * 3. 如果开启陷阱检测且找到陷阱，返回陷阱走法
 * 4. 否则返回 null
 *
 * 注意：
 * - 仅在游戏开局（前 16 步左右）可能从开局库返回
 * - 陷阱检测只在非 Stockfish 难度下生效
 */
export function getBookOrForcedMove(fen, difficultyKey, checkTraps = true) {
  const game = new Chess(fen)
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner
  const moves = game.moves({ verbose: true })

  // 只有一步时直接返回（将死或无子可动）
  if (moves.length <= 1) {
    return moves[0] ?? null
  }

  // 检查是否使用开局库
  if (difficulty.useOpeningBook) {
    const openingMove = getOpeningMove(game)

    if (openingMove) {
      return openingMove
    }
  }

  // 检查陷阱（非 Stockfish 难度）
  if (checkTraps && difficulty.engine !== 'stockfish') {
    const trapMove = findTraps(game, difficulty.color ?? 'b', difficulty.depth ?? 3)
    if (trapMove) {
      return trapMove
    }
  }

  return null
}

/**
 * 对候选走法进行评分
 *
 * @param {string} fen - 当前局面的 FEN 字符串
 * @param {string} computerColor - 电脑执棋颜色 ('w' 或 'b')
 * @param {string} difficultyKey - 难度键值
 * @param {Object[]|null} candidateMoves - 可选的候选走法列表
 * @returns {Object[]} 评分后的走法列表，格式为 [{move, score}, ...]
 *
 * 评分体系（分值越高对电脑越有利）：
 *
 * 1. Minimax 搜索分数（主要分数）
 *    - 使用 Alpha-Beta 剪枝的 Minimax 算法
 *    - 递归评估走法序列的最终局面分数
 *    - 搜索深度由难度配置决定
 *
 * 2. 开局阶段分数
 *    - 易位加分
 *    - 兵移动加分
 *    - 马/象出动加分
 *    - 早走后/王走减分
 *    - 重复走子减分
 *
 * 3. 位置稳定性分数
 *    - 被攻击惩罚
 *    - 棋子位置评估
 *
 * 4. 战术分数
 *    - 吃子决策评估
 *    - 战术动机评估
 *    - 对手战术风险评估
 *
 * 5. 安全性分数
 *    - 移动后安全性
 *    - 忽视威胁惩罚
 *
 * 6. 兵结构分数
 *    - 兵阵型评估
 *    - 王翼兵结构
 *
 * 7. 随机因素
 *    - 在指定范围内添加随机值
 *    - 使 AI 不会每次都下出完全相同的棋
 *
 * 分值符号说明：
 * - 正分：对该颜色有利
 * - 负分：对该颜色不利
 * - 评估时会根据电脑颜色（最大化/最小化）调整符号
 */
export function scoreComputerMoves(fen, computerColor, difficultyKey, candidateMoves = null) {
  const game = new Chess(fen)
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner

  // 获取搜索设置（深度、时间限制等）
  const searchSettings = getSearchSettings(game, difficulty)

  // 计算超时截止时间
  const deadlineAt = searchSettings.timeLimitMs === null ? null : Date.now() + searchSettings.timeLimitMs

  // 转置表：缓存已搜索过的局面，避免重复计算
  const transpositionTable = new Map()

  // 转置表访问顺序（用于 LRU 淘汰策略）
  const accessOrder = []

  // 获取候选走法
  const moves = getCandidateMoves(fen, difficultyKey, candidateMoves)

  // 无合法走法时返回空数组
  if (moves.length === 0) {
    return []
  }

  // 判断是否最大化玩家（电脑是白方时为最大化）
  const maximizingPlayer = computerColor === 'w'

  // 遍历每个走法进行评分
  return moves.map((move) => {
    // ========== 超时检查 ==========
    if (hasTimedOut(deadlineAt)) {
      // 超时时返回当前局面评估分数
      return {
        move,
        score: evaluateBoard(game, difficulty),
      }
    }

    // ========== 应用走法进行 Minimax 搜索 ==========
    game.move(move)

    // 调用递归搜索算法评估该走法
    // 传递 accessOrder 用于 LRU 淘汰策略
    const score = minimax(
      game,
      searchSettings.depth - 1,  // 减1因为已经走了一步
      -Infinity,
      Infinity,
      !maximizingPlayer,  // 对方接下来最大化/最小化
      difficulty,
      deadlineAt,
      transpositionTable,
      accessOrder
    )

    // 撤销走法，恢复到原始局面
    const next = new Chess(game.fen())
    game.undo()

    // ========== 计算各种启发式分数 ==========

    // --- 开局阶段分数 ---
    const openingScore = getOpeningPhaseScore(move, game, difficulty)
    // 分数符号根据移动方颜色调整
    const signedOpeningScore = move.color === 'w' ? openingScore : -openingScore

    // --- 重复走子惩罚 ---
    const repeatedPiecePenalty = evaluateRepeatedPiecePenalty(game, move)
    const signedRepeatedPiecePenalty = move.color === 'w' ? -repeatedPiecePenalty : repeatedPiecePenalty

    // --- 稳定性惩罚（位置可能被攻击） ---
    const stablePiecePenalty = evaluateStablePiecePenalty(game, move, difficulty)
    const signedStablePiecePenalty = move.color === 'w' ? -stablePiecePenalty : stablePiecePenalty

    // --- 不均衡的子力调动惩罚 ---
    const unevenMinorRedeploymentPenalty = evaluateUnevenMinorRedeployment(game, move, difficulty)
    const signedUnevenMinorRedeploymentPenalty = move.color === 'w' ? -unevenMinorRedeploymentPenalty : unevenMinorRedeploymentPenalty

    // --- 吃子决策评估 ---
    const captureDecisionScore = evaluateCaptureDecision(game, next, move)
    const signedCaptureDecisionScore = move.color === 'w' ? captureDecisionScore : -captureDecisionScore

    // --- 战术动机评估 ---
    const tacticalMotifScore = evaluateTacticalMotifs(game, next, move, difficulty)
    const signedTacticalMotifScore = move.color === 'w' ? tacticalMotifScore : -tacticalMotifScore

    // --- 对手战术风险评估 ---
    const opponentTacticalRisk = evaluateOpponentTacticalRisk(next, difficulty, getMoveOrderingScore)
    const signedOpponentTacticalRisk = move.color === 'w' ? -opponentTacticalRisk : opponentTacticalRisk

    // --- 移动后安全性评估 ---
    const safetyPenalty = evaluateMovedPieceSafety(next, move, difficulty)
    const signedSafetyPenalty = move.color === 'w' ? -safetyPenalty : safetyPenalty

    // --- 忽视威胁惩罚 ---
    const ignoredThreatPenalty = evaluateIgnoredThreats(game, next, move, difficulty)
    const signedIgnoredThreatPenalty = move.color === 'w' ? -ignoredThreatPenalty : ignoredThreatPenalty

    // --- 王翼兵移动惩罚 ---
    const shieldPawnPenalty = getShieldPawnMovePenalty(game, move, difficulty)
    const signedShieldPawnPenalty = move.color === 'w' ? -shieldPawnPenalty : shieldPawnPenalty

    // --- 早期子力过度前冲惩罚 ---
    const earlyOverextensionPenalty = evaluateEarlyPieceOverextension(game, move, difficulty)
    const signedEarlyOverextensionPenalty = move.color === 'w' ? -earlyOverextensionPenalty : earlyOverextensionPenalty

    // ========== 汇总总分 ==========
    return {
      move,
      // Minimax 分数 + 各项启发式分数 + 随机因素
      score:
        score
        + signedOpeningScore
        + signedRepeatedPiecePenalty
        + signedStablePiecePenalty
        + signedUnevenMinorRedeploymentPenalty
        + signedCaptureDecisionScore
        + signedTacticalMotifScore
        + signedOpponentTacticalRisk
        + signedSafetyPenalty
        + signedIgnoredThreatPenalty
        + signedShieldPawnPenalty
        + signedEarlyOverextensionPenalty
        + (Math.random() * difficulty.randomRange - difficulty.randomRange / 2), // 随机扰动
    }
  })
}

/**
 * 从评分列表中选择最佳走法
 *
 * @param {Object[]} scoredMoves - 评分后的走法列表 [{move, score}, ...]
 * @param {string} computerColor - 电脑执棋颜色
 * @returns {Object|null} 最佳走法（随机选择得分相同的走法之一）
 *
 * 选择策略：
 * - 如果是最大化玩家（电脑是白方），选择分数最高的走法
 * - 如果是最小化玩家（电脑是黑方），选择分数最低的走法
 * - 如果有多个相同分数的走法，随机选择其中一个（增加变化性）
 *
 * 注意：
 * - 使用 Math.abs(score - bestScore) < 0.001 判断分数是否相等
 * - 这是为了处理浮点数精度问题
 */
export function pickBestMove(scoredMoves, computerColor) {
  if (scoredMoves.length === 0) {
    return null
  }

  const maximizingPlayer = computerColor === 'w'

  // 初始化为极端值
  let bestScore = maximizingPlayer ? -Infinity : Infinity
  let bestMoves = []

  // 遍历所有评分走法
  for (const { move, score } of scoredMoves) {
    if (maximizingPlayer) {
      if (score > bestScore) {
        // 发现更高分，更新最佳分数和列表
        bestScore = score
        bestMoves = [move]
      } else if (Math.abs(score - bestScore) < 0.001) {
        // 分数相同，加入候选列表
        bestMoves.push(move)
      }
    } else {
      if (score < bestScore) {
        // 发现更低分（对黑方更好）
        bestScore = score
        bestMoves = [move]
      } else if (Math.abs(score - bestScore) < 0.001) {
        bestMoves.push(move)
      }
    }
  }

  // 从多个最佳走法中随机选择一个
  return bestMoves[Math.floor(Math.random() * bestMoves.length)]
}

/**
 * AI 选择走法的主入口函数
 *
 * @param {string} fen - 当前局面的 FEN 字符串
 * @param {string} computerColor - 电脑执棋颜色
 * @param {string} difficultyKey - 难度键值
 * @returns {Object|null} 选择的走法或 null
 *
 * 完整决策流程：
 * 1. 首先检查是否为强制走法（只剩一步）或开局库走法
 *    - 如果是，直接返回
 * 2. 否则，对候选走法进行评分
 * 3. 从评分结果中选择最佳走法
 *
 * 该函数是 AI 的最顶层接口，被 useComputerMove 等调用
 */
export function chooseComputerMove(fen, computerColor, difficultyKey) {
  // 优先检查强制走法、开局库和陷阱
  const forcedMove = getBookOrForcedMove(fen, difficultyKey, true)

  if (forcedMove) {
    return forcedMove
  }

  // 评分并选择最佳走法
  return pickBestMove(scoreComputerMoves(fen, computerColor, difficultyKey), computerColor)
}