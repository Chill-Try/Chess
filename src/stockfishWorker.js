import { DIFFICULTY_BY_KEY } from './ai/config'
import stockfishEngineUrl from 'stockfish/bin/stockfish-18-asm.js?url'

const STOCKFISH_CONFIG = {
  hard: {
    depth: DIFFICULTY_BY_KEY.hard.stockfishDepth,
    movetime: null,
    limitStrength: true,
    elo: 1700,
  },
  master: {
    depth: DIFFICULTY_BY_KEY.master.stockfishDepth,
    movetime: null,
    skillLevel: 20,
    limitStrength: false,
    elo: null,
  },
}

let engine = null
let engineReady = false
let currentRequest = null
let readyResolvers = []

function resolveReady() {
  engineReady = true
  readyResolvers.forEach((resolve) => resolve())
  readyResolvers = []
}

function waitForReady() {
  if (engineReady) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    readyResolvers.push(resolve)
    engine.postMessage('isready')
  })
}

function parseBestMove(line) {
  const match = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/)

  if (!match) {
    return null
  }

  const moveText = match[1]
  return {
    from: moveText.slice(0, 2),
    to: moveText.slice(2, 4),
    promotion: moveText[4] ?? undefined,
  }
}

function ensureEngine() {
  if (engine) {
    return
  }

  engine = new Worker(stockfishEngineUrl)
  engine.onmessage = (event) => {
    const line = typeof event.data === 'string' ? event.data : ''

    if (line.includes('readyok')) {
      resolveReady()
      return
    }

    if (!line.startsWith('bestmove') || !currentRequest) {
      return
    }

    const move = parseBestMove(line)
    self.postMessage({ requestId: currentRequest.requestId, move })
    currentRequest = null
  }

  engine.onerror = (error) => {
    if (!currentRequest) {
      return
    }

    self.postMessage({
      requestId: currentRequest.requestId,
      error: error.message || 'Stockfish engine error',
    })
    currentRequest = null
  }

  engine.postMessage('uci')
  engine.postMessage('setoption name Hash value 16')
  engine.postMessage('setoption name UCI_AnalyseMode value false')
}

self.onmessage = async (event) => {
  const { requestId, fen, difficultyKey, cancel } = event.data

  ensureEngine()

  if (cancel) {
    currentRequest = null
    engine.postMessage('stop')
    return
  }

  const config = STOCKFISH_CONFIG[difficultyKey]

  if (!config) {
    self.postMessage({ requestId, error: `Unsupported Stockfish difficulty: ${difficultyKey}` })
    return
  }

  await waitForReady()

  // 新请求开始前先停掉旧搜索，避免旧结果回写到新局面。
  if (currentRequest) {
    engine.postMessage('stop')
  }

  currentRequest = { requestId }
  engine.postMessage('ucinewgame')

  if (typeof config.skillLevel === 'number') {
    engine.postMessage(`setoption name Skill Level value ${config.skillLevel}`)
  }

  engine.postMessage(`setoption name UCI_LimitStrength value ${config.limitStrength ? 'true' : 'false'}`)

  if (config.limitStrength && config.elo) {
    engine.postMessage(`setoption name UCI_Elo value ${config.elo}`)
  }

  engine.postMessage(`position fen ${fen}`)

  if (config.movetime) {
    engine.postMessage(`go movetime ${config.movetime}`)
    return
  }

  engine.postMessage(`go depth ${config.depth}`)
}
