export function normalizeStockfishScore(score) {
  if (!score) {
    return null
  }

  if (score.type === 'mate') {
    const distance = Math.abs(score.value)
    const base = 100000 - Math.min(distance, 1000)
    return score.value > 0 ? base : -base
  }

  if (score.type === 'cp') {
    return score.value
  }

  return null
}

export function parseStockfishInfoLine(line) {
  if (!line.startsWith('info ')) {
    return null
  }

  const multipvMatch = line.match(/\bmultipv\s+(\d+)/)
  const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/)
  const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/)
  const pvMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/)

  if (!multipvMatch || !pvMatch || (!cpMatch && !mateMatch)) {
    return null
  }

  const rawMove = pvMatch[1]

  return {
    multipv: Number.parseInt(multipvMatch[1], 10),
    move: {
      from: rawMove.slice(0, 2),
      to: rawMove.slice(2, 4),
      promotion: rawMove[4] ?? undefined,
    },
    score: cpMatch
      ? { type: 'cp', value: Number.parseInt(cpMatch[1], 10) }
      : { type: 'mate', value: Number.parseInt(mateMatch[1], 10) },
  }
}

export function pickWeightedMove(candidates, randomWindowCp, randomnessScale = 12) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null
  }

  const normalizedCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      normalizedScore: normalizeStockfishScore(candidate.score),
    }))
    .filter((candidate) => candidate.normalizedScore !== null)
    .sort((left, right) => right.normalizedScore - left.normalizedScore)

  if (normalizedCandidates.length === 0) {
    return null
  }

  const bestScore = normalizedCandidates[0].normalizedScore
  const viableCandidates = normalizedCandidates.filter(
    (candidate) => bestScore - candidate.normalizedScore <= randomWindowCp
  )

  if (viableCandidates.length === 1) {
    return viableCandidates[0].move
  }

  const weightedCandidates = viableCandidates.map((candidate) => ({
    move: candidate.move,
    weight: Math.exp(-(bestScore - candidate.normalizedScore) / randomnessScale),
  }))

  const totalWeight = weightedCandidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  let cursor = Math.random() * totalWeight

  for (const candidate of weightedCandidates) {
    cursor -= candidate.weight

    if (cursor <= 0) {
      return candidate.move
    }
  }

  return weightedCandidates.at(-1)?.move ?? null
}
