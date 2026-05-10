import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createComputerMoveRequestContext,
  getRandomizedMoveDisplayMs,
} from './computerMoveRequest.js'

test('base delay <= 0 时不增加展示延迟', () => {
  assert.equal(getRandomizedMoveDisplayMs(0), 0)
  assert.equal(getRandomizedMoveDisplayMs(-1), 0)
})

test('请求上下文会锁定开始时间、展示时长和对局代际', () => {
  const context = createComputerMoveRequestContext({
    minMoveDisplayMs: 800,
    gameSessionId: 9,
    now: 1234,
    randomizeDisplayMs: () => 666,
  })

  assert.deepEqual(context, {
    startedAt: 1234,
    displayMs: 666,
    sessionId: 9,
  })
})
