import { DIFFICULTY_BY_KEY } from '../ai/config.js'
import { getSupportedEndgameProfileForFen } from '../ai/endgameBook.js'

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
}

function getNonKingMaterialFromFenBoard(boardFen) {
  let total = 0

  for (const char of boardFen) {
    const piece = char.toLowerCase()
    total += PIECE_VALUES[piece] ?? 0
  }

  return total
}

function shouldForceStockfishEndgameDepth(fen, difficultyKey) {
  if (difficultyKey !== 'hard' && difficultyKey !== 'master') {
    return false
  }

  const profile = getSupportedEndgameProfileForFen(fen)

  if (!profile) {
    return false
  }

  return (
    profile.family === 'queen'
    || profile.family === 'rook'
    || profile.family === 'double-bishop'
    || profile.family === 'bishop-knight'
    || profile.family === 'minor-net'
  )
}

export function getDynamicStockfishDepth({ fen, difficultyKey, baseDepth }) {
  const config = DIFFICULTY_BY_KEY[difficultyKey]?.stockfishDepthCurve

  if (!config) {
    return baseDepth
  }

  if (shouldForceStockfishEndgameDepth(fen, difficultyKey)) {
    return Math.max(baseDepth, config.forcedEndgameDepth)
  }

  const maxDepth = Math.max(baseDepth, config.maxDepth)
  const boardFen = fen.split(' ')[0] ?? ''
  const remainingMaterial = getNonKingMaterialFromFenBoard(boardFen)

  if (remainingMaterial > config.plateauMaterial) {
    return baseDepth
  }

  const effectiveMaterial = Math.min(config.plateauMaterial, remainingMaterial)
  const rawGain = (config.plateauMaterial - effectiveMaterial) / config.stepMaterial
  const roundedGain = config.rounding === 'round' ? Math.round(rawGain) : Math.floor(rawGain)
  const depthGain = 1 + roundedGain

  return Math.min(maxDepth, baseDepth + depthGain)
}
