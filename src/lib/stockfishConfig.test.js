import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStockfishSearchPlan, getStockfishThreads } from './stockfishConfig.js'

test('hard 难度会下发限强与 ELO 参数', () => {
  const plan = buildStockfishSearchPlan({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    difficultyKey: 'hard',
  })

  assert.equal(plan.depth, 8)
  assert.equal(plan.openingRandomness, 14)
  assert.equal(plan.multiPv, 1)
  assert.deepEqual(plan.commands, [
    'ucinewgame',
    'setoption name Threads value 1',
    'setoption name MultiPV value 1',
    'setoption name UCI_LimitStrength value true',
    'setoption name UCI_Elo value 1700',
    'position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'go depth 8',
  ])
})

test('master 难度会下发技能和 multipv 参数', () => {
  const plan = buildStockfishSearchPlan({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    difficultyKey: 'master',
  })

  assert.equal(plan.depth, 11)
  assert.equal(plan.openingRandomness, 18)
  assert.equal(plan.multiPv, 2)
  assert.equal(plan.randomWindowCp, 20)
  assert.equal(plan.randomnessScale, 10)
  assert.deepEqual(plan.commands, [
    'ucinewgame',
    'setoption name Threads value 1',
    'setoption name Skill Level value 20',
    'setoption name MultiPV value 2',
    'setoption name UCI_LimitStrength value false',
    'position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'go depth 11',
  ])
})

test('多线程引擎默认使用最多 4 个线程', () => {
  assert.equal(getStockfishThreads(), 1)
  assert.equal(getStockfishThreads(2), 2)
  assert.equal(getStockfishThreads(6), 4)
})
