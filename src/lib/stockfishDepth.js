const STOCKFISH_DYNAMIC_DEPTH_BY_DIFFICULTY = {
  hard: {
    plateauMaterial: 6800,
    stepMaterial: 1550,
    maxDepth: 12,
    rounding: 'floor',
  },
  master: {
    plateauMaterial: 7300,
    stepMaterial: 867,
    maxDepth: 17,
    rounding: 'round',
  },
}

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

export function getDynamicStockfishDepth({ fen, difficultyKey, baseDepth }) {
  const config = STOCKFISH_DYNAMIC_DEPTH_BY_DIFFICULTY[difficultyKey]

  if (!config) {
    return baseDepth
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
