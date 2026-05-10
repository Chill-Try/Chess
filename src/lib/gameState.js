/**
 * @file lib/gameState.js
 * @description 棋局状态辅助函数
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 提供与棋局状态相关的底层辅助功能：
 *
 * 1. getKingSquare - 查找国王位置
 * 2. getCheckingSquares - 查找攻击国王的棋子
 * 3. cloneGameWithHistory - 克隆棋局（保留历史）
 * 4. applyMoveToGame - 在副本上应用走法
 * 5. getExposedKingSquaresAfterVisualMove - 模拟非法拖拽后的王暴露检测
 * 6. canInteractWithSquare - 判断当前回合是否允许操作该格棋子
 *
 * 这些函数被 App.jsx 和其他模块使用，提供 chess.js 库之外的状态操作
 */

import { Chess } from 'chess.js'

/**
 * 查找指定颜色国王的位置
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 棋子颜色 ('w' 或 'b')
 * @returns {string|null} 国王所在格子，如 'e1'，或 null（找不到）
 *
 * 算法：
 * - 遍历棋盘
 * - 找到 type === 'k' 且颜色匹配的格子
 */
export function getKingSquare(game, color) {
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (piece?.type === 'k' && piece.color === color) {
        // 转换为标准格子符号
        return `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      }
    }
  }

  return null
}

/**
 * 获取攻击指定方国王的所有棋子位置
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 被攻击方颜色
 * @returns {string[]} 攻击者所在格子列表
 *
 * 用途：
 * - 用于显示将军闪烁效果
 * - getKingSquare + getCheckingSquares 组合确定哪些格子需要闪烁
 */
export function getCheckingSquares(game, color) {
  // 先找到国王位置
  const kingSquare = getKingSquare(game, color)

  if (!kingSquare) {
    return []
  }

  // 使用 chess.js 内置的 attackers 方法
  // 找出攻击国王的所有敌方棋子
  return game.attackers(kingSquare, color === 'w' ? 'b' : 'w')
}

/**
 * 克隆棋局并保留历史走法
 *
 * @param {Chess} game - 原棋局实例
 * @returns {Chess} 新的棋局实例，包含相同的历史
 *
 * 用途：
 * - 在验证走法前克隆，以免影响原棋局
 * - chess.js 的 move() 会修改棋局，需要副本
 *
 * 注意：
 * - 使用 FEN 重新创建，而不是简单的浅拷贝
 * - 这样可以保留完整的历史记录
 */
export function cloneGameWithHistory(game) {
  const nextGame = new Chess()

  try {
    // 逐个应用历史走法
    for (const move of game.history()) {
      nextGame.move(move)
    }
  } catch {
    // 作弊等直接改盘后，后续 SAN 历史可能已无法从标准历史回放。
    return new Chess(game.fen())
  }

  if (nextGame.fen() !== game.fen()) {
    // 作弊等直接改盘操作不会写入标准历史，此时必须以当前真实盘面为准。
    return new Chess(game.fen())
  }

  return nextGame
}

/**
 * 在棋局副本上应用走法
 *
 * @param {Chess} currentGame - 当前棋局
 * @param {Object} move - 走法对象 {from, to, promotion}
 * @param {string} expectedTurn - 期望的走子方
 * @returns {Chess} 更新后的棋局（如果成功）或原棋局（如果失败）
 *
 * 验证逻辑：
 * 1. 检查走法有效性（非空、游戏未结束、回合匹配）
 * 2. 克隆棋局
 * 3. 尝试应用走法
 * 4. 成功返回新棋局，失败返回原棋局
 *
 * 注意：
 * - 这是一个"安全"的更新函数
 * - 不会抛出异常，只会默默失败
 */
export function applyMoveToGame(currentGame, move, expectedTurn) {
  // 验证走法
  if (!move || currentGame.isGameOver() || currentGame.turn() !== expectedTurn) {
    return currentGame
  }

  // 克隆棋局
  const nextGame = cloneGameWithHistory(currentGame)

  try {
    // 尝试应用走法
    nextGame.move(move)
    return nextGame
  } catch {
    // 走法不合法，返回原棋局
    return currentGame
  }
}

/**
 * 在不校验走法合法性的前提下，模拟一次棋子位移，并检查是否暴露己方国王。
 *
 * 用途：
 * - 用户把棋子拖到一个不在合法落点列表里的格子时
 * - 仍然需要按“视觉上如果真放到这里”来判断己方国王会不会被攻击
 *
 * @param {Chess} game - 当前棋局
 * @param {Object} move - 拖拽走法 {from, to}
 * @returns {string[]} 若己方国王会暴露，则返回 [kingSquare, ...attackers]；否则返回空数组
 */
export function getExposedKingSquaresAfterVisualMove(game, move) {
  if (!move?.from || !move?.to || move.from === move.to) {
    return []
  }

  const movingPiece = game.get(move.from)

  if (!movingPiece) {
    return []
  }

  const simulatedGame = new Chess(game.fen())

  simulatedGame.remove(move.from)
  simulatedGame.remove(move.to)

  const placed = simulatedGame.put(movingPiece, move.to)

  if (!placed) {
    return []
  }

  const kingSquare = getKingSquare(simulatedGame, movingPiece.color)

  if (!kingSquare) {
    return []
  }

  const opponentColor = movingPiece.color === 'w' ? 'b' : 'w'
  const attackers = simulatedGame.attackers(kingSquare, opponentColor)

  return attackers.length > 0 ? [kingSquare, ...attackers] : []
}

/**
 * 判断指定格子的棋子是否属于当前行棋方，因此允许被拖拽和落子。
 *
 * @param {Chess} game - 当前棋局
 * @param {string} square - 棋盘格子
 * @returns {boolean} true 表示该格有子且属于当前行棋方
 */
export function canInteractWithSquare(game, square) {
  if (!square) {
    return false
  }

  const piece = game.get(square)
  return Boolean(piece) && piece.color === game.turn()
}

function transformPiecesForCurrentTurn(game, shouldTransformPiece, nextPieceType) {
  if (game.isGameOver()) {
    return game
  }

  const nextGame = new Chess(game.fen())
  const currentTurnColor = nextGame.turn()
  const board = nextGame.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (!piece || piece.color !== currentTurnColor || !shouldTransformPiece(piece)) {
        continue
      }

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      nextGame.remove(square)
      nextGame.put({ type: nextPieceType, color: piece.color }, square)
    }
  }

  return nextGame
}

export function transformCurrentTurnPawnsToKnights(game) {
  return transformPiecesForCurrentTurn(
    game,
    (piece) => piece.type === 'p' || piece.type === 'q',
    'n'
  )
}

export function transformCurrentTurnNonKingPiecesToQueens(game) {
  const currentTurnColor = game.turn()
  const currentTurnPieces = game
    .board()
    .flat()
    .filter((piece) => piece && piece.color === currentTurnColor)

  const hasNonKingNonPawnPiece = currentTurnPieces.some(
    (piece) => piece.type !== 'k' && piece.type !== 'p'
  )

  return transformPiecesForCurrentTurn(
    game,
    (piece) => {
      if (piece.type === 'k') {
        return false
      }

      if (hasNonKingNonPawnPiece) {
        return piece.type !== 'p'
      }

      return piece.type === 'p'
    },
    'q'
  )
}
