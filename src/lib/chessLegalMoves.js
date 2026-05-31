export function buildLegalMoves(game) {
  return game.moves({ verbose: true }).map((move) => {
    const promotion = move.promotion ?? null

    return {
      uci: `${move.from}${move.to}${promotion ?? ''}`,
      san: move.san,
      from: move.from,
      to: move.to,
      promotion,
    }
  })
}
