import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStockfishScore, parseStockfishInfoLine, pickWeightedMove } from './stockfishMultiPv.js'

test('解析 Stockfish multipv 行', () => {
  assert.deepEqual(
    parseStockfishInfoLine('info depth 18 seldepth 26 multipv 2 score cp 31 nodes 1000 pv e2e4 e7e5'),
    {
      multipv: 2,
      move: {
        from: 'e2',
        to: 'e4',
        promotion: undefined,
      },
      score: {
        type: 'cp',
        value: 31,
      },
    }
  )
})

test('mate 分数会被归一化为高优先级数值', () => {
  assert.ok(normalizeStockfishScore({ type: 'mate', value: 3 }) > normalizeStockfishScore({ type: 'cp', value: 3000 }))
  assert.ok(normalizeStockfishScore({ type: 'mate', value: -2 }) < normalizeStockfishScore({ type: 'cp', value: -3000 }))
})

test('只在近优窗口内随机选择候选', () => {
  const originalRandom = Math.random
  Math.random = () => 0.99

  try {
    const move = pickWeightedMove(
      [
        { move: { from: 'e2', to: 'e4' }, score: { type: 'cp', value: 40 } },
        { move: { from: 'd2', to: 'd4' }, score: { type: 'cp', value: 28 } },
        { move: { from: 'g1', to: 'f3' }, score: { type: 'cp', value: -15 } },
      ],
      20,
      10
    )

    assert.notDeepEqual(move, { from: 'g1', to: 'f3' })
  } finally {
    Math.random = originalRandom
  }
})
