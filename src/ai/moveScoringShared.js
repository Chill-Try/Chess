import { PIECE_VALUES } from './config'
import { findPieceSquare, getNonPawnMaterial } from './boardUtils'

export function getOpeningPhaseMoveCount(game) {
  return Number.parseInt(game.fen().split(' ')[5], 10)
}

export function getGamePhase(game, difficulty) {
  if (!difficulty.phaseSettings) {
    return null
  }

  const board = game.board()
  const fullmoveNumber = getOpeningPhaseMoveCount(game)
  const queens = game.findPiece({ type: 'q', color: 'w' }).length + game.findPiece({ type: 'q', color: 'b' }).length
  const nonPawnMaterial = getNonPawnMaterial(board)
  const minorAndRookMaterial = nonPawnMaterial - queens * PIECE_VALUES.q

  if (fullmoveNumber <= 8) {
    return 'opening'
  }

  if (nonPawnMaterial <= 1400 || minorAndRookMaterial <= 900) {
    return 'simplifiedEndgame'
  }

  if (queens === 0 || nonPawnMaterial <= 2600) {
    return 'endgame'
  }

  return 'middlegame'
}

export function getCastlingPlan(game, color) {
  const kingSquare = findPieceSquare(game, color, 'k')

  if (color === 'w') {
    if (kingSquare === 'g1') return 'kingside'
    if (kingSquare === 'c1') return 'queenside'
  } else {
    if (kingSquare === 'g8') return 'kingside'
    if (kingSquare === 'c8') return 'queenside'
  }

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

export function getPawnShieldSquares(color, castlingPlan) {
  if (color === 'w' && castlingPlan === 'kingside') return ['f2', 'g2', 'h2']
  if (color === 'w' && castlingPlan === 'queenside') return ['a2', 'b2', 'c2']
  if (color === 'b' && castlingPlan === 'kingside') return ['f7', 'g7', 'h7']
  if (color === 'b' && castlingPlan === 'queenside') return ['a7', 'b7', 'c7']
  return []
}

export function getCastledKingSquare(color, castlingPlan) {
  if (color === 'w' && castlingPlan === 'kingside') return 'g1'
  if (color === 'w' && castlingPlan === 'queenside') return 'c1'
  if (color === 'b' && castlingPlan === 'kingside') return 'g8'
  if (color === 'b' && castlingPlan === 'queenside') return 'c8'
  return null
}

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

export function findPawnOnFile(game, color, file) {
  const pawns = game.findPiece({ type: 'p', color })
  const filePawns = pawns.filter((square) => square[0] === file)

  if (filePawns.length === 0) {
    return null
  }

  return filePawns.sort((left, right) => {
    const leftRank = Number.parseInt(left[1], 10)
    const rightRank = Number.parseInt(right[1], 10)
    return color === 'w' ? leftRank - rightRank : rightRank - leftRank
  })[0]
}

export function getPawnAdvancePenalty(piece, square) {
  const rank = Number.parseInt(square[1], 10)
  const homeRank = piece.color === 'w' ? 2 : 7
  const advancedSquares = piece.color === 'w' ? rank - homeRank : homeRank - rank

  if (advancedSquares <= 1) {
    return advancedSquares * 0.35
  }

  return 0.35 + (advancedSquares - 1) * 0.9
}

export function isTacticalMove(move) {
  return Boolean(move.captured) || move.san.includes('+') || move.san.includes('#')
}

export function isEarlyQueenMove(move, fullmoveNumber) {
  return move.piece === 'q' && fullmoveNumber <= 6
}

export function isEarlyKingWalk(move, fullmoveNumber) {
  const isCastlingMove = move.flags.includes('k') || move.flags.includes('q')
  return move.piece === 'k' && !isCastlingMove && fullmoveNumber <= 8
}

export function isPieceDeveloped(square, piece) {
  const rank = Number.parseInt(square[1], 10)

  if (piece.type === 'n' || piece.type === 'b') {
    return piece.color === 'w' ? rank >= 3 : rank <= 6
  }

  if (piece.type === 'r') {
    return square[0] !== 'a' && square[0] !== 'h'
  }

  if (piece.type === 'q') {
    return piece.color === 'w' ? rank >= 3 : rank <= 6
  }

  return false
}
