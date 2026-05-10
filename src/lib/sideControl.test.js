import test from 'node:test'
import assert from 'node:assert/strict'
import { canManualMove, getComputerTurnConfig, getRoleForTurn, getSideColor } from './sideControl.js'

test('我方选择玩家时，仅我方回合允许手动操作', () => {
  assert.equal(
    canManualMove({
      turnColor: 'w',
      playerColor: 'w',
      mySideRole: 'player',
      opponentSideRole: 'computer',
    }),
    true
  )

  assert.equal(
    canManualMove({
      turnColor: 'b',
      playerColor: 'w',
      mySideRole: 'player',
      opponentSideRole: 'computer',
    }),
    false
  )
})

test('我方选择电脑时，当前回合会读取我方电脑难度', () => {
  assert.deepEqual(
    getComputerTurnConfig({
      turnColor: 'w',
      playerColor: 'w',
      mySideRole: 'computer',
      opponentSideRole: 'player',
      myComputerDifficultyKey: 'hard',
      opponentComputerDifficultyKey: 'beginner',
    }),
    {
      computerColor: 'w',
      difficultyKey: 'hard',
    }
  )
})

test('敌方选择电脑时，当前回合会读取敌方电脑难度', () => {
  assert.deepEqual(
    getComputerTurnConfig({
      turnColor: 'b',
      playerColor: 'w',
      mySideRole: 'player',
      opponentSideRole: 'computer',
      myComputerDifficultyKey: 'hard',
      opponentComputerDifficultyKey: 'master',
    }),
    {
      computerColor: 'b',
      difficultyKey: 'master',
    }
  )
})

test('敌方选择玩家时，不会被识别为电脑回合', () => {
  assert.equal(
    getRoleForTurn({
      turnColor: 'b',
      playerColor: 'w',
      mySideRole: 'computer',
      opponentSideRole: 'player',
    }),
    'player'
  )

  assert.equal(
    getComputerTurnConfig({
      turnColor: 'b',
      playerColor: 'w',
      mySideRole: 'computer',
      opponentSideRole: 'player',
      myComputerDifficultyKey: 'medium',
      opponentComputerDifficultyKey: 'hard',
    }),
    null
  )
})

test('颜色映射会把敌方转换为相对颜色', () => {
  assert.equal(getSideColor('my', 'b'), 'b')
  assert.equal(getSideColor('opponent', 'b'), 'w')
})
