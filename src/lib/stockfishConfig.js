import { DIFFICULTY_BY_KEY } from '../ai/config.js'
import { getDynamicStockfishDepth } from './stockfishDepth.js'
import { getStockfishOpeningRandomness } from './stockfishOpeningRandomness.js'

export function getStockfishThreads(hardwareConcurrency = 1) {
  const normalized = Number.isFinite(hardwareConcurrency) ? hardwareConcurrency : 1
  return Math.max(1, Math.min(4, normalized))
}

export function buildStockfishSearchPlan({
  fen,
  difficultyKey,
  hardwareConcurrency = 1,
}) {
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey]

  if (!difficulty || difficulty.engine !== 'stockfish') {
    throw new Error(`Unsupported Stockfish difficulty: ${difficultyKey}`)
  }

  const depth = getDynamicStockfishDepth({
    fen,
    difficultyKey,
    baseDepth: difficulty.stockfishDepth ?? difficulty.depth,
  })
  const moveNumber = Number.parseInt(fen.split(' ')[5] ?? '1', 10) || 1
  const openingRandomness = getStockfishOpeningRandomness(difficultyKey, moveNumber)

  const threads = getStockfishThreads(hardwareConcurrency)
  const commands = ['ucinewgame', `setoption name Threads value ${threads}`]

  if (typeof difficulty.skillLevel === 'number') {
    commands.push(`setoption name Skill Level value ${difficulty.skillLevel}`)
  }

  commands.push(`setoption name MultiPV value ${difficulty.multiPv ?? 1}`)
  commands.push(`setoption name UCI_LimitStrength value ${difficulty.limitStrength ? 'true' : 'false'}`)

  if (difficulty.limitStrength && difficulty.elo) {
    commands.push(`setoption name UCI_Elo value ${difficulty.elo}`)
  }

  commands.push(`position fen ${fen}`)
  commands.push(`go depth ${depth}`)

  return {
    depth,
    threads,
    openingRandomness,
    multiPv: difficulty.multiPv ?? 1,
    randomWindowCp: difficulty.randomWindowCp ?? 0,
    randomnessScale: difficulty.randomnessScale ?? 12,
    commands,
  }
}
