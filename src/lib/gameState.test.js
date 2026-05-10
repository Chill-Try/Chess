import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import {
  applyMoveToGame,
  cloneGameWithHistory,
  transformCurrentTurnNonKingPiecesToQueens,
  transformCurrentTurnPawnsToKnights,
} from './gameState.js'

test('给马化腾充 Q 币会把当前行棋方所有兵和后变为马', () => {
  const game = new Chess('4k3/3q4/8/8/8/8/PPPPQ3/4K3 w - - 0 1')

  const transformedGame = transformCurrentTurnPawnsToKnights(game)

  assert.equal(transformedGame.turn(), 'w')
  assert.equal(transformedGame.get('a2')?.type, 'n')
  assert.equal(transformedGame.get('b2')?.type, 'n')
  assert.equal(transformedGame.get('c2')?.type, 'n')
  assert.equal(transformedGame.get('d2')?.type, 'n')
  assert.equal(transformedGame.get('e2')?.type, 'n')
  assert.equal(transformedGame.get('d7')?.type, 'q')
})

test('请陈帅吃肯德基会优先把当前行棋方除王兵以外的棋子变为后', () => {
  const game = new Chess('4k3/8/8/8/8/8/RNBPPBNR/4K3 w - - 0 1')

  const transformedGame = transformCurrentTurnNonKingPiecesToQueens(game)

  assert.equal(transformedGame.turn(), 'w')
  assert.equal(transformedGame.get('e1')?.type, 'k')
  assert.equal(transformedGame.get('a2')?.type, 'q')
  assert.equal(transformedGame.get('b2')?.type, 'q')
  assert.equal(transformedGame.get('c2')?.type, 'q')
  assert.equal(transformedGame.get('d2')?.type, 'p')
  assert.equal(transformedGame.get('e2')?.type, 'p')
  assert.equal(transformedGame.get('f2')?.type, 'q')
  assert.equal(transformedGame.get('g2')?.type, 'q')
  assert.equal(transformedGame.get('h2')?.type, 'q')
})

test('请陈帅吃肯德基在当前行棋方只剩王兵时会把兵也变为后', () => {
  const game = new Chess('4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1')

  const transformedGame = transformCurrentTurnNonKingPiecesToQueens(game)

  assert.equal(transformedGame.turn(), 'w')
  assert.equal(transformedGame.get('e1')?.type, 'k')
  assert.equal(transformedGame.get('a2')?.type, 'q')
  assert.equal(transformedGame.get('b2')?.type, 'q')
  assert.equal(transformedGame.get('c2')?.type, 'q')
  assert.equal(transformedGame.get('d2')?.type, 'q')
  assert.equal(transformedGame.get('a7')?.type, 'p')
  assert.equal(transformedGame.get('b7')?.type, 'p')
})

test('对局已结束时不会执行兵变马作弊', () => {
  const game = new Chess('7k/6Q1/7K/8/8/8/p7/8 b - - 0 1')

  const transformedGame = transformCurrentTurnPawnsToKnights(game)

  assert.equal(transformedGame.fen(), game.fen())
  assert.equal(transformedGame.get('a2')?.type, 'p')
})

test('对局已结束时不会执行非王变后作弊', () => {
  const game = new Chess('7k/6Q1/7K/8/8/8/p7/r7 b - - 0 1')

  const transformedGame = transformCurrentTurnNonKingPiecesToQueens(game)

  assert.equal(transformedGame.fen(), game.fen())
  assert.equal(transformedGame.get('a2')?.type, 'p')
  assert.equal(transformedGame.get('a1')?.type, 'r')
})

test('作弊后克隆棋局会保留当前真实盘面', () => {
  const game = new Chess('4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1')
  const cheatedGame = transformCurrentTurnPawnsToKnights(game)

  const clonedGame = cloneGameWithHistory(cheatedGame)

  assert.equal(clonedGame.fen(), cheatedGame.fen())
  assert.equal(clonedGame.get('a2')?.type, 'n')
})

test('作弊后仍可基于当前真实盘面应用合法走法', () => {
  const game = new Chess('4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1')
  const cheatedGame = transformCurrentTurnPawnsToKnights(game)

  const nextGame = applyMoveToGame(cheatedGame, { from: 'a2', to: 'b4' }, 'w')

  assert.equal(nextGame.get('a2'), undefined)
  assert.equal(nextGame.get('b4')?.type, 'n')
})

test('当历史已无法合法回放时，克隆会回退到当前真实盘面而不是抛错', () => {
  const game = new Chess()
  game.move('Nf3')
  game.move('Nf6')

  const cheatedGame = transformCurrentTurnNonKingPiecesToQueens(game)

  assert.doesNotThrow(() => cloneGameWithHistory(cheatedGame))
  assert.equal(cloneGameWithHistory(cheatedGame).fen(), cheatedGame.fen())
})
