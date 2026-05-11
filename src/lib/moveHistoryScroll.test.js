import test from 'node:test'
import assert from 'node:assert/strict'
import { scrollMoveHistoryToBottom } from './moveHistoryScroll.js'

test('行棋记录滚动逻辑会把列表滚动到底部', () => {
  const element = {
    scrollTop: 12,
    scrollHeight: 345,
  }

  scrollMoveHistoryToBottom(element)

  assert.equal(element.scrollTop, 345)
})
