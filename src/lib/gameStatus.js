export function getColorLabel(color) {
  return color === 'w' ? '白方' : '黑方'
}

export function getStatusText(game, playerColor, gameMode) {
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? '黑方' : '白方'
    return `将死，${winner}获胜。`
  }

  if (game.isStalemate()) {
    return '逼和，和棋。'
  }

  if (game.isThreefoldRepetition()) {
    return '三次重复局面，和棋。'
  }

  if (game.isInsufficientMaterial()) {
    return '子力不足，和棋。'
  }

  if (game.isDraw()) {
    return '和棋。'
  }

  const turnText = getColorLabel(game.turn())
  const suffix = game.isCheck() ? ' 当前被将军。' : ''

  if (gameMode === 'twoPlayer') {
    return `轮到${turnText}行棋。${suffix}`
  }

  const youAre = getColorLabel(playerColor)

  if (game.turn() === playerColor) {
    return `轮到你走，你执${youAre}。${suffix}`
  }

  return `电脑正在执${turnText}行棋。${suffix}`
}

export function getDrawNotice(game) {
  if (game.isThreefoldRepetition()) {
    return '检测到同一局面已重复出现 3 次，本局按国际象棋规则判和。'
  }

  if (game.isStalemate()) {
    return '当前无合法着法且未被将军，本局判为逼和。'
  }

  if (game.isInsufficientMaterial()) {
    return '双方剩余子力不足以形成将死，本局判和。'
  }

  return null
}

export function groupMovesByTurn(moveHistory) {
  const turns = []

  for (let index = 0; index < moveHistory.length; index += 2) {
    turns.push({
      moveNumber: Math.floor(index / 2) + 1,
      white: moveHistory[index] ?? '',
      black: moveHistory[index + 1] ?? '',
    })
  }

  return turns
}
