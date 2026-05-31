export function parseChessMoveResponse(text) {
  if (text.includes('```')) {
    throw new Error('Expected strict JSON response without markdown code fences')
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Expected strict JSON response')
  }
  const { thought, move } = parsed ?? {}

  if (typeof thought !== 'string') {
    throw new Error('Expected strict JSON with string thought')
  }

  if (typeof move !== 'string') {
    throw new Error('Expected strict JSON with string move')
  }

  const trimmedThought = thought.trim()
  const trimmedMove = move.trim()

  if (!trimmedMove) {
    throw new Error('Expected strict JSON with non-empty move')
  }

  return {
    thought: trimmedThought,
    move: trimmedMove,
  }
}
