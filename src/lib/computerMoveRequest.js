const COMPUTER_MOVE_DELAY_JITTER_RATIO = 0.5

export function getRandomizedMoveDisplayMs(baseDelayMs) {
  if (baseDelayMs <= 0) {
    return 0
  }

  const jitterRangeMs = baseDelayMs * COMPUTER_MOVE_DELAY_JITTER_RATIO
  const jitter = Math.round((Math.random() * 2 - 1) * jitterRangeMs)
  return Math.max(0, baseDelayMs + jitter)
}

export function createComputerMoveRequestContext({
  minMoveDisplayMs,
  gameSessionId,
  now = performance.now(),
  randomizeDisplayMs = getRandomizedMoveDisplayMs,
}) {
  return {
    startedAt: now,
    displayMs: randomizeDisplayMs(minMoveDisplayMs),
    sessionId: gameSessionId,
  }
}
