/**
 * @file ai/trapBook.js
 * @description 中局陷阱库
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 提供常见中局陷阱的识别和执行：
 *
 * 1. 陷阱识别
 *    - 检测当前局面是否匹配陷阱特征
 *    - 识别敌人可能的失误
 *
 * 2. 陷阱执行
 *    - 返回可执行的陷阱走法
 *    - 计算反击走法
 *
 * 3. 陷阱类型覆盖
 *    - 闷杀 (Smothered Mate)
 *    - 双重攻击 (Double Attack)
 *    - 闪击 (Fork)
 *    - 抽将 (Skewer)
 *    - 牵制 (Pin)
 *    - 引入 (Decoy)
 *    - 消除保护 (Removal)
 *    - 双重威胁 (Discovered Attack)
 *
 * ============================================================================
 * 陷阱触发机制
 * ============================================================================
 *
 * 每步 AI 走子前检查：
 * 1. 遍历所有陷阱模式
 * 2. 检查当前局面是否匹配陷阱特征
 * 3. 如果匹配，以高概率选择陷阱走法
 * 4. 返回陷阱走法或 null
 *
 * ============================================================================
 * 陷阱优先级
 * ============================================================================
 *
 * 某些陷阱比其他陷阱更重要：
 * - 将军类陷阱优先
 * - 吃子陷阱次之
 * - 威胁类陷阱最后
 */

// 导入需要的工具函数
import { PIECE_VALUES } from './config'
import { findPieceSquare, getAttackersInfo, getLeastValuableAttacker } from './boardUtils'

// ==================== 陷阱类型 ====================

/**
 * 陷阱类型枚举
 */
export const TrapType = {
  SMOTHERED_MATE: 'smothered_mate',       // 闷杀
  DOUBLE_ATTACK: 'double_attack',         // 双重攻击
  FORK: 'fork',                           // 闪击
  SKEWER: 'skewer',                      // 抽将
  PIN: 'pin',                            // 牵制
  DECOY: 'decoy',                        // 引入
  REMOVAL: 'removal',                    // 消除保护
  DISCOVERED_ATTACK: 'discovered_attack', // 闪击/发现攻击
}

// ==================== 陷阱库 ====================

/**
 * 常见中局陷阱模式
 *
 * 每个陷阱包含：
 * - id: 唯一标识
 * - name: 中文名称
 * - description: 描述
 * - findTrap: 检测函数，返回可执行的陷阱走法
 */
export const TRAP_BOOK = [
  // ===== 闷杀 (Smothered Mate) =====
  // 车配合马将死被兵保护的王
  {
    id: 'smothered_mate_rook_knight',
    name: '闷杀（车马配合）',
    type: TrapType.SMOTHERED_MATE,
    findTrap(game, color) {
      const enemyColor = color === 'w' ? 'b' : 'w'
      const moves = game.moves({ verbose: true })

      for (const move of moves) {
        // 检查走法是否将军
        if (!move.san.includes('+')) continue

        // 应用走法
        game.move(move)

        // 检查敌方国王是否被闷杀（无合法应招）
        const enemyMoves = game.moves({ verbose: true })
        const allCheck = enemyMoves.every((m) => m.san.includes('+'))

        game.undo()

        if (allCheck && enemyMoves.length === 0) {
          return {
            move,
            trapType: TrapType.SMOTHERED_MATE,
            name: this.name,
            priority: 100, // 最高优先级
          }
        }
      }

      return null
    },
  },

  // ===== 双重攻击 (Double Attack) =====
  // 同时攻击两个目标
  {
    id: 'double_attack_knight',
    name: '双重攻击（马）',
    type: TrapType.DOUBLE_ATTACK,
    findTrap(game, color) {
      const enemyColor = color === 'w' ? 'b' : 'w'
      const moves = game.moves({ verbose: true })

      // 寻找同时攻击两个敌方棋子的走法
      for (const move of moves) {
        if (move.captured) continue // 吃子不考虑

        game.move(move)

        // 检查是否攻击两个有价值目标
        let attackCount = 0
        const valuableTargets = []

        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const piece = game.board()[row][col]
            if (piece && piece.color === enemyColor && piece.type !== 'k') {
              const square = `${String.fromCharCode(97 + col)}${8 - row}`
              const attackers = game.attackers(square, color)

              if (attackers.some((a) => a === move.to)) {
                attackCount++
                valuableTargets.push({ square, piece })
              }
            }
          }
        }

        game.undo()

        // 如果能同时攻击两个有价值目标
        if (attackCount >= 2) {
          const totalValue = valuableTargets.reduce(
            (sum, t) => sum + PIECE_VALUES[t.piece.type],
            0
          )

          return {
            move,
            trapType: TrapType.DOUBLE_ATTACK,
            name: this.name,
            priority: 80,
            totalValue,
          }
        }
      }

      return null
    },
  },

  // ===== 闪击 (Fork) =====
  // 兵同时攻击两个目标
  {
    id: 'pawn_fork',
    name: '兵闪击',
    type: TrapType.FORK,
    findTrap(game, color) {
      const enemyColor = color === 'w' ? 'b' : 'w'
      const moves = game.moves({ verbose: true })

      for (const move of moves) {
        if (move.piece !== 'p') continue
        if (!move.captured) continue // 兵必须吃子

        game.move(move)

        // 获取该兵能攻击的格子
        const targets = []
        const file = move.to[0]
        const rank = parseInt(move.to[1], 10)
        const direction = color === 'w' ? 1 : -1

        // 兵攻击的斜前方两个格子
        const attackSquares = [
          `${String.fromCharCode(file.charCodeAt(0) - 1)}${rank + direction}`,
          `${String.fromCharCode(file.charCodeAt(0) + 1)}${rank + direction}`,
        ]

        for (const square of attackSquares) {
          const targetPiece = game.get(square)
          if (targetPiece && targetPiece.color === enemyColor && targetPiece.type !== 'p') {
            targets.push({ square, piece: targetPiece })
          }
        }

        game.undo()

        // 如果能吃一个并威胁另一个
        if (targets.length >= 1) {
          const totalValue = targets.reduce(
            (sum, t) => sum + PIECE_VALUES[t.piece.type],
            0
          )
          const capturedValue = PIECE_VALUES[move.captured]

          // 吃子合算且威胁更多
          if (totalValue + capturedValue > PIECE_VALUES.p * 1.5) {
            return {
              move,
              trapType: TrapType.FORK,
              name: this.name,
              priority: 70,
              targets,
            }
          }
        }
      }

      return null
    },
  },

  // ===== 抽将 (Skewer) =====
  // 强迫移动高价值棋子
  {
    id: 'skewer_rook',
    name: '抽将',
    type: TrapType.SKEWER,
    findTrap(game, color) {
      const enemyColor = color === 'w' ? 'b' : 'w'
      const moves = game.moves({ verbose: true })

      for (const move of moves) {
        // 只考虑车和后的走法
        if (!['r', 'q'].includes(move.piece)) continue

        game.move(move)

        // 检查是否攻击国王
        const enemyKingSquare = findPieceSquare(game, enemyColor, 'k')
        if (!enemyKingSquare) {
          game.undo()
          continue
        }

        const kingAttackers = game.attackers(enemyKingSquare, color)
        if (!kingAttackers.includes(move.to)) {
          game.undo()
          continue
        }

        // 找到国王后方的高价值棋子
        let highValueTarget = null
        const kingCol = enemyKingSquare.charCodeAt(0) - 97
        const kingRow = 8 - parseInt(enemyKingSquare[1], 10)
        const fromCol = move.from.charCodeAt(0) - 97
        const fromRow = 8 - parseInt(move.from[1], 10)

        const dCol = Math.sign(kingCol - fromCol)
        const dRow = Math.sign(kingRow - fromRow)

        let checkCol = kingCol + dCol
        let checkRow = kingRow + dRow

        while (checkCol >= 0 && checkCol < 8 && checkRow >= 0 && checkRow < 8) {
          const piece = game.board()[7 - checkRow][checkCol]
          if (piece) {
            if (piece.color === enemyColor && ['q', 'r', 'b'].includes(piece.type)) {
              highValueTarget = {
                square: `${String.fromCharCode(97 + checkCol)}${8 - checkRow}`,
                piece,
              }
            }
            break
          }
          checkCol += dCol
          checkRow += dRow
        }

        game.undo()

        if (highValueTarget && highValueTarget.piece.type !== 'k') {
          return {
            move,
            trapType: TrapType.SKEWER,
            name: this.name,
            priority: 65,
            target: highValueTarget,
          }
        }
      }

      return null
    },
  },

  // ===== 消除保护 (Removal) =====
  // 吃掉保护子后吃价值更高的棋子
  {
    id: 'removal_capture',
    name: '消除保护',
    type: TrapType.REMOVAL,
    findTrap(game, color) {
      const enemyColor = color === 'w' ? 'b' : 'w'
      const moves = game.moves({ verbose: true })

      for (const move of moves) {
        // 寻找吃子走法
        if (!move.captured) continue

        const capturedValue = PIECE_VALUES[move.captured]
        const movingPieceValue = PIECE_VALUES[move.piece]

        // 跳过亏本交换
        if (capturedValue < movingPieceValue - 50) continue

        game.move(move)

        // 检查目标格子现在是否被攻击
        const attackers = game.attackers(move.to, enemyColor)

        if (attackers.length === 0) {
          // 目标格子现在无保护，可能有机会
          const defender = getLeastValuableAttacker(game, move.to, enemyColor)

          if (defender) {
            const defenderValue = defender.value
            const targetPiece = game.get(move.to)

            if (targetPiece && PIECE_VALUES[targetPiece.type] > defenderValue) {
              // 可以进一步攻击
              game.undo()
              return {
                move,
                trapType: TrapType.REMOVAL,
                name: this.name,
                priority: 60,
                followUp: true,
              }
            }
          }
        }

        game.undo()
      }

      return null
    },
  },

  // ===== 引入陷阱 (Decoy) =====
  // 引诱敌方棋子到不利位置
  {
    id: 'decoy_to_weak',
    name: '引入陷阱',
    type: TrapType.DECOY,
    findTrap(game, color) {
      const enemyColor = color === 'w' ? 'b' : 'w'
      const moves = game.moves({ verbose: true })

      // 找到敌方有保护的高价值棋子
      for (const move of moves) {
        if (!move.captured) continue

        const targetPiece = game.get(move.to)
        if (!targetPiece || targetPiece.color !== enemyColor) continue

        // 检查这个棋子是否被保护
        const protectors = game.attackers(move.to, enemyColor)

        if (protectors.length === 0) continue // 无保护的棋子

        const protector = getLeastValuableAttacker(game, move.to, enemyColor)
        if (!protector) continue

        // 如果能用更弱的棋子吃掉它
        const capturedValue = PIECE_VALUES[move.captured]
        const attackerValue = PIECE_VALUES[move.piece]

        if (attackerValue <= capturedValue + 50) {
          game.move(move)

          // 检查吃掉后是否能保持子力优势
          const reAttackers = game.attackers(move.to, enemyColor)
          const newDefender = getLeastValuableAttacker(game, move.to, color)

          game.undo()

          if (reAttackers.length === 0 || (newDefender && newDefender.value > attackerValue)) {
            return {
              move,
              trapType: TrapType.DECOY,
              name: this.name,
              priority: 55,
            }
          }
        }
      }

      return null
    },
  },

  // ===== 发现攻击 (Discovered Attack) =====
  // 移动棋子露出另一个攻击
  {
    id: 'discovered_attack',
    name: '发现攻击',
    type: TrapType.DISCOVERED_ATTACK,
    findTrap(game, color) {
      const enemyColor = color === 'w' ? 'b' : 'w'
      const moves = game.moves({ verbose: true })

      for (const move of moves) {
        if (move.piece === 'k' || move.piece === 'p') continue // 国王和兵通常不产生发现攻击

        // 检查走子前后的攻击变化
        const originalAttackers = game.attackers(move.to, color)

        game.move(move)

        // 检查敌方国王是否被将军
        const enemyKingSquare = findPieceSquare(game, enemyColor, 'k')
        let isCheck = false

        if (enemyKingSquare) {
          const kingAttackers = game.attackers(enemyKingSquare, color)
          if (kingAttackers.length > 0) {
            isCheck = true
          }
        }

        // 检查是否同时攻击多个目标
        let attackCount = 0
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const piece = game.board()[row][col]
            if (piece && piece.color === enemyColor && piece.type !== 'k') {
              const square = `${String.fromCharCode(97 + col)}${8 - row}`
              const attackers = game.attackers(square, color)

              if (attackers.some((a) => a === move.to)) {
                attackCount++
              }
            }
          }
        }

        game.undo()

        if (isCheck || attackCount >= 2) {
          return {
            move,
            trapType: TrapType.DISCOVERED_ATTACK,
            name: this.name,
            priority: isCheck ? 85 : 50,
            isCheck,
          }
        }
      }

      return null
    },
  },

  // ===== 王移动暴露陷阱 =====
  {
    id: 'king_exposes',
    name: '王暴露弱点',
    type: TrapType.DISCOVERED_ATTACK,
    findTrap(game, color) {
      const enemyColor = color === 'w' ? 'b' : 'w'
      const moves = game.moves({ verbose: true })

      for (const move of moves) {
        if (move.piece !== 'k') continue

        game.move(move)

        // 检查移动后国王是否被将军
        if (game.isCheck()) {
          const attackers = game.attackers(findPieceSquare(game, color, 'k'), enemyColor)

          if (attackers.length >= 1) {
            game.undo()
            return {
              move,
              trapType: TrapType.DISCOVERED_ATTACK,
              name: this.name,
              priority: 75, // 敌人被迫移动国王
            }
          }
        }

        game.undo()
      }

      return null
    },
  },
]

// ==================== 陷阱检测函数 ====================

/**
 * 在当前局面中查找陷阱走法
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - AI 执棋颜色
 * @param {number} difficultyDepth - 当前难度搜索深度（深度越大越可能使用陷阱）
 * @returns {Object|null} 陷阱走法或 null
 *
 * 策略：
 * - 只在中局使用陷阱（开局阶段用开局库）
 * - 根据难度决定是否使用陷阱
 * - 陷阱优先级影响选择概率
 */
export function findTraps(game, color, difficultyDepth = 3) {
  // 只在中局使用陷阱（开局阶段用开局库）
  const moveCount = parseInt(game.fen().split(' ')[5], 10)
  if (moveCount <= 8) {
    return null // 开局阶段
  }

  // 低难度不主动寻找陷阱
  if (difficultyDepth < 2) {
    return null
  }

  const traps = []

  // 遍历所有陷阱模式
  for (const trap of TRAP_BOOK) {
    try {
      const result = trap.findTrap(game, color)
      if (result) {
        // 根据难度调整优先级
        const depthBonus = Math.min(difficultyDepth * 5, 20)
        result.priority += depthBonus
        traps.push(result)
      }
    } catch (e) {
      // 单个陷阱检测失败不影响其他陷阱
      console.warn(`Trap detection failed: ${trap.id}`, e)
    }
  }

  if (traps.length === 0) {
    return null
  }

  // 按优先级排序
  traps.sort((a, b) => b.priority - a.priority)

  // 高优先级陷阱直接执行
  if (traps[0].priority >= 80) {
    return traps[0].move
  }

  // 中优先级陷阱有概率执行
  if (traps[0].priority >= 60 && Math.random() < 0.7) {
    return traps[0].move
  }

  // 低优先级陷阱小概率执行
  if (Math.random() < 0.3) {
    return traps[0].move
  }

  return null
}

/**
 * 检查是否有即将被将军的威胁
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 颜色
 * @returns {Object|null} 威胁信息或 null
 */
export function findIncomingThreats(game, color) {
  const enemyColor = color === 'w' ? 'b' : 'w'
  const kingSquare = findPieceSquare(game, color, 'k')

  if (!kingSquare) {
    return null
  }

  // 检查国王是否被将军
  const attackers = game.attackers(kingSquare, enemyColor)

  if (attackers.length > 0) {
    const leastAttacker = getLeastValuableAttacker(game, kingSquare, enemyColor)
    return {
      type: 'check',
      attackers,
      leastAttacker,
    }
  }

  return null
}

/**
 * 获取陷阱提示（用于调试或教程模式）
 *
 * @param {Chess} game - 棋局实例
 * @param {string} color - 颜色
 * @returns {string[]} 陷阱提示列表
 */
export function getTrapHints(game, color) {
  const hints = []

  for (const trap of TRAP_BOOK) {
    try {
      const result = trap.findTrap(game, color)
      if (result) {
        hints.push(`${result.name}：${result.move.san}`)
      }
    } catch {
      // 忽略
    }
  }

  return hints
}