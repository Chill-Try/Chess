import test from 'node:test'
import assert from 'node:assert/strict'
import { getDynamicStockfishDepth } from './stockfishDepth.js'

test('hard 难度开局保持基础深度 8', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      difficultyKey: 'hard',
      baseDepth: 8,
    }),
    8
  )
})

test('hard 难度在约 6800 子力附近升到 9', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPP5/RNB1KBNR w KQkq - 0 1',
      difficultyKey: 'hard',
      baseDepth: 8,
    }),
    9
  )
})

test('hard 难度在约 5200 子力附近升到 10', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'rnb1kbn1/pppppppp/8/8/8/8/PPPPPPPP/1NB1KBNR w Kq - 0 1',
      difficultyKey: 'hard',
      baseDepth: 8,
    }),
    10
  )
})

test('hard 难度在约 3600 子力附近升到 11', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '1nb1kbn1/ppppp3/8/8/8/8/PPPPP3/1NB1KBN1 w q - 0 1',
      difficultyKey: 'hard',
      baseDepth: 8,
    }),
    11
  )
})

test('hard 难度在约 2100 子力附近升到 12', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '3qk3/ppp5/8/8/8/8/8/3QK3 w - - 0 1',
      difficultyKey: 'hard',
      baseDepth: 8,
    }),
    12
  )
})

test('hard 难度残局会提升到最大深度 12', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      difficultyKey: 'hard',
      baseDepth: 8,
    }),
    12
  )
})

test('hard 难度命中 K+R vs K 时直接提到 18 层', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'k7/8/1K6/1R6/8/8/8/8 w - - 0 1',
      difficultyKey: 'hard',
      baseDepth: 8,
    }),
    18
  )
})

test('hard 难度命中 K+Q vs K+P 时直接提到 18 层', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '6k1/6p1/6Q1/8/8/8/8/6K1 w - - 0 1',
      difficultyKey: 'hard',
      baseDepth: 8,
    }),
    18
  )
})

test('未配置动态曲线的难度保持原始深度', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      difficultyKey: 'beginner',
      baseDepth: 17,
    }),
    17
  )
})

test('master 难度开局保持基础深度 11', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    11
  )
})

test('master 难度在约 7300 子力附近升到 12', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/2PPPPPP/1NBQKBNR w KQkq - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    12
  )
})

test('master 难度在约 6500 子力附近升到 13', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/5PPP/1NBQKBN1 w kq - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    13
  )
})

test('master 难度在约 5700 子力附近升到 14', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/4PPPP/1NB1KBN1 w kq - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    14
  )
})

test('master 难度在约 4900 子力附近升到 15', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/4K3 w kq - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    15
  )
})

test('master 难度在约 4100 子力附近升到 16', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'qq2k3/pp6/8/8/8/8/PPP5/QQ2K3 w - - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    16
  )
})

test('master 难度在约 3300 子力附近升到 17', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '3qk3/ppp5/8/8/8/8/PPP5/QQ2K3 w - - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    17
  )
})

test('master 难度在约 2100 子力附近升到 17', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '3qk3/ppp5/8/8/8/8/8/3QK3 w - - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    17
  )
})

test('master 难度残局会提升到最大深度 17', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    17
  )
})

test('master 难度命中 K+B+N vs K 时直接提到 18 层', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: 'k7/8/1K6/8/8/8/2BN4/8 w - - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    18
  )
})

test('master 难度命中 K+Q+额外子力 vs K+P 时直接提到 18 层', () => {
  assert.equal(
    getDynamicStockfishDepth({
      fen: '6k1/6p1/6Q1/8/8/8/8/5BK1 w - - 0 1',
      difficultyKey: 'master',
      baseDepth: 11,
    }),
    18
  )
})
