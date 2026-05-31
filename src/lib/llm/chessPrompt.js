const SYSTEM_PROMPT = [
  'You are a chess move selector.',
  'You must choose exactly one move from legal_san_moves.',
  'Your thought should be written in Chinese and kept within 120 Chinese characters.',
  'Return strict JSON only: {"thought":"...","move":"<san>"}.',
].join('')

function buildRecentTurnPairs(history) {
  if (!Array.isArray(history)) {
    return []
  }

  const recentTurns = []

  for (let index = 0; index < history.length; index += 2) {
    recentTurns.push([
      history[index] ?? '',
      history[index + 1] ?? '',
    ])
  }

  return recentTurns.slice(-5)
}

export function buildChessPrompt({ fen, turn, history, legalMoves }) {
  const recentHistory = buildRecentTurnPairs(history)
  const legalSanMoves = Array.isArray(legalMoves)
    ? legalMoves.map((move) => move.san)
    : []

  const payload = {
    fen,
    turn,
    recent_history: recentHistory,
    legal_san_moves: legalSanMoves,
  }

  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  }
}
