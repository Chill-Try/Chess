import { DIFFICULTY_BY_KEY } from '../ai/config.js'

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

export function getStockfishOpeningRandomness(difficultyKey, moveNumber) {
  const config = DIFFICULTY_BY_KEY[difficultyKey]?.stockfishOpeningRandomness

  if (!config) {
    return 0
  }

  return interpolateOpeningRandomness({
    ...config,
    moveNumber,
  })
}
