import test from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentStockfishDispersion } from './stockfishDispersion.js'

test('当前局面能真正取到开局库走法时显示开局随机度', () => {
  assert.equal(getCurrentStockfishDispersion({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    difficultyKey: 'master',
  }), 18)
})

test('脱离开局库后仍显示同一条 config 曲线，不叠加第二套参数', () => {
  assert.equal(getCurrentStockfishDispersion({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    difficultyKey: 'master',
    inOpeningBook: false,
  }), 18)
})

test('非 Stockfish 难度不显示发散程度', () => {
  assert.equal(getCurrentStockfishDispersion({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    difficultyKey: 'beginner',
    inOpeningBook: true,
  }), null)
})
