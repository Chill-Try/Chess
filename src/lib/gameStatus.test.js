import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { getGameEndSound } from './gameStatus.js'

test('我方获胜时返回胜利音效', () => {
  const game = new Chess('7k/6Q1/7K/8/8/8/8/8 b - - 0 1')

  assert.equal(getGameEndSound(game, 'w'), 'win')
})

test('敌方获胜时返回失败音效', () => {
  const game = new Chess('7K/6q1/7k/8/8/8/8/8 w - - 0 1')

  assert.equal(getGameEndSound(game, 'w'), 'checkmate')
})

test('和棋时返回和棋音效', () => {
  const game = new Chess('7k/5Q2/7K/8/8/8/8/8 b - - 0 1')

  assert.equal(getGameEndSound(game, 'w'), 'draw')
})

test('对局未结束时不返回结局音效', () => {
  const game = new Chess()

  assert.equal(getGameEndSound(game, 'w'), null)
})
