export function chunkMoves(moves, chunkCount) {
  const chunks = Array.from({ length: chunkCount }, () => [])

  moves.forEach((move, index) => {
    chunks[index % chunkCount].push(move)
  })

  return chunks.filter((chunk) => chunk.length > 0)
}

export function getWorkerCount() {
  if (typeof navigator === 'undefined') {
    return 2
  }

  const hardwareThreads = navigator.hardwareConcurrency ?? 4
  return Math.min(Math.max(hardwareThreads - 1, 2), 4)
}
