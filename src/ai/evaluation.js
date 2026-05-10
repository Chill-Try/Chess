/**
 * @file ai/evaluation.js
 * @description 静态局面评估
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 本模块负责对给定局面进行静态评估（不进行搜索）：
 *
 * 1. 子力评估 (evaluateBoard)
 *    - 计算双方棋子总价值
 *    - 加上位置评估表bonus
 *
 * 2. 中心控制 (evaluateCenterControl)
 *    - 计算每个走法是否控制中心格子
 *
 * 3. 发展评估 (evaluateDevelopment)
 *    - 马、象是否已出动
 *    - 王是否已易位
 *    - 后是否过早出动
 *
 * 4. 平衡发展 (evaluateBalancedDevelopment)
 *    - 两边的马象出动是否平衡
 *    - 双方出动速度对比
 *
 * 5. 攻击压力 (evaluateAttackPressure)
 *    - 攻击者的数量和质量
 *    - 防守者的数量和质量
 *    - 计算交换优势
 *
 * 6. 易位侧兵结构 (evaluateCastlingSidePawns)
 *    - 易位后王翼兵是否完整
 *    - 兵是否前移或被吃
 *
 * 7. 子力协调 (evaluatePieceCoordination)
 *    - 棋子之间的相互保护
 *    - 子力的协同作战能力
 *
 * 8. 重要棋子保护 (evaluateValuablePieceProtection)
 *    - 重要棋子（后、车）是否有保护
 *
 * 9. 兵结构 (evaluatePawnStructure)
 *    - 叠兵惩罚
 *    - 孤兵惩罚
 *    - 兵链完整性
 *
 * ============================================================================
 * 评估分值符号约定
 * ============================================================================
 *
 * 评估分数以白方视角计算：
 * - 正分：对白方有利
 * - 负分：对黑方有利
 *
 * 函数内部会根据棋子颜色和方向自动调整符号
 */

import { CENTER_SQUARES, DEVELOPMENT_SQUARES, PIECE_VALUES, POSITION_TABLES } from './config'
import {
  findPieceSquare,
  getEffectiveSupportTotal,
} from './boardUtils'
import {
  getGamePhase,
  getOpeningPhaseMoveCount,
  getPawnAdvancePenalty,
  getCastlingPlan,
  getPawnShieldSquares,
  getPawnShieldWeight,
  getCastledKingSquare,
  findPawnOnFile,
} from './moveScoringShared'

// ==================== 基础评估 ====================

/**
 * 获取棋子的位置评估bonus
 *
 * @param {Object} piece - 棋子对象 {type, color}
 * @param {number} rowIndex - 棋子在 board 数组中的行索引 (0-7)
 * @param {number} columnIndex - 棋子在 board 数组中的列索引 (0-7)
 * @returns {number} 位置评估分数
 *
 * 注意：
 * - 使用 POSITION_TABLES 时需要根据颜色翻转行索引
 * - 白方视角：rowIndex 0 是第8行（黑方初始兵行）
 * - 黑方视角：rowIndex 0 是第8行，所以不需要翻转
 */
function getPositionalBonus(piece, rowIndex, columnIndex) {
  const table = POSITION_TABLES[piece.type]

  if (!table) {
    return 0
  }

  // 白方棋子：翻转行索引（使其从白方视角计算）
  // 黑方棋子：直接使用原索引
  const normalizedRow = piece.color === 'w' ? rowIndex : 7 - rowIndex
  return table[normalizedRow][columnIndex]
}

// ==================== 发展评估 ====================

/**
 * 评估发展情况
 *
 * 开局阶段的发展评估：
 * - 未出动的马/象受惩罚
 * - 王未易位受惩罚
 * - 后过早出动受惩罚
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 发展评估分数
 */
export function evaluateDevelopment(game, difficulty) {
  if (!difficulty.openingWeight) {
    return 0
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)

  // 开局阶段（前8回合）以后不再评估
  if (fullmoveNumber > 8) {
    return 0
  }

  let score = 0

  // 分别评估白方和黑方
  for (const color of ['w', 'b']) {
    const direction = color === 'w' ? 1 : -1 // 白方加正分，黑方加负分
    const developmentSquares = DEVELOPMENT_SQUARES[color]

    // 统计未出动的马和象数量
    const undevelopedKnights = developmentSquares.knights.filter((square) => game.get(square)?.color === color).length
    const undevelopedBishops = developmentSquares.bishops.filter((square) => game.get(square)?.color === color).length

    // 检查王是否已易位
    const kingSquare = developmentSquares.castledSquares.find((square) => game.get(square)?.type === 'k' && game.get(square)?.color === color)

    // 检查后和王的初始位置
    const queenOnHomeSquare = game.get(developmentSquares.queen)?.type === 'q' && game.get(developmentSquares.queen)?.color === color
    const kingOnHomeSquare = game.get(developmentSquares.king)?.type === 'k' && game.get(developmentSquares.king)?.color === color

    // 找后的位置
    const queenSquare = findPieceSquare(game, color, 'q')

    // ========== 扣分项 ==========

    // 未出动的马/象扣分
    score -= direction * undevelopedKnights * difficulty.openingWeight * 1.25
    score -= direction * undevelopedBishops * difficulty.openingWeight * 1.25

    // ========== 加分项 ==========

    // 王已易位加分
    if (kingSquare) {
      score += direction * difficulty.openingWeight * 4
    } else if (kingOnHomeSquare && fullmoveNumber <= 6) {
      // 王仍在初始位置但还在开局阶段，扣分
      score -= direction * difficulty.openingWeight * 2
    }

    // ========== 后过早出动扣分 ==========

    // 条件：后已离开初始位置 + 还有2个以上子力未出动 + 前6步以内
    if (!queenOnHomeSquare && fullmoveNumber <= 6 && undevelopedKnights + undevelopedBishops >= 2) {
      score -= direction * difficulty.openingWeight * 7
    }

    // 后移动但子力未完全出动
    if (queenSquare && queenSquare !== developmentSquares.queen && undevelopedKnights + undevelopedBishops >= 2 && fullmoveNumber <= 8) {
      score -= direction * difficulty.openingWeight * 4
    }
  }

  return score
}

/**
 * 评估双方发展的平衡性
 *
 * 如果一方出动很多，另一方出动很少，则出动少的一方受惩罚
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 发展平衡评估分数
 */
export function evaluateBalancedDevelopment(game, difficulty) {
  if (!difficulty.openingWeight) {
    return 0
  }

  const phase = getGamePhase(game, difficulty)

  // 仅在开局和中局评估
  if (phase !== 'opening' && phase !== 'middlegame') {
    return 0
  }

  let score = 0

  for (const color of ['w', 'b']) {
    const direction = color === 'w' ? 1 : -1
    const home = DEVELOPMENT_SQUARES[color]

    // 已出动的马和象数量
    const knightsDeveloped = home.knights.filter((square) => game.get(square)?.color !== color).length
    const bishopsDeveloped = home.bishops.filter((square) => game.get(square)?.color !== color).length

    // 出动差异
    const minorGap = Math.abs(knightsDeveloped - bishopsDeveloped)
    const totalMinorDevelopment = knightsDeveloped + bishopsDeveloped

    let sideScore = 0

    // 马象出动不均衡扣分
    sideScore -= minorGap * difficulty.openingWeight * 1.5

    // 已出动的子力加分
    sideScore += totalMinorDevelopment * difficulty.openingWeight * 0.9

    // ========== 特殊局面加分/扣分 ==========

    // 双马双象全部出动（理想局面）
    if (knightsDeveloped === 2 && bishopsDeveloped === 2) {
      sideScore += difficulty.openingWeight * 2.2
    }

    // 严重不均衡：全是马没有象或全是象没有马
    if ((knightsDeveloped === 0 && bishopsDeveloped >= 2) || (bishopsDeveloped === 0 && knightsDeveloped >= 2)) {
      sideScore -= difficulty.openingWeight * 2.4
    }

    // 不均衡：只有一种子力
    if ((knightsDeveloped === 0 && bishopsDeveloped >= 1) || (bishopsDeveloped === 0 && knightsDeveloped >= 1)) {
      sideScore -= difficulty.openingWeight * 1.4
    }

    score += direction * sideScore
  }

  return score
}

// ==================== 中心控制 ====================

/**
 * 评估中心控制情况
 *
 * 每个走法能走到中心格子（D4/E4/D5/E5）则加分
 *
 * @param {Chess} game - 棋局实例
 * @param {number} centerWeight - 中心控制权重
 * @returns {number} 中心控制评估分数
 */
export function evaluateCenterControl(game, centerWeight) {
  if (!centerWeight) {
    return 0
  }

  let score = 0

  // 遍历当前所有合法走法
  for (const move of game.moves({ verbose: true })) {
    if (CENTER_SQUARES.has(move.to)) {
      // 白方走中心加分，黑方走中心减分
      score += move.color === 'w' ? centerWeight : -centerWeight
    }
  }

  return score
}

// ==================== 攻击压力 ====================

/**
 * 评估攻击压力
 *
 * 考虑：
 * - 攻击者数量和质量
 * - 防守者数量和质量
 * - 攻防交换情况
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 攻击压力评估分数
 */
export function evaluateAttackPressure(game, difficulty) {
  if (!difficulty.attackWeight) {
    return 0
  }

  let score = 0
  const board = game.board()

  // 遍历棋盘上所有棋子
  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (!piece) continue

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const defenders = getEffectiveSupportTotal(game, square, piece.color)
      const enemyColor = piece.color === 'w' ? 'b' : 'w'
      const attackers = getEffectiveSupportTotal(game, square, enemyColor)

      // 无攻击无防守，跳过
      if (attackers === 0 && defenders === 0) {
        continue
      }

      const direction = piece.color === 'w' ? 1 : -1
      const baseValue = piece.type === 'k' ? 400 : PIECE_VALUES[piece.type]
      const exchangeMargin = defenders - attackers
      let pressureScore = 0

      // ========== 攻防情况评估 ==========

      if (attackers > 0 && defenders === 0) {
        // 纯攻击：无防守
        pressureScore -= baseValue * 0.35
      } else if (attackers > defenders) {
        // 攻击方占优
        pressureScore -= (attackers - defenders) * baseValue * 0.22
      } else if (attackers > 0 && defenders >= attackers) {
        // 防守方占优或均势
        pressureScore += Math.min(defenders - attackers + 1, 2) * baseValue * 0.08
      } else if (defenders > 0) {
        // 纯防守
        pressureScore += Math.min(exchangeMargin, 2) * baseValue * 0.03
      }

      score += direction * pressureScore * difficulty.attackWeight
    }
  }

  return score
}

// ==================== 易位侧兵结构 ====================

/**
 * 评估易位侧兵结构
 *
 * 易位后，王翼/后翼的兵结构完整性对王的安全至关重要
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 兵结构评估分数
 */
export function evaluateCastlingSidePawns(game, difficulty) {
  if (!difficulty.castlePawnWeight) {
    return 0
  }

  const phase = getGamePhase(game, difficulty)

  // 仅在开局和中局评估
  if (phase !== 'opening' && phase !== 'middlegame') {
    return 0
  }

  let score = 0

  for (const color of ['w', 'b']) {
    const castlingPlan = getCastlingPlan(game, color)

    if (!castlingPlan) {
      continue
    }

    const direction = color === 'w' ? 1 : -1
    const shieldSquares = getPawnShieldSquares(color, castlingPlan) // 需要保护的兵格子
    const isCastled = findPieceSquare(game, color, 'k') === getCastledKingSquare(color, castlingPlan) // 是否已易位

    // 检查每个兵格
    for (const square of shieldSquares) {
      const pawnSquare = findPawnOnFile(game, color, square[0])
      const fileWeight = getPawnShieldWeight(color, castlingPlan, square[0]) // 靠近王的兵更重要
      const castledMultiplier = isCastled ? 1.8 : 1 // 易位后兵结构更重要

      if (!pawnSquare) {
        // 兵缺失，严重的结构问题
        score -= direction * difficulty.castlePawnWeight * 1.4 * fileWeight * castledMultiplier
        continue
      }

      const piece = game.get(pawnSquare)
      // 兵前移越多，惩罚越大
      score -= direction * getPawnAdvancePenalty(piece, pawnSquare) * difficulty.castlePawnWeight * fileWeight * castledMultiplier
    }
  }

  return score
}

// ==================== 子力协调 ====================

/**
 * 评估棋子之间的协调性
 *
 * 有保护的棋子更有价值
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 子力协调评估分数
 */
export function evaluatePieceCoordination(game, difficulty) {
  if (!difficulty.coordinationWeight) {
    return 0
  }

  let score = 0
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      // 只评估非兵非王棋子
      if (!piece || piece.type === 'p' || piece.type === 'k') {
        continue
      }

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const defenders = getEffectiveSupportTotal(game, square, piece.color)

      if (defenders === 0) {
        continue
      }

      const direction = piece.color === 'w' ? 1 : -1
      const baseValue = PIECE_VALUES[piece.type]

      // 有1-3个防守者时获得加成
      const supportBonus = Math.min(defenders, 3) * baseValue * 0.11
      score += direction * supportBonus * difficulty.coordinationWeight
    }
  }

  return score
}

/**
 * 评估重要棋子的保护情况
 *
 * 后的保护尤为重要
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 重要棋子保护评估分数
 */
export function evaluateValuablePieceProtection(game, difficulty) {
  if (!difficulty.coordinationWeight) {
    return 0
  }

  const openingPhase = getOpeningPhaseMoveCount(game) <= 12
  let score = 0
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      // 只评估非兵非王棋子
      if (!piece || piece.type === 'p' || piece.type === 'k') {
        continue
      }

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const direction = piece.color === 'w' ? 1 : -1
      const defenders = getEffectiveSupportTotal(game, square, piece.color)
      const baseValue = PIECE_VALUES[piece.type]

      let bonus = Math.min(defenders, 3) * baseValue * 0.08

      // 开局阶段无保护的棋子额外惩罚
      if (openingPhase && defenders < 1) {
        bonus -= baseValue * 0.18
      }

      score += direction * bonus * difficulty.coordinationWeight
    }
  }

  return score
}

// ==================== 兵结构 ====================

/**
 * 评估兵结构
 *
 * 检查：
 * - 叠兵（同一文件多个兵）
 * - 孤兵（左右都没有相邻兵）
 * - 兵链完整性
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 兵结构评估分数
 */
export function evaluatePawnStructure(game, difficulty) {
  if (!difficulty.pawnStructureWeight) {
    return 0
  }

  let score = 0

  for (const color of ['w', 'b']) {
    const direction = color === 'w' ? 1 : -1
    const pawnSquares = game.findPiece({ type: 'p', color }).sort()
    const enemyPawns = game.findPiece({ type: 'p', color: color === 'w' ? 'b' : 'w' })
    const fileCounts = new Map() // 每个文件的兵数量

    // 统计每个文件的兵数量
    for (const square of pawnSquares) {
      fileCounts.set(square[0], (fileCounts.get(square[0]) ?? 0) + 1)
    }

    // 评估每个兵
    for (const square of pawnSquares) {
      const file = square.charCodeAt(0) - 97
      const fileChar = square[0]
      const sameFileCount = fileCounts.get(fileChar) ?? 0
      const hasLeftNeighbor = file > 0 && (fileCounts.get(String.fromCharCode(96 + file)) ?? 0) > 0
      const hasRightNeighbor = file < 7 && (fileCounts.get(String.fromCharCode(98 + file)) ?? 0) > 0
      const rank = Number.parseInt(square[1], 10)
      const advance = color === 'w' ? rank - 2 : 7 - rank // 前进了多少格
      let pawnScore = 0

      // ========== 叠兵惩罚 ==========
      if (sameFileCount > 1) {
        pawnScore -= (sameFileCount - 1) * 14
      }

      // ========== 孤兵惩罚 ==========
      if (!hasLeftNeighbor && !hasRightNeighbor) {
        pawnScore -= 16
      }

      // ========== 有相邻兵加分 ==========
      if (hasLeftNeighbor || hasRightNeighbor) {
        pawnScore += 8
      }

      // ========== 兵链评估 ==========
      // 检查是否有敌方兵在前方斜线位置（阻挡）
      const adjacentEnemyPawns = enemyPawns.some((enemySquare) => {
        const enemyFile = enemySquare.charCodeAt(0) - 97
        const enemyRank = Number.parseInt(enemySquare[1], 10)
        const sameOrAdjacentFile = Math.abs(enemyFile - file) <= 1

        if (!sameOrAdjacentFile) {
          return false
        }

        // 白方兵前方的敌方兵应该 rank 更大（更靠近白方初始行）
        // 黑方兵前方的敌方兵应该 rank 更小
        return color === 'w' ? enemyRank > rank : enemyRank < rank
      })

      // 无敌方兵在前方，兵可以继续前进
      if (!adjacentEnemyPawns) {
        pawnScore += 12 + advance * 3
      }

      score += direction * pawnScore * difficulty.pawnStructureWeight
    }
  }

  return score
}

// ==================== 主评估函数 ====================

/**
 * 局面综合评估
 *
 * 汇总所有评估项目计算局面分数
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 局面评估分数（白方视角）
 *
 * 评估项目（按顺序）：
 * 1. 基础子力和位置分（循环棋盘计算）
 * 2. 中心控制
 * 3. 发展评估
 * 4. 平衡发展
 * 5. 攻击压力
 * 6. 易位侧兵结构
 * 7. 子力协调
 * 8. 重要棋子保护
 * 9. 兵结构
 */
export function evaluateBoard(game, difficulty) {
  let score = 0
  const board = game.board()

  // ========== 第一部分：基础子力和位置评估 ==========
  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (!piece) continue

      // 棋子基础价值
      const value = PIECE_VALUES[piece.type]

      // 位置评估分
      const positionalBonus = difficulty.usePositionalEval
        ? getPositionalBonus(piece, rowIndex, columnIndex) * (difficulty.positionalWeight ?? 1)
        : 0

      // 符号：白方加正分，黑方加负分
      const direction = piece.color === 'w' ? 1 : -1

      // 累加子力价值 + 位置分
      score += (value + positionalBonus) * direction

      // 中心格子额外加分
      if (difficulty.centerWeight && CENTER_SQUARES.has(`${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`)) {
        score += direction * difficulty.centerWeight
      }
    }
  }

  // ========== 第二部分：综合评估 ==========
  return score
    + evaluateCenterControl(game, difficulty.centerWeight)
    + evaluateDevelopment(game, difficulty)
    + evaluateBalancedDevelopment(game, difficulty)
    + evaluateAttackPressure(game, difficulty)
    + evaluateCastlingSidePawns(game, difficulty)
    + evaluatePieceCoordination(game, difficulty)
    + evaluateValuablePieceProtection(game, difficulty)
    + evaluatePawnStructure(game, difficulty)
}