import { DIFFICULTY_BY_KEY } from '../ai/config.js'

export function shouldUseStockfishBookMove({ difficultyKey, usesStockfish }) {
  if (!usesStockfish) {
    return false
  }

  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner
  return difficulty.useOpeningBook === true
}

export function shouldSkipStockfishBookMove({ difficultyKey, randomValue = Math.random() }) {
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey] ?? DIFFICULTY_BY_KEY.beginner
  const skipChance = difficulty.openingBookSkipChance ?? 0
  return randomValue < skipChance
}
