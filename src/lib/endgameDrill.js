import { Chess } from 'chess.js'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const SUPPORTED_PATTERNS = [
  'KQvK',
  'KRvK',
  'BBvK',
  'BNvK',
  'KQXvK',
  'KRXvK',
  'KQvKP',
  'KRvKP',
  'KQXvKP',
  'KRXvKP',
]

function square(fileIndex, rank) {
  return `${FILES[fileIndex]}${rank}`
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function randomSquare(excludedSquares = new Set(), allowedRanks = [1, 2, 3, 4, 5, 6, 7, 8]) {
  const candidates = []

  for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
    for (const rank of allowedRanks) {
      const nextSquare = square(fileIndex, rank)

      if (!excludedSquares.has(nextSquare)) {
        candidates.push(nextSquare)
      }
    }
  }

  return randomItem(candidates)
}

function placePiece(positionMap, squareName, pieceCode) {
  positionMap.set(squareName, pieceCode)
}

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

function buildFen(positionMap) {
  const ranks = []

  for (let rank = 8; rank >= 1; rank -= 1) {
    let row = ''
    let emptyCount = 0

    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const piece = positionMap.get(square(fileIndex, rank))

      if (!piece) {
        emptyCount += 1
        continue
      }

      if (emptyCount > 0) {
        row += String(emptyCount)
        emptyCount = 0
      }

      row += piece
    }

    if (emptyCount > 0) {
      row += String(emptyCount)
    }

    ranks.push(row)
  }

  return `${ranks.join('/')} w - - 0 1`
}

function generatePatternPieces(pattern) {
  if (pattern === 'KQvK') {
    return ['Q']
  }

  if (pattern === 'KRvK') {
    return ['R']
  }

  if (pattern === 'BBvK') {
    return ['B', 'B']
  }

  if (pattern === 'BNvK') {
    return ['B', 'N']
  }

  if (pattern === 'KQXvK') {
    return ['Q', randomItem(['R', 'B', 'N'])]
  }

  if (pattern === 'KRXvK') {
    return ['R', randomItem(['B', 'N'])]
  }

  if (pattern === 'KQvKP') {
    return ['Q', 'p']
  }

  if (pattern === 'KRvKP') {
    return ['R', 'p']
  }

  if (pattern === 'KQXvKP') {
    return ['Q', randomItem(['R', 'B', 'N']), 'p']
  }

  return ['R', randomItem(['B', 'N']), 'p']
}

function tryGeneratePattern(pattern) {
  const positionMap = new Map()
  const usedSquares = new Set()

  const whiteKingSquare = randomSquare(usedSquares, [1, 2, 3, 4])
  placePiece(positionMap, whiteKingSquare, 'K')
  usedSquares.add(whiteKingSquare)

  const blackKingSquare = randomSquare(usedSquares, [5, 6, 7, 8])
  placePiece(positionMap, blackKingSquare, 'k')
  usedSquares.add(blackKingSquare)

  const [whiteKingFile, whiteKingRank] = [whiteKingSquare.charCodeAt(0) - 97, Number.parseInt(whiteKingSquare[1], 10)]
  const [blackKingFile, blackKingRank] = [blackKingSquare.charCodeAt(0) - 97, Number.parseInt(blackKingSquare[1], 10)]
  const kingDistance = Math.max(
    Math.abs(whiteKingFile - blackKingFile),
    Math.abs(whiteKingRank - blackKingRank)
  )

  if (kingDistance <= 1) {
    return null
  }

  const patternPieces = generatePatternPieces(pattern)

  for (const pieceCode of patternPieces) {
    if (pieceCode === 'p') {
      const pawnSquare = randomSquare(usedSquares, [3, 4, 5, 6])
      placePiece(positionMap, pawnSquare, 'p')
      usedSquares.add(pawnSquare)
      continue
    }

    const supportSquare = randomSquare(usedSquares, [2, 3, 4, 5, 6, 7])
    placePiece(positionMap, supportSquare, pieceCode)
    usedSquares.add(supportSquare)
  }

  const fen = buildFen(positionMap)
  const game = new Chess(fen)

  if (game.isGameOver() || game.isCheck() || canCurrentPlayerCaptureOpponentKing(game)) {
    return null
  }

  return game
}

export function createRandomSupportedEndgameDrill() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const pattern = randomItem(SUPPORTED_PATTERNS)
    const game = tryGeneratePattern(pattern)

    if (game) {
      return game
    }
  }

  return new Chess('4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1')
}
