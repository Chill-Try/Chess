/**
 * @file ai/moveScoring.js
 * @description 候选走法筛选与单步启发式评分
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 本模块负责对单个走法进行评估和筛选：
 *
 * 1. 开局走法过滤 (filterOpeningMoves)
 *    - 排除不合理的开局走法
 *    - 优先选择符合开局原则的走法
 *
 * 2. 开局阶段评分 (getOpeningPhaseScore)
 *    - 易位加分
 *    - 兵/马/象出动加分
 *    - 后/王过早移动减分
 *    - 重复走子减分
 *    - 中心控制加分
 *
 * 3. 走法安全性评估
 *    - 移动后是否被将军
 *    - 是否暴露己方国王
 *    - 敌方反击威胁
 *
 * 4. 战术动机评估
 *    - 能否攻击多个目标
 *    - 能否将军
 *    - 牵制战术
 *
 * 5. 吃子决策评估 (evaluateCaptureDecision)
 *    - 交换是否合算
 *    - 是否被后续攻击
 *
 * ============================================================================
 * 与其他模块的关系
 * ============================================================================
 *
 * 本模块被 chess-ai.js 中的 scoreComputerMoves 调用
 *
 * 依赖的模块：
 * - boardUtils.js: 攻击者信息、威胁识别等
 * - moveScoringShared.js: 阶段判断、棋子发展状态
 */

import { Chess } from 'chess.js'
import { CENTER_SQUARES, DEVELOPMENT_SQUARES, PIECE_VALUES } from './config'
import {
  findPieceSquare,
  getAttackedEnemyPieces,
  getAttackersInfo,
  getEffectiveSupportInfo,
  getEffectiveSupportTotal,
  getLeastValuableAttacker,
  getLinePressureTargets,
  getThreatenedPieces,
  isClearlyLowerValue,
  getLastMoveByColor,
  getRecentMovesByColor,
} from './boardUtils'
import {
  getCastledKingSquare,
  getCastlingPlan,
  getGamePhase,
  getOpeningPhaseMoveCount,
  getPawnShieldSquares,
  getPawnShieldWeight,
  isEarlyKingWalk,
  isEarlyQueenMove,
  isPieceDeveloped,
  isTacticalMove,
} from './moveScoringShared'

// ==================== 开局走法过滤 ====================

/**
 * 判断是否为重复发展走法
 *
 * 重复发展指同一棋子多次连续出动，浪费步数
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} move - 走法对象
 * @param {number} fullmoveNumber - 当前回合数
 * @returns {boolean} 是否为重复发展走法
 *
 * 条件：
 * 1. fullmoveNumber <= 16（还在开局阶段）
 * 2. 上一步是自己走的
 * 3. 上一步和这一步是同一个棋子继续移动
 * 4. 不是战术走法（吃子、将军）
 */
function isRepeatedDevelopmentMove(game, move, fullmoveNumber) {
  if (fullmoveNumber > 16) {
    return false
  }

  // 获取上一步己方走法
  const lastOwnMove = getLastMoveByColor(game, move.color)

  if (!lastOwnMove) {
    return false
  }

  // 同一棋子继续移动
  const isSamePieceContinuing = lastOwnMove.to === move.from && lastOwnMove.piece === move.piece
  const tacticalMove = isTacticalMove(move)

  return isSamePieceContinuing && !tacticalMove
}

/**
 * 过滤开局候选走法
 *
 * 开局阶段只保留合理走法，排除不成熟的走法
 *
 * @param {Chess} game - 棋局实例
 * @param {Object[]} moves - 所有合法走法
 * @param {Object} difficulty - 难度配置
 * @returns {Object[]} 过滤后的走法列表
 *
 * 过滤规则：
 * 1. 战术走法（吃子、将军）始终保留
 * 2. 易位始终保留
 * 3. 兵、马、象的重复发展走法排除
 * 4. 其他走法正常保留
 *
 * 注意：如果过滤后为空，则返回原始列表
 */
export function filterOpeningMoves(game, moves, difficulty) {
  if (!difficulty.openingWeight) {
    return moves
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)

  if (fullmoveNumber > 16) {
    return moves
  }

  const preferredMoves = moves.filter((move) => {
    // 战术走法保留
    if (isTacticalMove(move)) {
      return true
    }

    // 易位保留
    if (move.flags.includes('k') || move.flags.includes('q')) {
      return true
    }

    // 兵、马、象的重复发展走法排除
    if (move.piece === 'p' || move.piece === 'n' || move.piece === 'b') {
      return !isRepeatedDevelopmentMove(game, move, fullmoveNumber)
    }

    return false
  })

  return preferredMoves.length > 0 ? preferredMoves : moves
}

// ==================== 开局阶段评分 ====================

/**
 * 计算开局阶段走法评分
 *
 * @param {Object} move - 走法对象
 * @param {Chess} game - 走法执行前的棋局实例
 * @param {Object} difficulty - 难度配置
 * @returns {number} 开局阶段评分
 */
export function getOpeningPhaseScore(move, game, difficulty) {
  if (!difficulty.openingWeight) {
    return 0
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)

  if (fullmoveNumber > 16) {
    return 0
  }

  let score = 0
  const movingSide = move.color
  const developmentSquares = DEVELOPMENT_SQUARES[movingSide]

  // 统计未出动的子力数量
  const undevelopedMinors = [...developmentSquares.knights, ...developmentSquares.bishops]
    .filter((square) => game.get(square)?.color === movingSide).length

  const isCastlingMove = move.flags.includes('k') || move.flags.includes('q')

  // ========== 加分项 ==========

  // 易位加分（最重要的开局走法之一）
  if (isCastlingMove) {
    score += difficulty.openingWeight * 4
  }

  // 兵移动加分（控制中心）
  if (move.piece === 'p') {
    score += difficulty.openingWeight
  }

  // 马/象出动加分（发展）
  if (move.piece === 'n' || move.piece === 'b') {
    score += difficulty.openingWeight * 2
  }

  // ========== 扣分项 ==========

  // 后过早出动扣分（应该在马象之后）
  if (move.piece === 'q' && fullmoveNumber <= 4) {
    score -= difficulty.openingWeight * (undevelopedMinors >= 3 ? 6 : 4)
  }

  // 早走后减分（后不应该在前几回合离开）
  if (isEarlyQueenMove(move, fullmoveNumber) && !move.captured && !move.san.includes('+')) {
    score -= difficulty.openingWeight * 5
  }

  // 车过早移动扣分（非易位情况）
  if (move.piece === 'r' && !move.flags.includes('k') && !move.flags.includes('q') && fullmoveNumber <= 5) {
    score -= difficulty.openingWeight
  }

  // 王过早步行（未易位）扣分
  if (isEarlyKingWalk(move, fullmoveNumber)) {
    score -= difficulty.openingWeight * 8
  }

  // 重复发展走子扣分
  if (isRepeatedDevelopmentMove(game, move, fullmoveNumber)) {
    score -= difficulty.openingWeight * (move.piece === 'q' ? 8 : 5)
  }

  // 中心控制加分
  if (difficulty.centerWeight && CENTER_SQUARES.has(move.to)) {
    score += difficulty.centerWeight
  }

  return score
}

// ==================== 重复走子惩罚 ====================

/**
 * 评估重复走子惩罚
 *
 * 同一棋子反复移动会浪费步数
 *
 * @param {Chess} game - 走法执行后的棋局实例
 * @param {Object} move - 走法对象
 * @returns {number} 惩罚值
 */
export function evaluateRepeatedPiecePenalty(game, move) {
  // 战术走法不惩罚
  if (isTacticalMove(move)) {
    return 0
  }

  const recentMoves = getRecentMovesByColor(game, move.color, 2)

  if (recentMoves.length === 0) {
    return 0
  }

  let penalty = 0
  const [lastMove, previousMove] = recentMoves

  // 上一步走完又走回来（如 Nf3 Ng1 Nf3 Ng1）
  if (lastMove.to === move.from && lastMove.piece === move.piece) {
    penalty += move.piece === 'q' ? 110 : 70
  }

  // 刚走了一步又返回（如 Nf3 Nd2 Nf3 Nd2）
  if (lastMove.from === move.to && lastMove.to === move.from && lastMove.piece === move.piece) {
    penalty += move.piece === 'q' ? 175 : 125
  }

  // 上上步在这里，这一步又去
  if (previousMove && previousMove.to === move.from && previousMove.from === move.to && previousMove.piece === move.piece) {
    penalty += move.piece === 'q' ? 120 : 82
  }

  // 非兵非王棋子惩罚加倍
  if (move.piece !== 'p' && move.piece !== 'k' && penalty > 0) {
    penalty *= 1.25
  }

  return penalty
}

// ==================== 稳定性惩罚 ====================

/**
 * 评估棋子稳定性惩罚
 *
 * 动了已出动的棋子，使其暴露在被攻击中
 *
 * @param {Chess} game - 走法执行后的棋局实例
 * @param {Object} move - 走法对象
 * @param {Object} difficulty - 难度配置
 * @returns {number} 稳定性惩罚值
 */
export function evaluateStablePiecePenalty(game, move, difficulty) {
  const phase = getGamePhase(game, difficulty)

  // 仅在开局和中局评估，且排除兵、王、战术走法
  if ((phase !== 'opening' && phase !== 'middlegame') || move.piece === 'p' || move.piece === 'k' || isTacticalMove(move)) {
    return 0
  }

  const piece = game.get(move.from)

  // 如果是未发展的棋子，不惩罚
  if (!piece || !isPieceDeveloped(move.from, piece)) {
    return 0
  }

  const enemyColor = move.color === 'w' ? 'b' : 'w'
  const currentAttackers = getEffectiveSupportTotal(game, move.from, enemyColor)
  const currentDefenders = getEffectiveSupportTotal(game, move.from, move.color)

  // 无攻击方或防守方占优，不惩罚
  if (currentAttackers > 0 && currentAttackers >= currentDefenders) {
    return 0
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)
  let penalty = PIECE_VALUES[move.piece] * 0.08

  // 开局阶段惩罚更高
  if (phase === 'opening') {
    penalty *= 1.55
  }

  // 前12回合惩罚更高
  if (fullmoveNumber <= 12) {
    penalty *= 1.2
  }

  return penalty
}

// ==================== 不均衡子力调动惩罚 ====================

/**
 * 评估不均衡马象调动惩罚
 *
 * 只动一个马/象而另一个不动，通常不是好棋
 *
 * @param {Chess} game - 走法执行后的棋局实例
 * @param {Object} move - 走法对象
 * @param {Object} difficulty - 难度配置
 * @returns {number} 惩罚值
 */
export function evaluateUnevenMinorRedeployment(game, move, difficulty) {
  if (isTacticalMove(move) || !['n', 'b'].includes(move.piece)) {
    return 0
  }

  const phase = getGamePhase(game, difficulty)

  if (phase !== 'opening' && phase !== 'middlegame') {
    return 0
  }

  const developmentSquares = DEVELOPMENT_SQUARES[move.color]
  const siblingSquares = move.piece === 'n' ? developmentSquares.knights : developmentSquares.bishops

  // 统计未出动的同类棋子数量
  const undevelopedSiblingCount = siblingSquares.filter((square) => game.get(square)?.color === move.color).length
  const piece = game.get(move.from)

  // 未发展的棋子移动不惩罚
  if (!piece || !isPieceDeveloped(move.from, piece) || undevelopedSiblingCount === 0) {
    return 0
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)
  let penalty = difficulty.openingWeight * (move.piece === 'b' ? 2.6 : 2.2)

  // 两个都没动就动一个，惩罚更高
  if (undevelopedSiblingCount === siblingSquares.length) {
    penalty *= 1.35
  }

  // 前12回合惩罚更高
  if (fullmoveNumber <= 12) {
    penalty *= 1.15
  }

  return penalty
}

// ==================== 早期过度前冲惩罚 ====================

/**
 * 评估早期子力过度前冲惩罚
 *
 * 子力过于前进会失去保护，容易被攻击
 *
 * @param {Chess} game - 走法执行后的棋局实例
 * @param {Object} move - 走法对象
 * @param {Object} difficulty - 难度配置
 * @returns {number} 惩罚值
 */
export function evaluateEarlyPieceOverextension(game, move, difficulty) {
  if (move.piece === 'p' || move.piece === 'k') {
    return 0
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)

  if (fullmoveNumber > 12) {
    return 0
  }

  const targetRank = Number.parseInt(move.to[1], 10)
  const advance = move.color === 'w' ? targetRank - 2 : 7 - targetRank
  const threshold = move.piece === 'n' || move.piece === 'b' ? 2 : 1 // 马/象可以稍前进，车/后不行

  if (advance <= threshold) {
    return 0
  }

  return (advance - threshold) * PIECE_VALUES[move.piece] * 0.1 * (difficulty.coordinationWeight ?? 0)
}

// ==================== 走子安全性评估 ====================

/**
 * 评估移动后棋子的安全性
 *
 * 核心问题：
 * - 移动后是否被攻击
 * - 攻击者的质量如何
 * - 防守者是否能保护
 *
 * @param {Chess} game - 走法执行后的棋局实例
 * @param {Object} move - 走法对象
 * @param {Object} difficulty - 难度配置
 * @returns {number} 安全性惩罚值
 */
export function evaluateMovedPieceSafety(game, move, difficulty) {
  if (!difficulty.blunderWeight) {
    return 0
  }

  const movedPiece = game.get(move.to)

  if (!movedPiece) {
    return 0
  }

  const enemyColor = movedPiece.color === 'w' ? 'b' : 'w'
  const attackers = game.attackers(move.to, enemyColor).length
  const defenders = game.attackers(move.to, movedPiece.color).length

  // 无攻击，安全
  if (attackers === 0) {
    return 0
  }

  const pieceValue = movedPiece.type === 'k' ? 2000 : PIECE_VALUES[movedPiece.type]
  const leastAttacker = getLeastValuableAttacker(game, move.to, enemyColor)
  const leastDefender = getLeastValuableAttacker(game, move.to, movedPiece.color)
  const isQuietMove = !move.captured && !move.san.includes('+') && !move.san.includes('#') // 静步（非吃子非将军）
  let penalty = 0

  // ========== 攻防数量评估 ==========

  if (defenders === 0) {
    // 无防守，严重惩罚
    penalty += pieceValue * 1.2
  } else if (attackers > defenders) {
    // 攻击方人多
    penalty += (attackers - defenders) * pieceValue * 0.55
  } else if (attackers === defenders) {
    penalty += pieceValue * 0.12
  }

  // ========== 低价值攻击惩罚 ==========

  if (leastAttacker && isClearlyLowerValue(leastAttacker.value, pieceValue)) {
    // 被小棋子攻击（如兵吃马）
    penalty += (pieceValue - leastAttacker.value) * 1.1
  }

  // ========== 交换评估 ==========

  if (leastAttacker && leastDefender && leastAttacker.value < leastDefender.value) {
    // 攻击方棋子比防守方价值低
    penalty += (leastDefender.value - leastAttacker.value) * 0.6
  }

  // ========== 兵攻击特殊惩罚 ==========

  if (leastAttacker?.piece.type === 'p' && movedPiece.type !== 'p') {
    // 被兵攻击的非兵棋子
    penalty += pieceValue * 0.5
  }

  // ========== 静步额外惩罚 ==========

  if (isQuietMove && leastAttacker && isClearlyLowerValue(leastAttacker.value, pieceValue) && (!leastDefender || leastDefender.value > leastAttacker.value)) {
    penalty += (pieceValue - leastAttacker.value) * 0.9
  }

  if (isQuietMove && leastAttacker && isClearlyLowerValue(leastAttacker.value, pieceValue) && defenders <= attackers) {
    penalty += pieceValue * 0.9
  }

  if (isQuietMove && movedPiece.type === 'n' && leastAttacker?.piece.type === 'p') {
    // 马被兵攻击
    penalty += pieceValue * 0.8
  }

  if (isQuietMove && movedPiece.type !== 'p' && leastAttacker?.piece.type === 'p' && defenders === 0) {
    // 非兵棋子被兵攻击且无防守
    penalty += pieceValue * 1.1
  }

  if (isQuietMove && leastAttacker?.piece.type === 'q' && defenders <= attackers) {
    // 被后攻击
    penalty += pieceValue * 0.35
  }

  // 静步惩罚加倍
  if (isQuietMove) {
    penalty *= 1.25
  }

  return penalty * difficulty.blunderWeight
}

// ==================== 吃子决策评估 ====================

/**
 * 评估吃子决策
 *
 * 是否应该吃子需要考虑：
 * - 交换是否合算
 * - 是否有后续攻击
 * - 防守方棋子质量
 *
 * @param {Chess} game - 走法执行前的棋局实例
 * @param {Chess} nextGame - 走法执行后的棋局实例
 * @param {Object} move - 走法对象
 * @returns {number} 吃子决策评分
 */
export function evaluateCaptureDecision(currentGame, nextGame, move) {
  if (!move.captured) {
    return 0
  }

  const movedPiece = nextGame.get(move.to)

  if (!movedPiece) {
    return 0
  }

  const attackerValue = movedPiece.type === 'k' ? 2000 : PIECE_VALUES[movedPiece.type]
  const capturedValue = PIECE_VALUES[move.captured]
  const enemyColor = move.color === 'w' ? 'b' : 'w'
  const defenders = getEffectiveSupportInfo(currentGame, move.to, enemyColor)
  const leastDefender = defenders[0] ?? null
  let score = 0

  // ========== 交换合算性 ==========

  // 吃比己方价值更高的棋子
  if (capturedValue >= attackerValue) {
    score += (capturedValue - attackerValue + 40) * 0.5
  }

  // ========== 吃兵升变机会 ==========

  if (move.captured === 'p' && movedPiece.type !== 'p') {
    // 吃兵并可能威胁升变
    score += 35
  }

  // ========== 防守方质量 ==========

  if (leastDefender && leastDefender.value >= attackerValue + 40) {
    // 防守方棋子质量很高，可能有陷阱
    score += (leastDefender.value - attackerValue) * 0.45
  }

  // ========== 防守方类型 ==========

  if (defenders.length > 0 && defenders.every((defender) => defender.piece.type === 'q' || defender.piece.type === 'k' || defender.effectiveness < 0.45)) {
    // 所有防守者都是后/王/效率低，交换合算
    score += capturedValue * 0.9 + 40
  }

  if (defenders.some((defender) => defender.piece.type === 'k' || defender.effectiveness < 0.2)) {
    // 有国王或效率极低的防守者
    score += 18
  }

  return score
}

// ==================== 战术动机评估 ====================

/**
 * 评估战术动机
 *
 * 走法是否具有战术价值：
 * - 双重攻击
 * - 牵制
 * - 将军威胁
 *
 * @param {Chess} game - 走法执行前的棋局实例
 * @param {Chess} nextGame - 走法执行后的棋局实例
 * @param {Object} move - 走法对象
 * @param {Object} difficulty - 难度配置
 * @returns {number} 战术评分
 */
export function evaluateTacticalMotifs(currentGame, nextGame, move, difficulty) {
  if (!difficulty.tacticalWeight) {
    return 0
  }

  const movedPiece = nextGame.get(move.to)

  if (!movedPiece) {
    return 0
  }

  const enemyColor = move.color === 'w' ? 'b' : 'w'
  let score = 0

  // ========== 双重攻击 ==========

  const attackedPieces = getAttackedEnemyPieces(nextGame, move.color, move.to)
  const valuableTargets = attackedPieces.filter(({ piece }) => piece.type !== 'p')

  if (valuableTargets.length >= 2) {
    // 攻击两个有价值目标
    score += 70
  } else if (nextGame.isCheck() && valuableTargets.length >= 1) {
    // 将军并同时攻击其他棋子
    score += 52
  }

  // ========== 将军攻击 ==========

  const enemyKingSquare = findPieceSquare(nextGame, enemyColor, 'k')

  if (enemyKingSquare) {
    const kingAttackers = getAttackedEnemyPieces(nextGame, move.color, move.to)

    // 将军并有多个攻击者
    if (kingAttackers.some((target) => target.square === enemyKingSquare) && kingAttackers.length >= 2) {
      score += 95
    }
  }

  // ========== 新攻击目标 ==========

  const beforeAttacks = getAttackedEnemyPieces(currentGame, move.color, move.from)
  const newlyAttackedSquares = attackedPieces.filter(({ square }) => !beforeAttacks.some((before) => before.square === square))

  if (newlyAttackedSquares.length >= 1 && move.from !== move.to) {
    score += 34
    if (nextGame.isCheck()) {
      score += 28
    }
  }

  // ========== 直线压力 ==========

  for (const target of getLinePressureTargets(nextGame, move.to, move.color)) {
    if (target.back.piece.type === 'k') {
      // 穿透攻击到国王
      score += 62
      continue
    }

    if (target.front.value < target.back.value) {
      // 攻击比阻挡更有价值的棋子
      score += 54
    } else if (target.front.value > target.back.value) {
      score += 40
    }
  }

  // ========== 孤立防守者战术 ==========

  const enemyBoard = nextGame.board()

  for (let rowIndex = 0; rowIndex < enemyBoard.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < enemyBoard[rowIndex].length; columnIndex += 1) {
      const piece = enemyBoard[rowIndex][columnIndex]

      if (!piece || piece.color !== enemyColor) {
        continue
      }

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const defenders = getAttackersInfo(nextGame, square, enemyColor)

      // 只有一个防守者
      if (defenders.length !== 1) {
        continue
      }

      const soleDefender = defenders[0]
      const defendedSquares = getAttackedEnemyPieces(nextGame, enemyColor, soleDefender.square)

      // 该防守者防守多个目标，可能是战术机会
      if (defendedSquares.length >= 2) {
        score += 36
      }
    }
  }

  return score * difficulty.tacticalWeight
}

// ==================== 对手战术风险评估 ====================

/**
 * 评估对手的战术风险
 *
 * 考虑对手可能的反击
 *
 * @param {Chess} nextGame - 走法执行后的棋局实例
 * @param {Object} difficulty - 难度配置
 * @param {Function} getMoveOrderingScore - 走法排序函数
 * @returns {number} 风险值
 */
export function evaluateOpponentTacticalRisk(nextGame, difficulty, getMoveOrderingScore) {
  if (!difficulty.tacticalWeight) {
    return 0
  }

  const replies = nextGame.moves({ verbose: true })

  if (replies.length === 0) {
    return 0
  }

  let worstRisk = 0

  // 只评估前10个最佳应招
  const sampledReplies = replies
    .sort((left, right) => getMoveOrderingScore(right, difficulty) - getMoveOrderingScore(left, difficulty))
    .slice(0, 10)

  for (const reply of sampledReplies) {
    const replyGame = new Chess(nextGame.fen())
    replyGame.move(reply)

    // 计算该应招的战术价值
    const tacticalRisk = evaluateTacticalMotifs(nextGame, replyGame, reply, difficulty)
    const captureRisk = evaluateCaptureDecision(nextGame, replyGame, reply)
    const immediateDamage = evaluateMovedPieceSafety(replyGame, reply, difficulty)

    // 累加风险
    worstRisk = Math.max(worstRisk, tacticalRisk + captureRisk + immediateDamage * 0.35)
  }

  return worstRisk * 0.55
}

// ==================== 忽视威胁惩罚 ====================

/**
 * 评估忽视威胁惩罚
 *
 * 当己方有被威胁的棋子时，走其他棋着会忽略这些威胁
 *
 * @param {Chess} game - 走法执行前的棋局实例
 * @param {Chess} nextGame - 走法执行后的棋局实例
 * @param {Object} move - 走法对象
 * @param {Object} difficulty - 难度配置
 * @returns {number} 惩罚值
 */
export function evaluateIgnoredThreats(currentGame, nextGame, move, difficulty) {
  if (!difficulty.blunderWeight) {
    return 0
  }

  const threatenedPieces = getThreatenedPieces(currentGame, move.color)

  if (threatenedPieces.length === 0) {
    return 0
  }

  let penalty = 0

  for (const threat of threatenedPieces) {
    const nextPiece = nextGame.get(threat.square)

    // 检查被威胁的棋子是否仍然存在且未被保护
    if (!nextPiece || nextPiece.color !== move.color || nextPiece.type !== threat.piece.type) {
      continue
    }

    const enemyColor = move.color === 'w' ? 'b' : 'w'
    const nextLeastAttacker = getLeastValuableAttacker(nextGame, threat.square, enemyColor)

    // 没有更弱的攻击者了
    if (!nextLeastAttacker || nextLeastAttacker.value > threat.pieceValue) {
      continue
    }

    const defenders = nextGame.attackers(threat.square, move.color).length
    const attackers = nextGame.attackers(threat.square, enemyColor).length
    let threatPenalty = threat.pieceValue * 0.75

    // 被兵攻击惩罚更高
    if (nextLeastAttacker.piece.type === 'p') {
      threatPenalty += threat.pieceValue * 0.9
    }

    // 攻击者多于防守者
    if (attackers > defenders) {
      threatPenalty += (attackers - defenders) * threat.pieceValue * 0.45
    }

    // 静步且不走威胁棋，惩罚加倍
    if (move.to !== threat.square && !move.captured && !move.san.includes('+') && !move.san.includes('#')) {
      threatPenalty *= 1.2
    }

    penalty += threatPenalty
  }

  return penalty * difficulty.blunderWeight
}

// ==================== 王翼兵移动惩罚 ====================

/**
 * 评估王翼兵移动惩罚
 *
 * 易位后移动王翼兵会削弱对王的保护
 *
 * @param {Chess} game - 走法执行前的棋局实例
 * @param {Object} move - 走法对象
 * @param {Object} difficulty - 难度配置
 * @returns {number} 惩罚值
 */
export function getShieldPawnMovePenalty(game, move, difficulty) {
  if (!difficulty.castlePawnWeight || move.piece !== 'p') {
    return 0
  }

  const phase = getGamePhase(game, difficulty)

  if (phase !== 'opening' && phase !== 'middlegame') {
    return 0
  }

  const castlingPlan = getCastlingPlan(game, move.color)

  if (!castlingPlan) {
    return 0
  }

  // 检查是否移动了王翼/后翼的兵
  const watchedFiles = getPawnShieldSquares(move.color, castlingPlan).map((square) => square[0])

  if (!watchedFiles.includes(move.from[0])) {
    return 0
  }

  const fileWeight = getPawnShieldWeight(move.color, castlingPlan, move.from[0])
  const isCastled = findPieceSquare(game, move.color, 'k') === getCastledKingSquare(move.color, castlingPlan)
  const castledMultiplier = isCastled ? 2.2 : 1.3 // 已易位时兵更重要
  const stepDistance = Math.abs(Number.parseInt(move.to[1], 10) - Number.parseInt(move.from[1], 10))

  return difficulty.castlePawnWeight * fileWeight * castledMultiplier * (0.9 + stepDistance * 0.8)
}