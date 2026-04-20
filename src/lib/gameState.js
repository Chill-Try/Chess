import { Chess } from 'chess.js'

export function getKingSquare(game, color) {
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

export function getCheckingSquares(game, color) {
  const kingSquare = getKingSquare(game, color)

  if (!kingSquare) {
    return []
  }

  return game.attackers(kingSquare, color === 'w' ? 'b' : 'w')
}

export function cloneGameWithHistory(game) {
  const nextGame = new Chess()

  for (const move of game.history()) {
    nextGame.move(move)
  }

  return nextGame
}

export function applyMoveToGame(currentGame, move, expectedTurn) {
  if (!move || currentGame.isGameOver() || currentGame.turn() !== expectedTurn) {
    return currentGame
  }

  const nextGame = cloneGameWithHistory(currentGame)

  try {
    nextGame.move(move)
    return nextGame
  } catch {
    return currentGame
  }
}
