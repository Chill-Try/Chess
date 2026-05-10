import { Chess } from 'chess.js'

function countPieces(game) {
  const counts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  }

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) {
        continue
      }

      counts[piece.color][piece.type] += 1
    }
  }

  return counts
}

export function getSupportedEndgameProfile(counts, strongColor) {
  const weakColor = strongColor === 'w' ? 'b' : 'w'
  const strong = counts[strongColor]
  const weak = counts[weakColor]
  const weakExtras = weak.p + weak.n + weak.b + weak.r + weak.q

  if (weakExtras > 1) {
    return null
  }

  const weakHasSinglePawn = weak.p === 1 && weakExtras === 1
  const weakIsLoneKing = weakExtras === 0

  if (!weakHasSinglePawn && !weakIsLoneKing) {
    return null
  }

  const strongMajors = strong.q + strong.r
  const strongMinors = strong.b + strong.n
  const strongHasPawns = strong.p > 0
  const hasQueenFamily = strong.q >= 1
  const hasRookFamily = strong.r >= 1 && !strongHasPawns
  const isDoubleBishop = strong.b >= 2 && strongMajors === 0 && strong.n === 0 && !strongHasPawns
  const isBishopKnight = strong.b >= 1 && strong.n >= 1 && strongMajors === 0 && !strongHasPawns
  const isSupportedMinorMate =
    strongMinors >= 2 && strong.b >= 1 && strongMajors === 0 && !strongHasPawns

  if (weakHasSinglePawn) {
    if (hasQueenFamily) {
      return { family: 'queen', weakColor, weakHasPawn: true }
    }

    if (hasRookFamily) {
      return { family: 'rook', weakColor, weakHasPawn: true }
    }

    return null
  }

  if (hasQueenFamily) {
    return { family: 'queen', weakColor, weakHasPawn: false }
  }

  if (hasRookFamily) {
    return { family: 'rook', weakColor, weakHasPawn: false }
  }

  if (isDoubleBishop) {
    return { family: 'double-bishop', weakColor, weakHasPawn: false }
  }

  if (isBishopKnight) {
    return { family: 'bishop-knight', weakColor, weakHasPawn: false }
  }

  if (isSupportedMinorMate) {
    return { family: 'minor-net', weakColor, weakHasPawn: false }
  }

  return null
}

export function getSupportedEndgameProfileForFen(fen, strongColorOverride = null) {
  const game = new Chess(fen)
  const strongColor = strongColorOverride ?? game.turn()
  const counts = countPieces(game)
  return getSupportedEndgameProfile(counts, strongColor)
}
