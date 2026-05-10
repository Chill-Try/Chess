/**
 * @file ai/moveScoringShared.js
 * @description AI 共享的开局/阶段/易位相关规则
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 本模块包含多个 AI 模块需要共享的逻辑：
 *
 * 1. 游戏阶段判断 (getGamePhase)
 *    - 开局 (opening)
 *    - 中局 (middlegame)
 *    - 残局 (endgame)
 *    - 简化残局 (simplifiedEndgame)
 *
 * 2. 易位相关 (getCastlingPlan, getPawnShieldSquares, etc.)
 *    - 检测易位计划（王翼/后翼）
 *    - 计算兵盾格子
 *    - 王翼兵权重
 *
 * 3. 开局规则
 *    - 棋子是否已出动
 *    - 后/王是否过早移动
 *    - 是否为战术走法
 *
 * ============================================================================
 * 设计原因
 * ============================================================================
 *
 * 这些函数被多个模块使用：
 * - evaluation.js: 使用游戏阶段、易位计划等
 * - moveScoring.js: 使用开局规则、棋子发展状态
 *
 * 集中管理确保规则一致性
 */

import { PIECE_VALUES } from './config'
import { findPieceSquare, getNonPawnMaterial } from './boardUtils'

// ==================== 开局阶段 ====================

/**
 * 获取开局阶段走法计数
 *
 * FEN 第5字段是 fullmove number
 *
 * @param {Chess} game - 棋局实例
 * @returns {number} 回合数
 */
export function getOpeningPhaseMoveCount(game) {
  return Number.parseInt(game.fen().split(' ')[5], 10)
}

// ==================== 游戏阶段判断 ====================

/**
 * 判断当前游戏阶段
 *
 * 游戏阶段影响评估权重：
 * - 开局：重视发展、中心控制、易位
 * - 中局：重视子力协调、战术机会
 * - 残局：重视王的位置、兵的推进
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {string|null} 游戏阶段
 *
 * 判断标准：
 * - fullmoveNumber <= 8: 开局
 * - 非开局但后还在且子力充足: 中局
 * - 无后或子力不足: 残局
 * - 非开局但子力极少: 简化残局
 */
export function getGamePhase(game, difficulty) {
  if (!difficulty.phaseSettings) {
    return null
  }

  const board = game.board()
  const fullmoveNumber = getOpeningPhaseMoveCount(game)
  const queens = game.findPiece({ type: 'q', color: 'w' }).length + game.findPiece({ type: 'q', color: 'b' }).length
  const nonPawnMaterial = getNonPawnMaterial(board)
  const minorAndRookMaterial = nonPawnMaterial - queens * PIECE_VALUES.q

  // ========== 开局阶段 ==========
  if (fullmoveNumber <= 8) {
    return 'opening'
  }

  // ========== 简化残局（子力极少）==========
  if (nonPawnMaterial <= 1400 || minorAndRookMaterial <= 900) {
    return 'simplifiedEndgame'
  }

  // ========== 残局 ==========
  if (queens === 0 || nonPawnMaterial <= 2600) {
    return 'endgame'
  }

  // ========== 中局 ==========
  return 'middlegame'
}

// ==================== 易位相关 ====================

/**
 * 获取易位计划
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 颜色
 * @returns {string|null} 'kingside'/'queenside'/null
 *
 * 检测逻辑：
 * 1. 先看国王当前位置
 * 2. 如果不在初始位置，检查易位标记
 */
export function getCastlingPlan(game, color) {
  const kingSquare = findPieceSquare(game, color, 'k')

  // 检查国王是否已易位
  if (color === 'w') {
    if (kingSquare === 'g1') return 'kingside'
    if (kingSquare === 'c1') return 'queenside'
  } else {
    if (kingSquare === 'g8') return 'kingside'
    if (kingSquare === 'c8') return 'queenside'
  }

  // 检查易位标记（国王还在初始位置时）
  const castlingField = game.fen().split(' ')[2]

  if (color === 'w') {
    if (castlingField.includes('K')) return 'kingside'
    if (castlingField.includes('Q')) return 'queenside'
  } else {
    if (castlingField.includes('k')) return 'kingside'
    if (castlingField.includes('q')) return 'queenside'
  }

  return null
}

/**
 * 获取兵盾格子
 *
 * 易位后，王翼/后翼的兵应该保护王
 * 这些格子被称为"兵盾"
 *
 * @param {string} color - 颜色
 * @param {string} castlingPlan - 易位计划
 * @returns {string[]} 兵盾格子列表
 *
 * 兵盾位置：
 * - 白方王翼: f2, g2, h2
 * - 白方后翼: a2, b2, c2
 * - 黑方王翼: f7, g7, h7
 * - 黑方后翼: a7, b7, c7
 */
export function getPawnShieldSquares(color, castlingPlan) {
  if (color === 'w' && castlingPlan === 'kingside') return ['f2', 'g2', 'h2']
  if (color === 'w' && castlingPlan === 'queenside') return ['a2', 'b2', 'c2']
  if (color === 'b' && castlingPlan === 'kingside') return ['f7', 'g7', 'h7']
  if (color === 'b' && castlingPlan === 'queenside') return ['a7', 'b7', 'c7']
  return []
}

/**
 * 获取易位后国王的位置
 *
 * @param {string} color - 颜色
 * @param {string} castlingPlan - 易位计划
 * @returns {string|null} 易位后国王位置
 */
export function getCastledKingSquare(color, castlingPlan) {
  if (color === 'w' && castlingPlan === 'kingside') return 'g1'
  if (color === 'w' && castlingPlan === 'queenside') return 'c1'
  if (color === 'b' && castlingPlan === 'kingside') return 'g8'
  if (color === 'b' && castlingPlan === 'queenside') return 'c8'
  return null
}

/**
 * 获取兵盾格子权重
 *
 * 靠近王的兵更重要（g/h 兵比 f 兵更重要）
 *
 * @param {string} color - 颜色
 * @param {string} castlingPlan - 易位计划
 * @param {string} file - 文件字母
 * @returns {number} 权重
 */
export function getPawnShieldWeight(color, castlingPlan, file) {
  if (castlingPlan === 'kingside') {
    if (file === 'f') return 1
    if (file === 'g' || file === 'h') return 1.8
  }

  if (castlingPlan === 'queenside') {
    if (file === 'a') return 1
    if (file === 'b' || file === 'c') return 1.8
  }

  return 1
}

/**
 * 查找某文件上的兵
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 颜色
 * @param {string} file - 文件字母
 * @returns {string|null} 兵所在格子
 *
 * 注意：白方返回最靠前的兵，黑方返回最靠后的兵
 */
export function findPawnOnFile(game, color, file) {
  const pawns = game.findPiece({ type: 'p', color })
  const filePawns = pawns.filter((square) => square[0] === file)

  if (filePawns.length === 0) {
    return null
  }

  // 排序：白方 rank 大的在前，黑方 rank 小的在前
  return filePawns.sort((left, right) => {
    const leftRank = Number.parseInt(left[1], 10)
    const rightRank = Number.parseInt(right[1], 10)
    return color === 'w' ? leftRank - rightRank : rightRank - leftRank
  })[0]
}

/**
 * 计算兵前移惩罚
 *
 * 兵越前移，离开保护后越脆弱
 *
 * @param {Object} piece - 兵对象
 * @param {string} square - 所在格子
 * @returns {number} 惩罚值
 */
export function getPawnAdvancePenalty(piece, square) {
  const rank = Number.parseInt(square[1], 10)
  const homeRank = piece.color === 'w' ? 2 : 7
  const advancedSquares = piece.color === 'w' ? rank - homeRank : homeRank - rank

  if (advancedSquares <= 1) {
    return advancedSquares * 0.35
  }

  return 0.35 + (advancedSquares - 1) * 0.9
}

// ==================== 开局规则判断 ====================

/**
 * 判断是否为战术走法
 *
 * 战术走法不受某些惩罚规则限制
 *
 * @param {Object} move - 走法对象
 * @returns {boolean} 是否为战术走法
 */
export function isTacticalMove(move) {
  return Boolean(move.captured) || move.san.includes('+') || move.san.includes('#')
}

/**
 * 判断是否为过早走后
 *
 * 后过早离开会暴露己方阵营
 *
 * @param {Object} move - 走法对象
 * @param {number} fullmoveNumber - 回合数
 * @returns {boolean} 是否为过早走后
 */
export function isEarlyQueenMove(move, fullmoveNumber) {
  return move.piece === 'q' && fullmoveNumber <= 6
}

/**
 * 判断是否为过早王走
 *
 * 王过早步行（未易位）会暴露己方阵营
 *
 * @param {Object} move - 走法对象
 * @param {number} fullmoveNumber - 回合数
 * @returns {boolean} 是否为过早王走
 */
export function isEarlyKingWalk(move, fullmoveNumber) {
  const isCastlingMove = move.flags.includes('k') || move.flags.includes('q')
  return move.piece === 'k' && !isCastlingMove && fullmoveNumber <= 8
}

/**
 * 判断棋子是否已出动
 *
 * 用于评估是否应该继续发展
 *
 * @param {string} square - 棋子位置
 * @param {Object} piece - 棋子对象
 * @returns {boolean} 是否已出动
 *
 * 判断标准：
 * - 马/象: 不在初始位置
 * - 车: 不在 a/h 文件
 * - 后: 不在初始位置
 */
export function isPieceDeveloped(square, piece) {
  const rank = Number.parseInt(square[1], 10)

  if (piece.type === 'n' || piece.type === 'b') {
    // 马/象：白方在第3行以上，黑方在第6行以下
    return piece.color === 'w' ? rank >= 3 : rank <= 6
  }

  if (piece.type === 'r') {
    // 车：不在 a/h 文件
    return square[0] !== 'a' && square[0] !== 'h'
  }

  if (piece.type === 'q') {
    // 后：白方在第3行以上，黑方在第6行以下
    return piece.color === 'w' ? rank >= 3 : rank <= 6
  }

  return false
}