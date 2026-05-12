import { DIFFICULTY_BY_KEY } from '../ai/config.js'

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
}

function getNonKingMaterialFromFen(fen) {
  const boardFen = fen.split(' ')[0] ?? ''
  let total = 0

  for (const char of boardFen) {
    total += PIECE_VALUES[char.toLowerCase()] ?? 0
  }

  return total
}

export function getOpeningPhaseProgress(moveNumber, endMoveNumber) {
  if (endMoveNumber <= 1) {
    return 1
  }

  const normalizedMoveNumber = Math.max(1, moveNumber)
  const rawProgress = (normalizedMoveNumber - 1) / (endMoveNumber - 1)
  return Math.max(0, Math.min(1, rawProgress))
}

export function interpolateOpeningRandomness({
  openingRandomnessStart,
  openingRandomnessEnd,
  openingRandomnessEndMoveNumber,
  moveNumber,
}) {
  const progress = getOpeningPhaseProgress(moveNumber, openingRandomnessEndMoveNumber)
  const current = openingRandomnessStart + (openingRandomnessEnd - openingRandomnessStart) * progress
  return Math.round(current)
}

function interpolateEndgameRandomness({
  currentRandomness,
  endgameRandomnessStartMaterial,
  endgameRandomnessEndMaterial,
  endgameRandomnessEnd,
  remainingMaterial,
}) {
  if (
    typeof endgameRandomnessStartMaterial !== 'number'
    || typeof endgameRandomnessEndMaterial !== 'number'
    || typeof endgameRandomnessEnd !== 'number'
  ) {
    return currentRandomness
  }

  if (remainingMaterial >= endgameRandomnessStartMaterial) {
    return currentRandomness
  }

  const materialRange = Math.max(1, endgameRandomnessStartMaterial - endgameRandomnessEndMaterial)
  const clampedMaterial = Math.max(endgameRandomnessEndMaterial, remainingMaterial)
  const progress = (endgameRandomnessStartMaterial - clampedMaterial) / materialRange
  const next = currentRandomness + (endgameRandomnessEnd - currentRandomness) * progress

  return Math.round(next)
}

export function getStockfishOpeningRandomness(difficultyKey, moveNumber, fen = null) {
  const config = DIFFICULTY_BY_KEY[difficultyKey]?.stockfishOpeningRandomness

  if (!config) {
    return 0
  }

  const openingRandomness = interpolateOpeningRandomness({
    ...config,
    moveNumber,
  })

  if (!fen) {
    return openingRandomness
  }

  return interpolateEndgameRandomness({
    currentRandomness: openingRandomness,
    endgameRandomnessStartMaterial: config.endgameRandomnessStartMaterial,
    endgameRandomnessEndMaterial: config.endgameRandomnessEndMaterial,
    endgameRandomnessEnd: config.endgameRandomnessEnd,
    remainingMaterial: getNonKingMaterialFromFen(fen),
  })
}
