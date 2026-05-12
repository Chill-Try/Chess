import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldSkipStockfishBookMove,
  shouldUseStockfishBookMove,
} from './computerMoveScheduling.js'

test('hard 难度在 Stockfish 模式下会启用开局库快速分支', () => {
  assert.equal(
    shouldUseStockfishBookMove({ difficultyKey: 'hard', usesStockfish: true }),
    true
  )
})

test('未启用 Stockfish 时不会走 Stockfish 开局库快速分支', () => {
  assert.equal(
    shouldUseStockfishBookMove({ difficultyKey: 'hard', usesStockfish: false }),
    false
  )
})

test('未配置 useOpeningBook 的难度不会走 Stockfish 开局库快速分支', () => {
  assert.equal(
    shouldUseStockfishBookMove({ difficultyKey: 'beginner', usesStockfish: true }),
    false
  )
})

test('Stockfish 难度可按配置概率跳过开局库', () => {
  assert.equal(
    shouldSkipStockfishBookMove({ difficultyKey: 'master', randomValue: 0.39 }),
    true
  )
  assert.equal(
    shouldSkipStockfishBookMove({ difficultyKey: 'master', randomValue: 0.4 }),
    false
  )
  assert.equal(
    shouldSkipStockfishBookMove({ difficultyKey: 'hard', randomValue: 0.39 }),
    true
  )
  assert.equal(
    shouldSkipStockfishBookMove({ difficultyKey: 'beginner', randomValue: 0 }),
    false
  )
})
