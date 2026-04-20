import { Chess } from 'chess.js'
import { LINE_DIRECTIONS, LOWER_VALUE_MARGIN, PIECE_VALUES } from './config'

export function getOpeningPhaseMoveCount(game) {
  return Number.parseInt(game.fen().split(' ')[5], 10)
}

export function getNonPawnMaterial(board) {
  let total = 0

  for (const row of board) {
    for (const piece of row) {
      if (!piece || piece.type === 'p' || piece.type === 'k') {
        continue
      }

      total += PIECE_VALUES[piece.type]
    }
  }

  return total
}

export function getNonKingMaterial(board) {
  let total = 0

  for (const row of board) {
    for (const piece of row) {
      if (!piece || piece.type === 'k') {
        continue
      }

      total += PIECE_VALUES[piece.type]
    }
  }

  return total
}

export function squareToCoords(square) {
  return [square.charCodeAt(0) - 97, Number.parseInt(square[1], 10) - 1]
}

export function coordsToSquare(file, rank) {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null
  }

  return `${String.fromCharCode(97 + file)}${rank + 1}`
}

export function getPieceValue(piece) {
  return piece.type === 'k' ? 2000 : PIECE_VALUES[piece.type]
}

export function getAttackersInfo(game, square, color) {
  return game.attackers(square, color)
    .map((attackerSquare) => {
      const piece = game.get(attackerSquare)

      if (!piece) {
        return null
      }

      return {
        square: attackerSquare,
        piece,
        value: piece.type === 'k' ? 2000 : PIECE_VALUES[piece.type],
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.value - right.value)
}

export function getPiecesAttackedBy(game, square, color) {
  return getAttackersInfo(game, square, color)
    .map(({ square: attackerSquare, piece, value }) => ({ attackerSquare, piece, value }))
}

export function getLeastValuableAttacker(game, square, color) {
  const attackers = game.attackers(square, color)

  if (attackers.length === 0) {
    return null
  }

  return attackers.reduce((best, attackerSquare) => {
    const attacker = game.get(attackerSquare)

    if (!attacker) {
      return best
    }

    const attackerValue = attacker.type === 'k' ? 2000 : PIECE_VALUES[attacker.type]

    if (!best || attackerValue < best.value) {
      return { square: attackerSquare, value: attackerValue, piece: attacker }
    }

    return best
  }, null)
}

export function getAttackedEnemyPieces(game, attackerColor, fromSquare) {
  const attackedPieces = []
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (!piece || piece.color === attackerColor) {
        continue
      }

      const targetSquare = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const attackers = getPiecesAttackedBy(game, targetSquare, attackerColor)

      if (attackers.some((attacker) => attacker.attackerSquare === fromSquare)) {
        attackedPieces.push({ square: targetSquare, piece, value: getPieceValue(piece) })
      }
    }
  }

  return attackedPieces
}

export function getLinePressureTargets(game, attackerSquare, attackerColor) {
  const attacker = game.get(attackerSquare)

  if (!attacker || !['b', 'r', 'q'].includes(attacker.type)) {
    return []
  }

  const [file, rank] = squareToCoords(attackerSquare)
  const validDirections = LINE_DIRECTIONS.filter(([df, dr]) => {
    if (attacker.type === 'b') return Math.abs(df) === Math.abs(dr)
    if (attacker.type === 'r') return df === 0 || dr === 0
    return true
  })
  const targets = []

  for (const [df, dr] of validDirections) {
    let currentFile = file + df
    let currentRank = rank + dr
    let firstTarget = null

    while (currentFile >= 0 && currentFile < 8 && currentRank >= 0 && currentRank < 8) {
      const currentSquare = coordsToSquare(currentFile, currentRank)
      const piece = game.get(currentSquare)

      if (piece) {
        if (piece.color === attackerColor) {
          break
        }

        if (!firstTarget) {
          firstTarget = { square: currentSquare, piece, value: getPieceValue(piece) }
        } else {
          targets.push({ front: firstTarget, back: { square: currentSquare, piece, value: getPieceValue(piece) } })
          break
        }
      }

      currentFile += df
      currentRank += dr
    }
  }

  return targets
}

export function isSliderCompatibleWithDirection(pieceType, fileDelta, rankDelta) {
  const diagonal = Math.abs(fileDelta) === Math.abs(rankDelta)
  const straight = fileDelta === 0 || rankDelta === 0

  if (pieceType === 'q') return diagonal || straight
  if (pieceType === 'b') return diagonal
  if (pieceType === 'r') return straight
  return false
}

export function getDefenderBaseWeight(pieceType) {
  if (pieceType === 'k') return 0.05
  if (pieceType === 'q') return 0.45
  if (pieceType === 'r') return 0.8
  return 1
}

export function getPinnedDefenderPenalty(game, defenderSquare, defenderColor) {
  const [file, rank] = squareToCoords(defenderSquare)

  for (const [fileDelta, rankDelta] of LINE_DIRECTIONS) {
    let ownTarget = null
    let currentFile = file + fileDelta
    let currentRank = rank + rankDelta

    while (currentFile >= 0 && currentFile < 8 && currentRank >= 0 && currentRank < 8) {
      const square = coordsToSquare(currentFile, currentRank)
      const piece = game.get(square)

      if (piece) {
        ownTarget = { square, piece }
        break
      }

      currentFile += fileDelta
      currentRank += rankDelta
    }

    if (!ownTarget || ownTarget.piece.color !== defenderColor) {
      continue
    }

    currentFile = file - fileDelta
    currentRank = rank - rankDelta

    while (currentFile >= 0 && currentFile < 8 && currentRank >= 0 && currentRank < 8) {
      const square = coordsToSquare(currentFile, currentRank)
      const piece = game.get(square)

      if (piece) {
        if (piece.color !== defenderColor && isSliderCompatibleWithDirection(piece.type, fileDelta, rankDelta)) {
          if (ownTarget.piece.type === 'k') return 1
          if (ownTarget.piece.type === 'q') return 0.7
          if (ownTarget.piece.type === 'r') return 0.6
          return 0.35
        }

        break
      }

      currentFile -= fileDelta
      currentRank -= rankDelta
    }
  }

  return 0
}

export function getEffectiveSupportInfo(game, square, color) {
  return getAttackersInfo(game, square, color).map((attacker) => {
    const pinnedPenalty = getPinnedDefenderPenalty(game, attacker.square, color)
    return {
      ...attacker,
      effectiveness: Math.max(0, getDefenderBaseWeight(attacker.piece.type) * (1 - pinnedPenalty)),
    }
  })
}

export function getEffectiveSupportTotal(game, square, color) {
  return getEffectiveSupportInfo(game, square, color).reduce((total, attacker) => total + attacker.effectiveness, 0)
}

export function isClearlyLowerValue(attackerValue, pieceValue) {
  return attackerValue <= pieceValue - LOWER_VALUE_MARGIN
}

export function getThreatenedPieces(game, color) {
  const threatenedPieces = []
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (!piece || piece.color !== color || piece.type === 'p' || piece.type === 'k') {
        continue
      }

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const enemyColor = color === 'w' ? 'b' : 'w'
      const attackers = game.attackers(square, enemyColor)

      if (attackers.length === 0) {
        continue
      }

      const leastAttacker = getLeastValuableAttacker(game, square, enemyColor)

      if (!leastAttacker) {
        continue
      }

      const pieceValue = PIECE_VALUES[piece.type]

      if (isClearlyLowerValue(leastAttacker.value, pieceValue)) {
        threatenedPieces.push({ square, piece, pieceValue, leastAttacker })
      }
    }
  }

  return threatenedPieces
}

export function getLastMoveByColor(game, color) {
  const history = game.history({ verbose: true })

  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].color === color) {
      return history[index]
    }
  }

  return null
}

export function getRecentMovesByColor(game, color, count = 2) {
  const history = game.history({ verbose: true })
  const recentMoves = []

  for (let index = history.length - 1; index >= 0 && recentMoves.length < count; index -= 1) {
    if (history[index].color === color) {
      recentMoves.push(history[index])
    }
  }

  return recentMoves
}

export function findPieceSquare(game, color, pieceType) {
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (piece?.type === pieceType && piece.color === color) {
        return `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      }
    }
  }

  return null
}

export function cloneGameFromFen(fen) {
  return new Chess(fen)
}
