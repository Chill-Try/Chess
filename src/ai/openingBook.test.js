import test from 'node:test'
import assert from 'node:assert/strict'
import { selectBookMoveIndex } from './openingBook.js'

test('开局库选点使用均匀随机，不受开局随机度影响', () => {
  assert.equal(selectBookMoveIndex(2, () => 0.7), 1)
  assert.equal(selectBookMoveIndex(6, () => 0.7), 4)
})
