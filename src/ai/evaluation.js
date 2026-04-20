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

function getPositionalBonus(piece, rowIndex, columnIndex) {
  const table = POSITION_TABLES[piece.type]

  if (!table) {
    return 0
  }

  const normalizedRow = piece.color === 'w' ? rowIndex : 7 - rowIndex
  return table[normalizedRow][columnIndex]
}

export function evaluateDevelopment(game, difficulty) {
  if (!difficulty.openingWeight) {
    return 0
  }

  const fullmoveNumber = getOpeningPhaseMoveCount(game)

  if (fullmoveNumber > 8) {
    return 0
  }

  let score = 0

  for (const color of ['w', 'b']) {
    const direction = color === 'w' ? 1 : -1
    const developmentSquares = DEVELOPMENT_SQUARES[color]
    const undevelopedKnights = developmentSquares.knights.filter((square) => game.get(square)?.color === color).length
    const undevelopedBishops = developmentSquares.bishops.filter((square) => game.get(square)?.color === color).length
    const kingSquare = developmentSquares.castledSquares.find((square) => game.get(square)?.type === 'k' && game.get(square)?.color === color)
    const queenOnHomeSquare = game.get(developmentSquares.queen)?.type === 'q' && game.get(developmentSquares.queen)?.color === color
    const kingOnHomeSquare = game.get(developmentSquares.king)?.type === 'k' && game.get(developmentSquares.king)?.color === color
    const queenSquare = findPieceSquare(game, color, 'q')

    score -= direction * undevelopedKnights * difficulty.openingWeight * 1.25
    score -= direction * undevelopedBishops * difficulty.openingWeight * 1.25

    if (kingSquare) {
      score += direction * difficulty.openingWeight * 4
    } else if (kingOnHomeSquare && fullmoveNumber <= 6) {
      score -= direction * difficulty.openingWeight * 2
    }

    if (!queenOnHomeSquare && fullmoveNumber <= 6 && undevelopedKnights + undevelopedBishops >= 2) {
      score -= direction * difficulty.openingWeight * 7
    }

    if (queenSquare && queenSquare !== developmentSquares.queen && undevelopedKnights + undevelopedBishops >= 2 && fullmoveNumber <= 8) {
      score -= direction * difficulty.openingWeight * 4
    }
  }

  return score
}

export function evaluateBalancedDevelopment(game, difficulty) {
  if (!difficulty.openingWeight) {
    return 0
  }

  const phase = getGamePhase(game, difficulty)

  if (phase !== 'opening' && phase !== 'middlegame') {
    return 0
  }

  let score = 0

  for (const color of ['w', 'b']) {
    const direction = color === 'w' ? 1 : -1
    const home = DEVELOPMENT_SQUARES[color]
    const knightsDeveloped = home.knights.filter((square) => game.get(square)?.color !== color).length
    const bishopsDeveloped = home.bishops.filter((square) => game.get(square)?.color !== color).length
    const minorGap = Math.abs(knightsDeveloped - bishopsDeveloped)
    const totalMinorDevelopment = knightsDeveloped + bishopsDeveloped
    let sideScore = 0

    sideScore -= minorGap * difficulty.openingWeight * 1.5
    sideScore += totalMinorDevelopment * difficulty.openingWeight * 0.9

    if (knightsDeveloped === 2 && bishopsDeveloped === 2) {
      sideScore += difficulty.openingWeight * 2.2
    }

    if ((knightsDeveloped === 0 && bishopsDeveloped >= 2) || (bishopsDeveloped === 0 && knightsDeveloped >= 2)) {
      sideScore -= difficulty.openingWeight * 2.4
    }

    if ((knightsDeveloped === 0 && bishopsDeveloped >= 1) || (bishopsDeveloped === 0 && knightsDeveloped >= 1)) {
      sideScore -= difficulty.openingWeight * 1.4
    }

    score += direction * sideScore
  }

  return score
}

export function evaluateCenterControl(game, centerWeight) {
  if (!centerWeight) {
    return 0
  }

  let score = 0

  for (const move of game.moves({ verbose: true })) {
    if (CENTER_SQUARES.has(move.to)) {
      score += move.color === 'w' ? centerWeight : -centerWeight
    }
  }

  return score
}

export function evaluateAttackPressure(game, difficulty) {
  if (!difficulty.attackWeight) {
    return 0
  }

  let score = 0
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (!piece) continue

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const defenders = getEffectiveSupportTotal(game, square, piece.color)
      const enemyColor = piece.color === 'w' ? 'b' : 'w'
      const attackers = getEffectiveSupportTotal(game, square, enemyColor)

      if (attackers === 0 && defenders === 0) {
        continue
      }

      const direction = piece.color === 'w' ? 1 : -1
      const baseValue = piece.type === 'k' ? 400 : PIECE_VALUES[piece.type]
      const exchangeMargin = defenders - attackers
      let pressureScore = 0

      if (attackers > 0 && defenders === 0) {
        pressureScore -= baseValue * 0.35
      } else if (attackers > defenders) {
        pressureScore -= (attackers - defenders) * baseValue * 0.22
      } else if (attackers > 0 && defenders >= attackers) {
        pressureScore += Math.min(defenders - attackers + 1, 2) * baseValue * 0.08
      } else if (defenders > 0) {
        pressureScore += Math.min(exchangeMargin, 2) * baseValue * 0.03
      }

      score += direction * pressureScore * difficulty.attackWeight
    }
  }

  return score
}

export function evaluateCastlingSidePawns(game, difficulty) {
  if (!difficulty.castlePawnWeight) {
    return 0
  }

  const phase = getGamePhase(game, difficulty)

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
    const shieldSquares = getPawnShieldSquares(color, castlingPlan)
    const isCastled = findPieceSquare(game, color, 'k') === getCastledKingSquare(color, castlingPlan)

    for (const square of shieldSquares) {
      const pawnSquare = findPawnOnFile(game, color, square[0])
      const fileWeight = getPawnShieldWeight(color, castlingPlan, square[0])
      const castledMultiplier = isCastled ? 1.8 : 1

      if (!pawnSquare) {
        score -= direction * difficulty.castlePawnWeight * 1.4 * fileWeight * castledMultiplier
        continue
      }

      const piece = game.get(pawnSquare)
      score -= direction * getPawnAdvancePenalty(piece, pawnSquare) * difficulty.castlePawnWeight * fileWeight * castledMultiplier
    }
  }

  return score
}

export function evaluatePieceCoordination(game, difficulty) {
  if (!difficulty.coordinationWeight) {
    return 0
  }

  let score = 0
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

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
      const supportBonus = Math.min(defenders, 3) * baseValue * 0.11
      score += direction * supportBonus * difficulty.coordinationWeight
    }
  }

  return score
}

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

      if (!piece || piece.type === 'p' || piece.type === 'k') {
        continue
      }

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const direction = piece.color === 'w' ? 1 : -1
      const defenders = getEffectiveSupportTotal(game, square, piece.color)
      const baseValue = PIECE_VALUES[piece.type]
      let bonus = Math.min(defenders, 3) * baseValue * 0.08

      if (openingPhase && defenders < 1) {
        bonus -= baseValue * 0.18
      }

      score += direction * bonus * difficulty.coordinationWeight
    }
  }

  return score
}

export function evaluatePawnStructure(game, difficulty) {
  if (!difficulty.pawnStructureWeight) {
    return 0
  }

  let score = 0

  for (const color of ['w', 'b']) {
    const direction = color === 'w' ? 1 : -1
    const pawnSquares = game.findPiece({ type: 'p', color }).sort()
    const enemyPawns = game.findPiece({ type: 'p', color: color === 'w' ? 'b' : 'w' })
    const fileCounts = new Map()

    for (const square of pawnSquares) {
      fileCounts.set(square[0], (fileCounts.get(square[0]) ?? 0) + 1)
    }

    for (const square of pawnSquares) {
      const file = square.charCodeAt(0) - 97
      const fileChar = square[0]
      const sameFileCount = fileCounts.get(fileChar) ?? 0
      const hasLeftNeighbor = file > 0 && (fileCounts.get(String.fromCharCode(96 + file)) ?? 0) > 0
      const hasRightNeighbor = file < 7 && (fileCounts.get(String.fromCharCode(98 + file)) ?? 0) > 0
      const rank = Number.parseInt(square[1], 10)
      const advance = color === 'w' ? rank - 2 : 7 - rank
      let pawnScore = 0

      if (sameFileCount > 1) {
        pawnScore -= (sameFileCount - 1) * 14
      }

      if (!hasLeftNeighbor && !hasRightNeighbor) {
        pawnScore -= 16
      }

      if (hasLeftNeighbor || hasRightNeighbor) {
        pawnScore += 8
      }

      const adjacentEnemyPawns = enemyPawns.some((enemySquare) => {
        const enemyFile = enemySquare.charCodeAt(0) - 97
        const enemyRank = Number.parseInt(enemySquare[1], 10)
        const sameOrAdjacentFile = Math.abs(enemyFile - file) <= 1

        if (!sameOrAdjacentFile) {
          return false
        }

        return color === 'w' ? enemyRank > rank : enemyRank < rank
      })

      if (!adjacentEnemyPawns) {
        pawnScore += 12 + advance * 3
      }

      score += direction * pawnScore * difficulty.pawnStructureWeight
    }
  }

  return score
}

export function evaluateBoard(game, difficulty) {
  let score = 0
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (!piece) continue

      const value = PIECE_VALUES[piece.type]
      const positionalBonus = difficulty.usePositionalEval
        ? getPositionalBonus(piece, rowIndex, columnIndex) * (difficulty.positionalWeight ?? 1)
        : 0
      const direction = piece.color === 'w' ? 1 : -1

      score += (value + positionalBonus) * direction
      if (difficulty.centerWeight && CENTER_SQUARES.has(`${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`)) {
        score += direction * difficulty.centerWeight
      }
    }
  }

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
