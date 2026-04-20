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

function isRepeatedDevelopmentMove(game, move, fullmoveNumber) {
  if (fullmoveNumber > 16) {
    return false
  }

  const lastOwnMove = getLastMoveByColor(game, move.color)

  if (!lastOwnMove) {
    return false
  }

  const isSamePieceContinuing = lastOwnMove.to === move.from && lastOwnMove.piece === move.piece
  const tacticalMove = isTacticalMove(move)

  return isSamePieceContinuing && !tacticalMove
}

export function filterOpeningMoves(game, moves, difficulty) {
  if (!difficulty.openingWeight) {
    return moves
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)

  if (fullmoveNumber > 16) {
    return moves
  }

  const preferredMoves = moves.filter((move) => {
    if (isTacticalMove(move)) {
      return true
    }

    if (move.flags.includes('k') || move.flags.includes('q')) {
      return true
    }

    if (move.piece === 'p' || move.piece === 'n' || move.piece === 'b') {
      return !isRepeatedDevelopmentMove(game, move, fullmoveNumber)
    }

    return false
  })

  return preferredMoves.length > 0 ? preferredMoves : moves
}

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
  const undevelopedMinors = [...developmentSquares.knights, ...developmentSquares.bishops]
    .filter((square) => game.get(square)?.color === movingSide).length
  const isCastlingMove = move.flags.includes('k') || move.flags.includes('q')

  if (isCastlingMove) {
    score += difficulty.openingWeight * 4
  }

  if (move.piece === 'p') {
    score += difficulty.openingWeight
  }

  if (move.piece === 'n' || move.piece === 'b') {
    score += difficulty.openingWeight * 2
  }

  if (move.piece === 'q' && fullmoveNumber <= 4) {
    score -= difficulty.openingWeight * (undevelopedMinors >= 3 ? 6 : 4)
  }

  if (isEarlyQueenMove(move, fullmoveNumber) && !move.captured && !move.san.includes('+')) {
    score -= difficulty.openingWeight * 5
  }

  if (move.piece === 'r' && !move.flags.includes('k') && !move.flags.includes('q') && fullmoveNumber <= 5) {
    score -= difficulty.openingWeight
  }

  if (isEarlyKingWalk(move, fullmoveNumber)) {
    score -= difficulty.openingWeight * 8
  }

  if (isRepeatedDevelopmentMove(game, move, fullmoveNumber)) {
    score -= difficulty.openingWeight * (move.piece === 'q' ? 8 : 5)
  }

  if (difficulty.centerWeight && CENTER_SQUARES.has(move.to)) {
    score += difficulty.centerWeight
  }

  return score
}

export function evaluateRepeatedPiecePenalty(game, move) {
  if (isTacticalMove(move)) {
    return 0
  }

  const recentMoves = getRecentMovesByColor(game, move.color, 2)

  if (recentMoves.length === 0) {
    return 0
  }

  let penalty = 0
  const [lastMove, previousMove] = recentMoves

  if (lastMove.to === move.from && lastMove.piece === move.piece) {
    penalty += move.piece === 'q' ? 110 : 70
  }

  if (lastMove.from === move.to && lastMove.to === move.from && lastMove.piece === move.piece) {
    penalty += move.piece === 'q' ? 175 : 125
  }

  if (previousMove && previousMove.to === move.from && previousMove.from === move.to && previousMove.piece === move.piece) {
    penalty += move.piece === 'q' ? 120 : 82
  }

  if (move.piece !== 'p' && move.piece !== 'k' && penalty > 0) {
    penalty *= 1.25
  }

  return penalty
}

export function evaluateStablePiecePenalty(game, move, difficulty) {
  const phase = getGamePhase(game, difficulty)

  if ((phase !== 'opening' && phase !== 'middlegame') || move.piece === 'p' || move.piece === 'k' || isTacticalMove(move)) {
    return 0
  }

  const piece = game.get(move.from)

  if (!piece || !isPieceDeveloped(move.from, piece)) {
    return 0
  }

  const enemyColor = move.color === 'w' ? 'b' : 'w'
  const currentAttackers = getEffectiveSupportTotal(game, move.from, enemyColor)
  const currentDefenders = getEffectiveSupportTotal(game, move.from, move.color)

  if (currentAttackers > 0 && currentAttackers >= currentDefenders) {
    return 0
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)
  let penalty = PIECE_VALUES[move.piece] * 0.08

  if (phase === 'opening') {
    penalty *= 1.55
  }

  if (fullmoveNumber <= 12) {
    penalty *= 1.2
  }

  return penalty
}

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
  const undevelopedSiblingCount = siblingSquares.filter((square) => game.get(square)?.color === move.color).length
  const piece = game.get(move.from)

  if (!piece || !isPieceDeveloped(move.from, piece) || undevelopedSiblingCount === 0) {
    return 0
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)
  let penalty = difficulty.openingWeight * (move.piece === 'b' ? 2.6 : 2.2)

  if (undevelopedSiblingCount === siblingSquares.length) {
    penalty *= 1.35
  }

  if (fullmoveNumber <= 12) {
    penalty *= 1.15
  }

  return penalty
}

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
  const threshold = move.piece === 'n' || move.piece === 'b' ? 2 : 1

  if (advance <= threshold) {
    return 0
  }

  return (advance - threshold) * PIECE_VALUES[move.piece] * 0.1 * (difficulty.coordinationWeight ?? 0)
}

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

  if (attackers === 0) {
    return 0
  }

  const pieceValue = movedPiece.type === 'k' ? 2000 : PIECE_VALUES[movedPiece.type]
  const leastAttacker = getLeastValuableAttacker(game, move.to, enemyColor)
  const leastDefender = getLeastValuableAttacker(game, move.to, movedPiece.color)
  const isQuietMove = !move.captured && !move.san.includes('+') && !move.san.includes('#')
  let penalty = 0

  if (defenders === 0) {
    penalty += pieceValue * 1.2
  } else if (attackers > defenders) {
    penalty += (attackers - defenders) * pieceValue * 0.55
  } else if (attackers === defenders) {
    penalty += pieceValue * 0.12
  }

  if (leastAttacker && isClearlyLowerValue(leastAttacker.value, pieceValue)) {
    penalty += (pieceValue - leastAttacker.value) * 1.1
  }

  if (leastAttacker && leastDefender && leastAttacker.value < leastDefender.value) {
    penalty += (leastDefender.value - leastAttacker.value) * 0.6
  }

  if (leastAttacker?.piece.type === 'p' && movedPiece.type !== 'p') {
    penalty += pieceValue * 0.5
  }

  if (isQuietMove && leastAttacker && isClearlyLowerValue(leastAttacker.value, pieceValue) && (!leastDefender || leastDefender.value > leastAttacker.value)) {
    penalty += (pieceValue - leastAttacker.value) * 0.9
  }

  if (isQuietMove && leastAttacker && isClearlyLowerValue(leastAttacker.value, pieceValue) && defenders <= attackers) {
    penalty += pieceValue * 0.9
  }

  if (isQuietMove && movedPiece.type === 'n' && leastAttacker?.piece.type === 'p') {
    penalty += pieceValue * 0.8
  }

  if (isQuietMove && movedPiece.type !== 'p' && leastAttacker?.piece.type === 'p' && defenders === 0) {
    penalty += pieceValue * 1.1
  }

  if (isQuietMove && leastAttacker?.piece.type === 'q' && defenders <= attackers) {
    penalty += pieceValue * 0.35
  }

  if (isQuietMove) {
    penalty *= 1.25
  }

  return penalty * difficulty.blunderWeight
}

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

  if (capturedValue >= attackerValue) {
    score += (capturedValue - attackerValue + 40) * 0.5
  }

  if (move.captured === 'p' && movedPiece.type !== 'p') {
    score += 35
  }

  if (leastDefender && leastDefender.value >= attackerValue + 40) {
    score += (leastDefender.value - attackerValue) * 0.45
  }

  if (defenders.length > 0 && defenders.every((defender) => defender.piece.type === 'q' || defender.piece.type === 'k' || defender.effectiveness < 0.45)) {
    score += capturedValue * 0.9 + 40
  }

  if (defenders.some((defender) => defender.piece.type === 'k' || defender.effectiveness < 0.2)) {
    score += 18
  }

  return score
}

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

  const attackedPieces = getAttackedEnemyPieces(nextGame, move.color, move.to)
  const valuableTargets = attackedPieces.filter(({ piece }) => piece.type !== 'p')

  if (valuableTargets.length >= 2) {
    score += 70
  } else if (nextGame.isCheck() && valuableTargets.length >= 1) {
    score += 52
  }

  const enemyKingSquare = findPieceSquare(nextGame, enemyColor, 'k')

  if (enemyKingSquare) {
    const kingAttackers = getAttackedEnemyPieces(nextGame, move.color, move.to)

    if (kingAttackers.some((target) => target.square === enemyKingSquare) && kingAttackers.length >= 2) {
      score += 95
    }
  }

  const beforeAttacks = getAttackedEnemyPieces(currentGame, move.color, move.from)
  const newlyAttackedSquares = attackedPieces.filter(({ square }) => !beforeAttacks.some((before) => before.square === square))

  if (newlyAttackedSquares.length >= 1 && move.from !== move.to) {
    score += 34
    if (nextGame.isCheck()) {
      score += 28
    }
  }

  for (const target of getLinePressureTargets(nextGame, move.to, move.color)) {
    if (target.back.piece.type === 'k') {
      score += 62
      continue
    }

    if (target.front.value < target.back.value) {
      score += 54
    } else if (target.front.value > target.back.value) {
      score += 40
    }
  }

  const enemyBoard = nextGame.board()

  for (let rowIndex = 0; rowIndex < enemyBoard.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < enemyBoard[rowIndex].length; columnIndex += 1) {
      const piece = enemyBoard[rowIndex][columnIndex]

      if (!piece || piece.color !== enemyColor) {
        continue
      }

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const defenders = getAttackersInfo(nextGame, square, enemyColor)

      if (defenders.length !== 1) {
        continue
      }

      const soleDefender = defenders[0]
      const defendedSquares = getAttackedEnemyPieces(nextGame, enemyColor, soleDefender.square)

      if (defendedSquares.length >= 2) {
        score += 36
      }
    }
  }

  return score * difficulty.tacticalWeight
}

export function evaluateOpponentTacticalRisk(nextGame, difficulty, getMoveOrderingScore) {
  if (!difficulty.tacticalWeight) {
    return 0
  }

  const replies = nextGame.moves({ verbose: true })

  if (replies.length === 0) {
    return 0
  }

  let worstRisk = 0
  const sampledReplies = replies
    .sort((left, right) => getMoveOrderingScore(right, difficulty) - getMoveOrderingScore(left, difficulty))
    .slice(0, 10)

  for (const reply of sampledReplies) {
    const replyGame = new Chess(nextGame.fen())
    replyGame.move(reply)
    const tacticalRisk = evaluateTacticalMotifs(nextGame, replyGame, reply, difficulty)
    const captureRisk = evaluateCaptureDecision(nextGame, replyGame, reply)
    const immediateDamage = evaluateMovedPieceSafety(replyGame, reply, difficulty)
    worstRisk = Math.max(worstRisk, tacticalRisk + captureRisk + immediateDamage * 0.35)
  }

  return worstRisk * 0.55
}

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

    if (!nextPiece || nextPiece.color !== move.color || nextPiece.type !== threat.piece.type) {
      continue
    }

    const enemyColor = move.color === 'w' ? 'b' : 'w'
    const nextLeastAttacker = getLeastValuableAttacker(nextGame, threat.square, enemyColor)

    if (!nextLeastAttacker || nextLeastAttacker.value > threat.pieceValue) {
      continue
    }

    const defenders = nextGame.attackers(threat.square, move.color).length
    const attackers = nextGame.attackers(threat.square, enemyColor).length
    let threatPenalty = threat.pieceValue * 0.75

    if (nextLeastAttacker.piece.type === 'p') {
      threatPenalty += threat.pieceValue * 0.9
    }

    if (attackers > defenders) {
      threatPenalty += (attackers - defenders) * threat.pieceValue * 0.45
    }

    if (move.to !== threat.square && !move.captured && !move.san.includes('+') && !move.san.includes('#')) {
      threatPenalty *= 1.2
    }

    penalty += threatPenalty
  }

  return penalty * difficulty.blunderWeight
}

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

  const watchedFiles = getPawnShieldSquares(move.color, castlingPlan).map((square) => square[0])

  if (!watchedFiles.includes(move.from[0])) {
    return 0
  }

  const fileWeight = getPawnShieldWeight(move.color, castlingPlan, move.from[0])
  const isCastled = findPieceSquare(game, move.color, 'k') === getCastledKingSquare(move.color, castlingPlan)
  const castledMultiplier = isCastled ? 2.2 : 1.3
  const stepDistance = Math.abs(Number.parseInt(move.to[1], 10) - Number.parseInt(move.from[1], 10))

  return difficulty.castlePawnWeight * fileWeight * castledMultiplier * (0.9 + stepDistance * 0.8)
}
