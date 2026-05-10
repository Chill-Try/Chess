/**
 * @file lib/gameStatus.js
 * @description 游戏状态文案与历史整理
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 提供游戏状态相关的文案和历史记录整理：
 *
 * 1. 颜色标签 - getColorLabel
 *    - 'w' -> '白方'
 *    - 'b' -> '黑方'
 *
 * 2. 状态文案 - getStatusText
 *    - 根据游戏状态生成显示给用户的文本
 *    - 将死、将棋、逼和、三三重复等
 *
 * 3. 和棋提示 - getDrawNotice
 *    - 具体说明和棋原因
 *
 * 4. 走棋历史分组 - groupMovesByTurn
 *    - 将扁平的历史转为回合制格式
 *
 * 这些函数被 App.jsx 使用，生成 UI 显示所需的数据
 */

/**
 * 获取颜色标签
 *
 * @param {string} color - 颜色 ('w' 或 'b')
 * @returns {string} 中文标签
 */
export function getColorLabel(color) {
  return color === 'w' ? '白方' : '黑方'
}

/**
 * 获取游戏状态文本
 *
 * 根据游戏状态生成完整的提示文案
 *
 * @param {Chess} game - 棋局实例
 * @param {Object} perspective - 视角与角色配置
 * @param {string} perspective.playerColor - 我方执棋颜色
 * @param {string} perspective.mySideRole - 我方角色
 * @param {string} perspective.opponentSideRole - 敌方角色
 * @returns {string} 状态提示文本
 *
 * 状态文案优先级：
 * 1. 将死 -> "将死，X方获胜。"
 * 2. 逼和 -> "逼和，和棋。"
 * 3. 三三重复 -> "三次重复局面，和棋。"
 * 4. 子力不足 -> "子力不足，和棋。"
 * 5. 其他和棋 -> "和棋。"
 * 6. 正常局面 -> "轮到X行棋。/ 轮到你走，你执X。/ 电脑正在执X行棋。"
 */
export function getStatusText(game, { playerColor, mySideRole, opponentSideRole }) {
  // ========== 将死 ==========
  if (game.isCheckmate()) {
    // 将死时，turn() 返回的是输家（下一步该走但无子可动）
    const winner = game.turn() === 'w' ? '黑方' : '白方'
    return `将死，${winner}获胜。`
  }

  // ========== 逼和 ==========
  if (game.isStalemate()) {
    return '逼和，和棋。'
  }

  // ========== 三三重复 ==========
  if (game.isThreefoldRepetition()) {
    return '三次重复局面，和棋。'
  }

  // ========== 子力不足 ==========
  if (game.isInsufficientMaterial()) {
    return '子力不足，和棋。'
  }

  // ========== 其他和棋 ==========
  if (game.isDraw()) {
    return '和棋。'
  }

  // ========== 正常局面 ==========

  const turnText = getColorLabel(game.turn())
  const suffix = game.isCheck() ? ' 当前被将军。' : ''

  const currentRole = game.turn() === playerColor ? mySideRole : opponentSideRole

  // 双玩家模式
  if (mySideRole === 'player' && opponentSideRole === 'player') {
    return `轮到${turnText}行棋。${suffix}`
  }

  if (currentRole === 'player') {
    const youAre = getColorLabel(game.turn())
    return `轮到你走，你执${youAre}。${suffix}`
  }

  if (currentRole === 'computer') {
    return `电脑正在执${turnText}行棋。${suffix}`
  }

  return `AI 模型正在执${turnText}行棋。${suffix}`
}

/**
 * 获取和棋提示文案
 *
 * 具体说明和棋的原因
 *
 * @param {Chess} game - 棋局实例
 * @returns {string|null} 和棋原因文案，null 表示不是和棋
 */
export function getDrawNotice(game) {
  // 三三重复
  if (game.isThreefoldRepetition()) {
    return '检测到同一局面已重复出现 3 次，本局按国际象棋规则判和。'
  }

  // 逼和
  if (game.isStalemate()) {
    return '当前无合法着法且未被将军，本局判为逼和。'
  }

  // 子力不足
  if (game.isInsufficientMaterial()) {
    return '双方剩余子力不足以形成将死，本局判和。'
  }

  return null
}

/**
 * 将走棋历史按回合分组
 *
 * @param {string[]} moveHistory - 扁平的历史数组 ['e4', 'e5', 'Nf3', ...]
 * @returns {Object[]} 按回合分组的数组
 *
 * @example
 * // 输入
 * ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']
 * // 输出
 * [
 *   { moveNumber: 1, white: 'e4', black: 'e5' },
 *   { moveNumber: 2, white: 'Nf3', black: 'Nc6' },
 *   { moveNumber: 3, white: 'Bb5', black: '' }
 * ]
 *
 * 用途：
 * - 方便渲染走棋历史表格
 * - 每行显示一个回合的双方走法
 */
export function groupMovesByTurn(moveHistory) {
  const turns = []

  // 每两个走法为一回合
  for (let index = 0; index < moveHistory.length; index += 2) {
    turns.push({
      moveNumber: Math.floor(index / 2) + 1, // 回合从1开始
      white: moveHistory[index] ?? '', // 白方走法
      black: moveHistory[index + 1] ?? '', // 黑方走法（可能为空）
    })
  }

  return turns
}
