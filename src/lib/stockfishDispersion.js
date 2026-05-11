import { DIFFICULTY_BY_KEY } from '../ai/config.js'
import { getStockfishOpeningRandomness } from './stockfishOpeningRandomness.js'

export function getCurrentStockfishDispersion({ fen, difficultyKey }) {
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey]

  if (!difficulty || difficulty.engine !== 'stockfish') {
    return null
  }

  const moveNumber = Number.parseInt(fen.split(' ')[5] ?? '1', 10) || 1
  return getStockfishOpeningRandomness(difficultyKey, moveNumber)
}
