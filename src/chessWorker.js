import { getBookOrForcedMove, pickBestMove, scoreComputerMoves } from './chess-ai'

self.onmessage = (event) => {
  const { requestId, fen, computerColor, difficultyKey, candidateMoves } = event.data

  try {
    const forcedMove = getBookOrForcedMove(fen, difficultyKey)

    if (forcedMove) {
      self.postMessage({ requestId, move: forcedMove, done: true })
      return
    }

    const scoredMoves = scoreComputerMoves(fen, computerColor, difficultyKey, candidateMoves)

    if (!candidateMoves) {
      self.postMessage({
        requestId,
        move: pickBestMove(scoredMoves, computerColor),
        done: true,
      })
      return
    }

    self.postMessage({ requestId, scoredMoves, done: true })
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'Unknown worker error',
    })
  }
}
