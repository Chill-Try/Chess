import test from 'node:test'
import assert from 'node:assert/strict'
import { createRandomSupportedEndgameDrill } from './endgameDrill.js'

function findKingSquare(game, color) {
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (piece?.type === 'k' && piece.color === color) {
        return `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      }
    }
  }

  return null
}

function canCurrentPlayerCaptureOpponentKing(game) {
  const opponentColor = game.turn() === 'w' ? 'b' : 'w'
  const opponentKingSquare = findKingSquare(game, opponentColor)

  if (!opponentKingSquare) {
    return false
  }

  return game.moves({ verbose: true }).some((move) => move.to === opponentKingSquare)
}

function countPieces(game, color) {
  const counts = { b: 0, n: 0, q: 0, r: 0, p: 0 }

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== color || piece.type === 'k') {
        continue
      }

      counts[piece.type] = (counts[piece.type] ?? 0) + 1
    }
  }

  return counts
}

test('残局对抗不会生成先手可直接吃掉对方王的局面', () => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const game = createRandomSupportedEndgameDrill()

    assert.equal(
      canCurrentPlayerCaptureOpponentKing(game),
      false,
      `invalid drill fen: ${game.fen()}`
    )
  }
})

test('残局对抗随机池包含双象残局和马象残局', () => {
  let sawDoubleBishop = false
  let sawBishopKnight = false

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const game = createRandomSupportedEndgameDrill()
    const whiteCounts = countPieces(game, 'w')
    const blackCounts = countPieces(game, 'b')
    const blackExtraPieces = blackCounts.b + blackCounts.n + blackCounts.q + blackCounts.r + blackCounts.p

    if (blackExtraPieces !== 0) {
      continue
    }

    if (whiteCounts.b === 2 && whiteCounts.n === 0 && whiteCounts.q === 0 && whiteCounts.r === 0 && whiteCounts.p === 0) {
      sawDoubleBishop = true
    }

    if (whiteCounts.b === 1 && whiteCounts.n === 1 && whiteCounts.q === 0 && whiteCounts.r === 0 && whiteCounts.p === 0) {
      sawBishopKnight = true
    }

    if (sawDoubleBishop && sawBishopKnight) {
      break
    }
  }

  assert.equal(sawDoubleBishop, true)
  assert.equal(sawBishopKnight, true)
})
