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

export { DIFFICULTY_BY_KEY, DIFFICULTY_LEVELS } from './ai/config'
export { getCurrentSearchDepth } from './ai/search'

export function getCandidateMoves(fen, difficultyKey, candidateMoves = null) {
  const game = new Chess(fen)
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner
  const moves = candidateMoves ?? game.moves({ verbose: true })

  return filterOpeningMoves(game, moves, difficulty)
}

export function getBookOrForcedMove(fen, difficultyKey) {
  const game = new Chess(fen)
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner
  const moves = game.moves({ verbose: true })

  if (moves.length <= 1) {
    return moves[0] ?? null
  }

  if (difficulty.useOpeningBook) {
    const openingMove = getOpeningMove(game)

    if (openingMove) {
      return openingMove
    }
  }

  return null
}

export function scoreComputerMoves(fen, computerColor, difficultyKey, candidateMoves = null) {
  const game = new Chess(fen)
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner
  const searchSettings = getSearchSettings(game, difficulty)
  const deadlineAt = searchSettings.timeLimitMs === null ? null : Date.now() + searchSettings.timeLimitMs
  const transpositionTable = new Map()
  const moves = getCandidateMoves(fen, difficultyKey, candidateMoves)

  if (moves.length === 0) {
    return []
  }

  const maximizingPlayer = computerColor === 'w'

  return moves.map((move) => {
    if (hasTimedOut(deadlineAt)) {
      return {
        move,
        score: evaluateBoard(game, difficulty),
      }
    }

    game.move(move)
    const score = minimax(
      game,
      searchSettings.depth - 1,
      -Infinity,
      Infinity,
      !maximizingPlayer,
      difficulty,
      deadlineAt,
      transpositionTable
    )
    const next = new Chess(game.fen())
    game.undo()

    const openingScore = getOpeningPhaseScore(move, game, difficulty)
    const signedOpeningScore = move.color === 'w' ? openingScore : -openingScore
    const repeatedPiecePenalty = evaluateRepeatedPiecePenalty(game, move)
    const signedRepeatedPiecePenalty = move.color === 'w' ? -repeatedPiecePenalty : repeatedPiecePenalty
    const stablePiecePenalty = evaluateStablePiecePenalty(game, move, difficulty)
    const signedStablePiecePenalty = move.color === 'w' ? -stablePiecePenalty : stablePiecePenalty
    const unevenMinorRedeploymentPenalty = evaluateUnevenMinorRedeployment(game, move, difficulty)
    const signedUnevenMinorRedeploymentPenalty = move.color === 'w' ? -unevenMinorRedeploymentPenalty : unevenMinorRedeploymentPenalty
    const captureDecisionScore = evaluateCaptureDecision(game, next, move)
    const signedCaptureDecisionScore = move.color === 'w' ? captureDecisionScore : -captureDecisionScore
    const tacticalMotifScore = evaluateTacticalMotifs(game, next, move, difficulty)
    const signedTacticalMotifScore = move.color === 'w' ? tacticalMotifScore : -tacticalMotifScore
    const opponentTacticalRisk = evaluateOpponentTacticalRisk(next, difficulty, getMoveOrderingScore)
    const signedOpponentTacticalRisk = move.color === 'w' ? -opponentTacticalRisk : opponentTacticalRisk
    const safetyPenalty = evaluateMovedPieceSafety(next, move, difficulty)
    const signedSafetyPenalty = move.color === 'w' ? -safetyPenalty : safetyPenalty
    const ignoredThreatPenalty = evaluateIgnoredThreats(game, next, move, difficulty)
    const signedIgnoredThreatPenalty = move.color === 'w' ? -ignoredThreatPenalty : ignoredThreatPenalty
    const shieldPawnPenalty = getShieldPawnMovePenalty(game, move, difficulty)
    const signedShieldPawnPenalty = move.color === 'w' ? -shieldPawnPenalty : shieldPawnPenalty
    const earlyOverextensionPenalty = evaluateEarlyPieceOverextension(game, move, difficulty)
    const signedEarlyOverextensionPenalty = move.color === 'w' ? -earlyOverextensionPenalty : earlyOverextensionPenalty

    return {
      move,
      score: score
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
        + (Math.random() * difficulty.randomRange - difficulty.randomRange / 2),
    }
  })
}

export function pickBestMove(scoredMoves, computerColor) {
  if (scoredMoves.length === 0) {
    return null
  }

  const maximizingPlayer = computerColor === 'w'
  let bestScore = maximizingPlayer ? -Infinity : Infinity
  let bestMoves = []

  for (const { move, score } of scoredMoves) {
    if (maximizingPlayer) {
      if (score > bestScore) {
        bestScore = score
        bestMoves = [move]
      } else if (Math.abs(score - bestScore) < 0.001) {
        bestMoves.push(move)
      }
    } else if (score < bestScore) {
      bestScore = score
      bestMoves = [move]
    } else if (Math.abs(score - bestScore) < 0.001) {
      bestMoves.push(move)
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)]
}

export function chooseComputerMove(fen, computerColor, difficultyKey) {
  const forcedMove = getBookOrForcedMove(fen, difficultyKey)

  if (forcedMove) {
    return forcedMove
  }

  return pickBestMove(scoreComputerMoves(fen, computerColor, difficultyKey), computerColor)
}
