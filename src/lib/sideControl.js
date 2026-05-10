/**
 * @file lib/sideControl.js
 * @description 对局双方角色与当前回合控制辅助函数
 */

/**
 * 获取与指定颜色相反的颜色。
 *
 * @param {'w' | 'b'} color
 * @returns {'w' | 'b'}
 */
export function getOpponentColor(color) {
  return color === 'w' ? 'b' : 'w'
}

/**
 * 根据“我方”映射到实际棋子颜色。
 *
 * @param {'my' | 'opponent'} side
 * @param {'w' | 'b'} playerColor
 * @returns {'w' | 'b'}
 */
export function getSideColor(side, playerColor) {
  return side === 'my' ? playerColor : getOpponentColor(playerColor)
}

/**
 * 根据当前行棋颜色获取对应侧角色。
 *
 * @param {Object} params
 * @param {'w' | 'b'} params.turnColor
 * @param {'w' | 'b'} params.playerColor
 * @param {string} params.mySideRole
 * @param {string} params.opponentSideRole
 * @returns {string}
 */
export function getRoleForTurn({
  turnColor,
  playerColor,
  mySideRole,
  opponentSideRole,
}) {
  return turnColor === playerColor ? mySideRole : opponentSideRole
}

/**
 * 获取当前回合对应的电脑配置。
 *
 * @param {Object} params
 * @param {'w' | 'b'} params.turnColor
 * @param {'w' | 'b'} params.playerColor
 * @param {string} params.mySideRole
 * @param {string} params.opponentSideRole
 * @param {string} params.myComputerDifficultyKey
 * @param {string} params.opponentComputerDifficultyKey
 * @returns {{computerColor: 'w'|'b', difficultyKey: string} | null}
 */
export function getComputerTurnConfig({
  turnColor,
  playerColor,
  mySideRole,
  opponentSideRole,
  myComputerDifficultyKey,
  opponentComputerDifficultyKey,
}) {
  if (turnColor === playerColor) {
    return mySideRole === 'computer'
      ? { computerColor: turnColor, difficultyKey: myComputerDifficultyKey }
      : null
  }

  return opponentSideRole === 'computer'
    ? { computerColor: turnColor, difficultyKey: opponentComputerDifficultyKey }
    : null
}

/**
 * 是否允许当前回合进行手动走子。
 *
 * @param {Object} params
 * @param {'w' | 'b'} params.turnColor
 * @param {'w' | 'b'} params.playerColor
 * @param {string} params.mySideRole
 * @param {string} params.opponentSideRole
 * @returns {boolean}
 */
export function canManualMove(params) {
  return getRoleForTurn(params) === 'player'
}

