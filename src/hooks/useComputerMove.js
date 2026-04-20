import { useEffect, useRef, useState } from 'react'
import { getBookOrForcedMove, getCandidateMoves, pickBestMove } from '../chess-ai'
import { chunkMoves, getWorkerCount } from '../lib/workerUtils'

export function useComputerMove({
  game,
  gameMode,
  computerColor,
  difficultyKey,
  usesStockfish,
  applyComputerMove,
}) {
  const [isComputerThinking, setIsComputerThinking] = useState(false)
  const workersRef = useRef([])
  const stockfishWorkerRef = useRef(null)
  const pendingRequestRef = useRef(0)
  const activeSearchRef = useRef(null)

  function cancelPendingComputerMove() {
    pendingRequestRef.current += 1
    activeSearchRef.current = null
    stockfishWorkerRef.current?.postMessage({ cancel: true })
    setIsComputerThinking(false)
  }

  useEffect(() => {
    const workers = Array.from({ length: getWorkerCount() }, () => new Worker(new URL('../chessWorker.js', import.meta.url), { type: 'module' }))

    for (const worker of workers) {
      worker.onmessage = (event) => {
        const { requestId, move, error } = event.data

        if (requestId !== pendingRequestRef.current || error) {
          if (requestId === pendingRequestRef.current) {
            setIsComputerThinking(false)
          }
          return
        }

        if (move) {
          activeSearchRef.current = null
          setIsComputerThinking(false)
          applyComputerMove(move)
          return
        }

        const activeSearch = activeSearchRef.current

        if (!activeSearch || activeSearch.requestId !== requestId) {
          return
        }

        activeSearch.completedWorkers += 1
        activeSearch.scoredMoves.push(...(event.data.scoredMoves ?? []))

        if (activeSearch.completedWorkers !== activeSearch.expectedWorkers) {
          return
        }

        const bestMove = pickBestMove(activeSearch.scoredMoves, computerColor)
        activeSearchRef.current = null
        setIsComputerThinking(false)

        if (bestMove) {
          applyComputerMove(bestMove)
        }
      }
    }

    workersRef.current = workers

    return () => {
      pendingRequestRef.current += 1
      activeSearchRef.current = null
      for (const worker of workers) {
        worker.terminate()
      }
      workersRef.current = []
    }
  }, [applyComputerMove, computerColor])

  useEffect(() => {
    const worker = new Worker(new URL('../stockfishWorker.js', import.meta.url), { type: 'module' })

    worker.onmessage = (event) => {
      const { requestId, move, error } = event.data

      if (requestId !== pendingRequestRef.current || error) {
        if (requestId === pendingRequestRef.current) {
          setIsComputerThinking(false)
        }
        return
      }

      activeSearchRef.current = null
      setIsComputerThinking(false)
      applyComputerMove(move)
    }

    stockfishWorkerRef.current = worker

    return () => {
      pendingRequestRef.current += 1
      activeSearchRef.current = null
      worker.postMessage({ cancel: true })
      worker.terminate()
      stockfishWorkerRef.current = null
    }
  }, [applyComputerMove])

  useEffect(() => {
    const shouldThink = gameMode !== 'twoPlayer' && game.turn() === computerColor && !game.isGameOver()

    if (!shouldThink) {
      return () => {
        cancelPendingComputerMove()
      }
    }

    const timer = window.setTimeout(() => {
      if (usesStockfish) {
        if (!stockfishWorkerRef.current) {
          return
        }

        pendingRequestRef.current += 1
        const requestId = pendingRequestRef.current
        activeSearchRef.current = { requestId, mode: 'stockfish' }
        setIsComputerThinking(true)
        stockfishWorkerRef.current.postMessage({
          requestId,
          fen: game.fen(),
          difficultyKey,
        })
        return
      }

      if (workersRef.current.length === 0) {
        return
      }

      const forcedMove = getBookOrForcedMove(game.fen(), difficultyKey)

      if (forcedMove) {
        applyComputerMove(forcedMove)
        return
      }

      const candidateMoves = getCandidateMoves(game.fen(), difficultyKey)

      if (candidateMoves.length === 0) {
        return
      }

      pendingRequestRef.current += 1
      const requestId = pendingRequestRef.current
      const moveChunks = chunkMoves(candidateMoves, Math.min(workersRef.current.length, candidateMoves.length))
      setIsComputerThinking(true)

      activeSearchRef.current = {
        requestId,
        expectedWorkers: moveChunks.length,
        completedWorkers: 0,
        scoredMoves: [],
      }

      moveChunks.forEach((moves, index) => {
        workersRef.current[index].postMessage({
          requestId,
          fen: game.fen(),
          computerColor,
          difficultyKey,
          candidateMoves: moves,
        })
      })
    }, 450)

    return () => {
      window.clearTimeout(timer)
      cancelPendingComputerMove()
    }
  }, [applyComputerMove, computerColor, difficultyKey, game, gameMode, usesStockfish])

  return {
    isComputerThinking,
    cancelPendingComputerMove,
  }
}
