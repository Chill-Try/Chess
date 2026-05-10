/**
 * @file ai/boardUtils.js
 * @description 棋盘底层分析工具
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 提供棋盘层面的基础查询和分析功能：
 * - 坐标系转换（格子 <-> 坐标）
 * - 棋子价值查询
 * - 攻击者/防守者信息
 * - 威胁识别
 * - 直线压力计算
 * - 牵制检测
 *
 * ============================================================================
 * 与其他模块的关系
 * ============================================================================
 *
 * 该模块被多个 AI 模块依赖：
 * - evaluation.js: 使用攻击者信息和威胁识别
 * - moveScoring.js: 使用攻击/防守信息评估走法
 * - moveScoringShared.js: 使用棋子位置查询
 *
 * ============================================================================
 * 坐标系说明
 * ============================================================================
 *
 * 棋盘表示：
 * - 格子表示：如 'e4'，a-h 为文件（列），1-8 为行（等级）
 * - 坐标表示：[file, rank]，file 0-7 对应 a-h，rank 0-7 对应 1-8
 * - 数组索引：[rowIndex, columnIndex]，rowIndex 0 对应第8行，7 对应第1行
 *
 * 示例：
 * - 'e4' -> file=4, rank=4 -> columnIndex=4, rowIndex=3 (8-4-1=3)
 */

// 导入 chess.js 库用于创建棋局实例
import { Chess } from 'chess.js'

// 导入配置常量
import { LINE_DIRECTIONS, LOWER_VALUE_MARGIN, PIECE_VALUES } from './config'

// ==================== 开局阶段判断 ====================

/**
 * 获取开局阶段走法计数
 *
 * @param {Chess} game - 棋局实例
 * @returns {number} 从开局以来的半回合计数（即 fullmove number）
 *
 * FEN 第6字段是 halfmove clock，但我们使用第5字段 fullmove number
 * fullmove number 表示当前是第几回合
 *
 * 注意：这不是精确的开局阶段判断，仅作为参考
 */
export function getOpeningPhaseMoveCount(game) {
  return Number.parseInt(game.fen().split(' ')[5], 10)
}

// ==================== 子力统计 ====================

/**
 * 计算棋盘上非兵子力的总价值
 *
 * @param {Chess} game.board()} board - 棋盘二维数组
 * @returns {number} 非兵子力的总价值
 *
 * 用途：
 * - 判断游戏阶段（残局 vs 中局）
 * - 评估子力协调
 *
 * 注意：不包括王，因为王通常不参与子力计算
 */
export function getNonPawnMaterial(board) {
  let total = 0

  for (const row of board) {
    for (const piece of row) {
      // 跳过空格子、兵和国王
      if (!piece || piece.type === 'p' || piece.type === 'k') {
        continue
      }

      total += PIECE_VALUES[piece.type]
    }
  }

  return total
}

/**
 * 计算棋盘上非国王子力的总价值
 *
 * @param {Chess} game.board()} board - 棋盘二维数组
 * @returns {number} 非国王子力的总价值
 *
 * 用途：
 * - 用于搜索深度调整
 * - 判断游戏阶段
 *
 * 与 getNonPawnMaterial 的区别：
 * - 该函数包含马、象、车、后
 * - getNonPawnMaterial 包含所有非兵子力但排除国王
 */
export function getNonKingMaterial(board) {
  let total = 0

  for (const row of board) {
    for (const piece of row) {
      // 跳过空格子和国王（兵在子力评估中单独处理）
      if (!piece || piece.type === 'k') {
        continue
      }

      total += PIECE_VALUES[piece.type]
    }
  }

  return total
}

// ==================== 坐标系转换 ====================

/**
 * 将格子符号转换为数组坐标
 *
 * @param {string} square - 格子符号，如 'e4'
 * @returns {[number, number]} [file, rank]，file 0-7，rank 0-7
 *
 * @example
 * squareToCoords('e4')  // => [4, 3]（e是第5个字母，所以file=4；4是第4行，所以rank=3）
 *
 * 注意：返回的 rank 是 0-indexed，0 代表第1行
 */
export function squareToCoords(square) {
  return [square.charCodeAt(0) - 97, Number.parseInt(square[1], 10) - 1]
}

/**
 * 将数组坐标转换为格子符号
 *
 * @param {number} file - 文件 (0-7，对应 a-h)
 * @param {number} rank - 行 (0-7，对应 1-8)
 * @returns {string|null} 格子符号，超出范围返回 null
 *
 * @example
 * coordsToSquare(4, 3)  // => 'e4'
 * coordsToSquare(-1, 0) // => null（超出范围）
 */
export function coordsToSquare(file, rank) {
  // 边界检查
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null
  }

  // file 0 -> 'a', file 4 -> 'e'
  // rank 0 -> '1', rank 3 -> '4'
  return `${String.fromCharCode(97 + file)}${rank + 1}`
}

// ==================== 棋子价值 ====================

/**
 * 获取棋子的评估价值
 *
 * @param {Object} piece - 棋子对象 {type: 'n', color: 'w'}
 * @returns {number} 棋子价值
 *
 * 注意：
 * - 国王价值 2000（远高于其他棋子，用于确保搜索中不会主动丢王）
 * - 其他棋子使用 PIECE_VALUES 表中的标准价值
 */
export function getPieceValue(piece) {
  return piece.type === 'k' ? 2000 : PIECE_VALUES[piece.type]
}

// ==================== 攻击者分析 ====================

/**
 * 获取攻击某格子的所有攻击者信息
 *
 * @param {Chess} game - 棋局实例
 * @param {string} square - 目标格子
 * @param {string} color - 攻击方颜色
 * @returns {Object[]} 攻击者信息数组，按价值升序排列
 *
 * 返回数组元素格式：
 * {
 *   square: 'd4',      // 攻击者所在格子
 *   piece: {type: 'n', color: 'w'}, // 攻击者棋子
 *   value: 320         // 攻击者价值
 * }
 *
 * 注意：结果按价值排序，最弱的攻击者排在前面
 */
export function getAttackersInfo(game, square, color) {
  return game
    .attackers(square, color) // chess.js 内置方法，获取攻击者格子列表
    .map((attackerSquare) => {
      const piece = game.get(attackerSquare)

      if (!piece) {
        return null
      }

      return {
        square: attackerSquare,
        piece,
        value: piece.type === 'k' ? 2000 : PIECE_VALUES[piece.type],
      }
    })
    .filter(Boolean) // 移除 null 项
    .sort((left, right) => left.value - right.value) // 按价值升序
}

/**
 * 获取某方棋子能够攻击的敌方棋子列表
 *
 * @param {Chess} game - 棋局实例
 * @param {string} square - 攻击方棋子所在格子
 * @param {string} color - 攻击方颜色
 * @returns {Object[]} 被攻击的敌方棋子信息
 *
 * 与 getAttackersInfo 的区别：
 * - getAttackersInfo：谁在攻击 target square
 * - getPiecesAttackedBy：从 fromSquare 出发能攻击到哪些敌方棋子
 */
export function getPiecesAttackedBy(game, square, color) {
  return getAttackersInfo(game, square, color).map(({ square: attackerSquare, piece, value }) => ({
    attackerSquare,
    piece,
    value,
  }))
}

/**
 * 获取攻击某格子的最弱攻击者
 *
 * @param {Chess} game - 棋局实例
 * @param {string} square - 目标格子
 * @param {string} color - 攻击方颜色
 * @returns {Object|null} 最弱攻击者信息 或 null（无攻击者）
 *
 * 返回格式：
 * { square: 'd3', value: 320, piece: {type: 'n', color: 'w'} }
 *
 * 用途：
 * - 判断交换是否合算
 * - 评估某格子是否安全
 */
export function getLeastValuableAttacker(game, square, color) {
  const attackers = game.attackers(square, color)

  if (attackers.length === 0) {
    return null
  }

  // 遍历所有攻击者，找价值最小的
  return attackers.reduce((best, attackerSquare) => {
    const attacker = game.get(attackerSquare)

    if (!attacker) {
      return best
    }

    const attackerValue = attacker.type === 'k' ? 2000 : PIECE_VALUES[attacker.type]

    // 更新最小值
    if (!best || attackerValue < best.value) {
      return { square: attackerSquare, value: attackerValue, piece: attacker }
    }

    return best
  }, null)
}

// ==================== 敌方棋子攻击查询 ====================

/**
 * 获取指定棋子能够攻击的所有敌方棋子
 *
 * @param {Chess} game - 棋局实例
 * @param {string} attackerColor - 攻击方颜色
 * @param {string} fromSquare - 攻击方棋子所在格子
 * @returns {Object[]} 被攻击的敌方棋子列表
 *
 * 用途：
 * - 评估某步棋是否具有战术威胁
 * - 检测双重攻击等机会
 *
 * 算法：
 * 遍历棋盘上所有敌方非国王棋子，检查它们是否被 fromSquare 的棋子攻击
 */
export function getAttackedEnemyPieces(game, attackerColor, fromSquare) {
  const attackedPieces = []
  const board = game.board()

  // 遍历棋盘上所有格子
  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      // 跳过空格子或己方棋子
      if (!piece || piece.color === attackerColor) {
        continue
      }

      // 转换为标准格子符号（如 e4）
      const targetSquare = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`

      // 获取攻击该格子的所有攻击者
      const attackers = getPiecesAttackedBy(game, targetSquare, attackerColor)

      // 检查 fromSquare 是否在攻击者列表中
      if (attackers.some((attacker) => attacker.attackerSquare === fromSquare)) {
        attackedPieces.push({ square: targetSquare, piece, value: getPieceValue(piece) })
      }
    }
  }

  return attackedPieces
}

// ==================== 直线压力分析 ====================

/**
 * 获取直线棋子（如车、象、后）的压力目标
 *
 * "压力"指穿透敌方防线攻击后方目标的能力
 *
 * @param {Chess} game - 棋局实例
 * @param {string} attackerSquare - 攻击方棋子所在格子
 * @param {string} attackerColor - 攻击方颜色
 * @returns {Object[]} 压力目标列表
 *
 * 返回格式：
 * [{
 *   front: { square: 'd4', piece: {...}, value: 500 },   // 第一阻挡/攻击的棋子
 *   back: { square: 'd7', piece: {...}, value: 100 }    // 后方的棋子（如果有）
 * }]
 *
 * 示例：
 * 车在 d1，d2-d7 有兵，后方有车在后1
 * 返回：{ front: d2兵, back: d1车 }（车攻击穿透到后方车）
 */
export function getLinePressureTargets(game, attackerSquare, attackerColor) {
  const attacker = game.get(attackerSquare)

  // 只处理斜线棋子（象、车、后）
  if (!attacker || !['b', 'r', 'q'].includes(attacker.type)) {
    return []
  }

  const [file, rank] = squareToCoords(attackerSquare)

  // 根据棋子类型确定有效方向
  const validDirections = LINE_DIRECTIONS.filter(([df, dr]) => {
    if (attacker.type === 'b') return Math.abs(df) === Math.abs(dr) // 象只能斜线
    if (attacker.type === 'r') return df === 0 || dr === 0 // 车只能直线
    return true // 后可以是任意方向
  })

  const targets = []

  // 沿每个有效方向追踪
  for (const [df, dr] of validDirections) {
    let currentFile = file + df
    let currentRank = rank + dr
    let firstTarget = null // 第一个遇到的敌方棋子

    while (currentFile >= 0 && currentFile < 8 && currentRank >= 0 && currentRank < 8) {
      const currentSquare = coordsToSquare(currentFile, currentRank)
      const piece = game.get(currentSquare)

      if (piece) {
        if (piece.color === attackerColor) {
          // 遇到己方棋子，阻挡，不能继续
          break
        }

        // 遇到敌方棋子
        if (!firstTarget) {
          // 第一个敌方棋子，可能被攻击
          firstTarget = { square: currentSquare, piece, value: getPieceValue(piece) }
        } else {
          // 第二个敌方棋子，穿透攻击
          targets.push({
            front: firstTarget,
            back: { square: currentSquare, piece, value: getPieceValue(piece) },
          })
          break
        }
      }

      // 继续沿该方向移动
      currentFile += df
      currentRank += dr
    }
  }

  return targets
}

// ==================== 棋子移动方向兼容性 ====================

/**
 * 判断某种棋子是否能沿指定方向移动
 *
 * @param {string} pieceType - 棋子类型 ('b', 'r', 'q')
 * @param {number} fileDelta - 文件变化量
 * @param {number} rankDelta - 行变化量
 * @returns {boolean} 是否兼容
 *
 * 用于检测牵制等战术
 */
export function isSliderCompatibleWithDirection(pieceType, fileDelta, rankDelta) {
  const diagonal = Math.abs(fileDelta) === Math.abs(rankDelta)
  const straight = fileDelta === 0 || rankDelta === 0

  if (pieceType === 'q') return diagonal || straight // 后可以任意
  if (pieceType === 'b') return diagonal // 象只能斜线
  if (pieceType === 'r') return straight // 车只能直线
  return false
}

// ==================== 牵制相关 ====================

/**
 * 获取防守方基础权重
 *
 * 某些棋子作为防守者时更有效：
 * - 后：0.45（价值高但暴露风险大）
 * - 车：0.8（优秀的防守棋子）
 * - 其他：1.0（标准权重）
 *
 * @param {string} pieceType - 棋子类型
 * @returns {number} 权重系数
 */
export function getDefenderBaseWeight(pieceType) {
  if (pieceType === 'k') return 0.05 // 王作为防守者极不稳定
  if (pieceType === 'q') return 0.45
  if (pieceType === 'r') return 0.8
  return 1
}

/**
 * 计算牵制惩罚
 *
 * 当防守方棋子在某方向上被牵制时，其防守效果降低
 *
 * @param {Chess} game - 棋局实例
 * @param {string} defenderSquare - 防守方棋子位置
 * @param {string} defenderColor - 防守方颜色
 * @returns {number} 惩罚值 0-1
 *
 * 惩罚逻辑：
 * - 如果防守方棋子是国王且被牵制：返回 1（完全无法移动）
 * - 如果防守方棋子是后且被牵制：返回 0.7
 * - 如果防守方棋子是车且被牵制：返回 0.6
 * - 其他棋子：返回 0.35
 */
export function getPinnedDefenderPenalty(game, defenderSquare, defenderColor) {
  const [file, rank] = squareToCoords(defenderSquare)

  // 检查 8 个方向
  for (const [fileDelta, rankDelta] of LINE_DIRECTIONS) {
    let ownTarget = null // 己方目标（国王）
    let currentFile = file + fileDelta
    let currentRank = rank + rankDelta

    // 沿该方向寻找己方目标
    while (currentFile >= 0 && currentFile < 8 && currentRank >= 0 && currentRank < 8) {
      const square = coordsToSquare(currentFile, currentRank)
      const piece = game.get(square)

      if (piece) {
        ownTarget = { square, piece }
        break
      }

      currentFile += fileDelta
      currentRank += rankDelta
    }

    // 如果方向上无己方目标或目标不是己方棋子，继续检查下一个方向
    if (!ownTarget || ownTarget.piece.color !== defenderColor) {
      continue
    }

    // 检查该方向上是否有敌方直线棋子牵制
    currentFile = file - fileDelta
    currentRank = rank - rankDelta

    while (currentFile >= 0 && currentFile < 8 && currentRank >= 0 && currentRank < 8) {
      const square = coordsToSquare(currentFile, currentRank)
      const piece = game.get(square)

      if (piece) {
        // 如果是敌方棋子且能与防守方棋子同线
        if (piece.color !== defenderColor && isSliderCompatibleWithDirection(piece.type, fileDelta, rankDelta)) {
          // 根据防守方棋子类型返回惩罚
          if (ownTarget.piece.type === 'k') return 1
          if (ownTarget.piece.type === 'q') return 0.7
          if (ownTarget.piece.type === 'r') return 0.6
          return 0.35
        }

        break
      }

      currentFile -= fileDelta
      currentRank -= rankDelta
    }
  }

  return 0
}

// ==================== 有效支援计算 ====================

/**
 * 获取某格子的有效支援信息
 *
 * 考虑牵制因素的防守者评估
 *
 * @param {Chess} game - 棋局实例
 * @param {string} square - 目标格子
 * @param {string} color - 防守方颜色
 * @returns {Object[]} 防守者信息数组，包含有效性系数
 */
export function getEffectiveSupportInfo(game, square, color) {
  return getAttackersInfo(game, square, color).map((attacker) => {
    // 计算牵制惩罚
    const pinnedPenalty = getPinnedDefenderPenalty(game, attacker.square, color)

    return {
      ...attacker,
      // 有效性 = 基础权重 * (1 - 牵制惩罚)
      effectiveness: Math.max(0, getDefenderBaseWeight(attacker.piece.type) * (1 - pinnedPenalty)),
    }
  })
}

/**
 * 获取某格子有效支援的总量
 *
 * @param {Chess} game - 棋局实例
 * @param {string} square - 目标格子
 * @param {string} color - 防守方颜色
 * @returns {number} 有效支援总量
 */
export function getEffectiveSupportTotal(game, square, color) {
  return getEffectiveSupportInfo(game, square, color).reduce((total, attacker) => total + attacker.effectiveness, 0)
}

// ==================== 威胁判断 ====================

/**
 * 判断攻击方价值是否"明显低于"被攻击方
 *
 * 用于识别战术机会（如兵吃马）
 *
 * @param {number} attackerValue - 攻击方棋子价值
 * @param {number} pieceValue - 被攻击方棋子价值
 * @returns {boolean} 是否明显低价值
 */
export function isClearlyLowerValue(attackerValue, pieceValue) {
  return attackerValue <= pieceValue - LOWER_VALUE_MARGIN
}

/**
 * 获取被威胁的棋子列表
 *
 * 只考虑非兵非王的棋子，因为兵的威胁通常已经包含在合法走法中
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 被威胁方颜色
 * @returns {Object[]} 被威胁棋子列表
 */
export function getThreatenedPieces(game, color) {
  const threatenedPieces = []
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      // 只考虑己方非兵非王棋子
      if (!piece || piece.color !== color || piece.type === 'p' || piece.type === 'k') {
        continue
      }

      const square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      const enemyColor = color === 'w' ? 'b' : 'w'
      const attackers = game.attackers(square, enemyColor)

      // 没有攻击者则不威胁
      if (attackers.length === 0) {
        continue
      }

      const leastAttacker = getLeastValuableAttacker(game, square, enemyColor)

      if (!leastAttacker) {
        continue
      }

      const pieceValue = PIECE_VALUES[piece.type]

      // 判断是否为明显低价值攻击
      if (isClearlyLowerValue(leastAttacker.value, pieceValue)) {
        threatenedPieces.push({ square, piece, pieceValue, leastAttacker })
      }
    }
  }

  return threatenedPieces
}

// ==================== 历史走法查询 ====================

/**
 * 获取某方最近的一次走法
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 棋子颜色
 * @returns {Object|null} 最近走法或 null
 */
export function getLastMoveByColor(game, color) {
  const history = game.history({ verbose: true })

  // 从后往前找
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].color === color) {
      return history[index]
    }
  }

  return null
}

/**
 * 获取某方最近的几次走法
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 棋子颜色
 * @param {number} count - 获取数量
 * @returns {Object[]} 最近走法列表
 */
export function getRecentMovesByColor(game, color, count = 2) {
  const history = game.history({ verbose: true })
  const recentMoves = []

  // 从后往前收集
  for (let index = history.length - 1; index >= 0 && recentMoves.length < count; index -= 1) {
    if (history[index].color === color) {
      recentMoves.push(history[index])
    }
  }

  return recentMoves
}

// ==================== 棋子位置查找 ====================

/**
 * 查找特定棋子的位置
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 棋子颜色
 * @param {string} pieceType - 棋子类型
 * @returns {string|null} 棋子所在格子或 null
 */
export function findPieceSquare(game, color, pieceType) {
  const board = game.board()

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex]

      if (piece?.type === pieceType && piece.color === color) {
        return `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`
      }
    }
  }

  return null
}

// ==================== 工具函数 ====================

/**
 * 从 FEN 创建新的棋局实例
 *
 * @param {string} fen - FEN 字符串
 * @returns {Chess} 新的 Chess 实例
 */
export function cloneGameFromFen(fen) {
  return new Chess(fen)
}