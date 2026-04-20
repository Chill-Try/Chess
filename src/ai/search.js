import { Chess } from 'chess.js'
import { DIFFICULTY_BY_KEY, PIECE_VALUES } from './config'
import { getNonKingMaterial } from './boardUtils'
import { evaluateBoard } from './evaluation'
import { getGamePhase, isEarlyKingWalk, isEarlyQueenMove } from './moveScoringShared'

export function getSearchSettings(game, difficulty) {
  if (difficulty.materialDepthSettings) {
    const nonKingMaterial = getNonKingMaterial(game.board())

    for (const stage of Object.values(difficulty.materialDepthSettings)) {
      if (nonKingMaterial <= stage.maxMaterial && nonKingMaterial >= stage.minMaterial) {
        return {
          depth: stage.depth,
          timeLimitMs: null,
        }
      }
    }

    return {
      depth: difficulty.depth,
      timeLimitMs: null,
    }
  }

  const phase = getGamePhase(game, difficulty)

  if (!phase || !difficulty.phaseSettings?.[phase]) {
    return {
      depth: difficulty.depth,
      timeLimitMs: null,
    }
  }

  return difficulty.phaseSettings[phase]
}

export function getCurrentSearchDepth(fen, difficultyKey) {
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner

  if (difficulty.engine === 'stockfish') {
    return difficulty.stockfishDepth ?? difficulty.depth
  }

  const game = new Chess(fen)
  return getSearchSettings(game, difficulty).depth
}

export function getMoveOrderingScore(move, difficulty) {
  let score = 0

  if (move.captured) {
    score += 12 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece]
  }

  if (move.promotion) {
    score += PIECE_VALUES[move.promotion]
  }

  if (move.san.includes('+')) {
    score += 60
  }

  if (difficulty.centerWeight && ['d4', 'd5', 'e4', 'e5'].includes(move.to)) {
    score += difficulty.centerWeight
  }

  if (difficulty.openingWeight) {
    if (move.flags.includes('k') || move.flags.includes('q')) {
      score += difficulty.openingWeight * 2
    }

    if (move.piece === 'n' || move.piece === 'b') {
      score += difficulty.openingWeight
    }

    if (isEarlyQueenMove(move, 6)) {
      score -= difficulty.openingWeight * 3
    }

    if (isEarlyKingWalk(move, 8)) {
      score -= difficulty.openingWeight * 5
    }
  }

  return score
}

export function getTranspositionKey(game, depth, maximizingPlayer) {
  return `${game.fen()}|${depth}|${maximizingPlayer ? 'max' : 'min'}`
}

export function hasTimedOut(deadlineAt) {
  return deadlineAt !== null && Date.now() >= deadlineAt
}

export function minimax(game, depth, alpha, beta, maximizingPlayer, difficulty, deadlineAt, transpositionTable) {
  const key = getTranspositionKey(game, depth, maximizingPlayer)

  if (transpositionTable.has(key)) {
    return transpositionTable.get(key)
  }

  if (depth === 0 || game.isGameOver() || hasTimedOut(deadlineAt)) {
    const evaluation = evaluateBoard(game, difficulty)
    transpositionTable.set(key, evaluation)
    return evaluation
  }

  const moves = game
    .moves({ verbose: true })
    .sort((left, right) => getMoveOrderingScore(right, difficulty) - getMoveOrderingScore(left, difficulty))

  if (maximizingPlayer) {
    let maxEval = -Infinity

    for (const move of moves) {
      if (hasTimedOut(deadlineAt)) {
        break
      }

      game.move(move)
      const evaluation = minimax(game, depth - 1, alpha, beta, false, difficulty, deadlineAt, transpositionTable)
      game.undo()
      maxEval = Math.max(maxEval, evaluation)
      alpha = Math.max(alpha, evaluation)
      if (beta <= alpha) break
    }

    transpositionTable.set(key, maxEval)
    return maxEval
  }

  let minEval = Infinity

  for (const move of moves) {
    if (hasTimedOut(deadlineAt)) {
      break
    }

    game.move(move)
    const evaluation = minimax(game, depth - 1, alpha, beta, true, difficulty, deadlineAt, transpositionTable)
    game.undo()
    minEval = Math.min(minEval, evaluation)
    beta = Math.min(beta, evaluation)
    if (beta <= alpha) break
  }

  transpositionTable.set(key, minEval)
  return minEval
}
