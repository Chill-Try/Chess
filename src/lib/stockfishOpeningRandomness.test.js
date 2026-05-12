import test from 'node:test'
import assert from 'node:assert/strict'
import { DIFFICULTY_BY_KEY } from '../ai/config.js'
import {
  getOpeningPhaseProgress,
  interpolateOpeningRandomness,
  getStockfishOpeningRandomness,
} from './stockfishOpeningRandomness.js'

test('Stockfish 难度的开局随机参数暴露在 config.js 中', () => {
  assert.deepEqual(DIFFICULTY_BY_KEY.hard.stockfishOpeningRandomness, {
    openingRandomnessStart: 14,
    openingRandomnessEnd: 8,
    openingRandomnessEndMoveNumber: 7,
  })

  assert.deepEqual(DIFFICULTY_BY_KEY.master.stockfishOpeningRandomness, {
    openingRandomnessStart: 18,
    openingRandomnessEnd: 10,
    openingRandomnessEndMoveNumber: 7,
    endgameRandomnessStartMaterial: 3300,
    endgameRandomnessEndMaterial: 0,
    endgameRandomnessEnd: 2,
  })
})

test('开局随机度会随回合推进线性收敛', () => {
  assert.equal(getOpeningPhaseProgress(1, 7), 0)
  assert.equal(getOpeningPhaseProgress(7, 7), 1)
  assert.equal(getOpeningPhaseProgress(4, 7), 0.5)

  assert.equal(interpolateOpeningRandomness({
    openingRandomnessStart: 18,
    openingRandomnessEnd: 10,
    openingRandomnessEndMoveNumber: 7,
    moveNumber: 1,
  }), 18)

  assert.equal(interpolateOpeningRandomness({
    openingRandomnessStart: 18,
    openingRandomnessEnd: 10,
    openingRandomnessEndMoveNumber: 7,
    moveNumber: 4,
  }), 14)

  assert.equal(interpolateOpeningRandomness({
    openingRandomnessStart: 18,
    openingRandomnessEnd: 10,
    openingRandomnessEndMoveNumber: 7,
    moveNumber: 9,
  }), 10)
})

test('可按难度读取当前回合的 Stockfish 开局随机度', () => {
  assert.equal(getStockfishOpeningRandomness('hard', 1), 14)
  assert.equal(getStockfishOpeningRandomness('hard', 7), 8)
  assert.equal(getStockfishOpeningRandomness('master', 1), 18)
  assert.equal(getStockfishOpeningRandomness('master', 7), 10)
})

test('master 难度在残局会把发散度继续压到 2', () => {
  assert.equal(
    getStockfishOpeningRandomness(
      'master',
      7,
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
    ),
    2
  )
})
