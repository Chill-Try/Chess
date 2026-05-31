import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { buildLegalMoves } from './chessLegalMoves.js'

test('buildLegalMoves 会把 chess.js verbose moves 转成结构化合法走法', () => {
  const game = new Chess()
  const legalMoves = buildLegalMoves(game)
  const move = legalMoves.find(({ uci }) => uci === 'e2e4')

  assert.ok(move)
  assert.equal(move.uci, 'e2e4')
  assert.equal(typeof move.san, 'string')
  assert.notEqual(move.san, '')
  assert.equal(move.from, 'e2')
  assert.equal(move.to, 'e4')
  assert.equal(move.promotion, null)
})

test('buildLegalMoves 在升变时会返回 promotion 且 uci 带升变后缀', () => {
  const game = new Chess('4k3/P7/8/8/8/8/8/K7 w - - 0 1')
  const legalMoves = buildLegalMoves(game)
  const move = legalMoves.find(({ uci }) => uci === 'a7a8q')

  assert.ok(move)
  assert.equal(move.uci, 'a7a8q')
  assert.equal(typeof move.san, 'string')
  assert.notEqual(move.san, '')
  assert.equal(move.from, 'a7')
  assert.equal(move.to, 'a8')
  assert.equal(move.promotion, 'q')
})
