/**
 * @file App.jsx
 * @description 国际象棋应用的主组件
 *
 * 职责概述：
 * - 持有棋局状态、玩家设置（颜色、双方角色、难度）等核心状态
 * - 协调 UI 组件（Chessboard、侧边栏）和 AI 逻辑（通过 useComputerMove）
 * - 处理用户交互：拖拽走子、角色切换、难度切换、重新开始
 * - 管理棋盘高亮、将军闪烁等视觉效果
 *
 * 状态管理架构：
 * - game: Chess 实例，存储完整棋局状态（包括历史）
 * - playerColor: 我方执棋颜色 ('w' 白方 / 'b' 黑方)
 * - mySideRole / opponentSideRole: 双方角色
 * - myComputerDifficultyKey / opponentComputerDifficultyKey: 双方电脑难度
 * - boardResetCount: 用于强制重新渲染棋盘（清除拖拽残影）
 * - highlightedSquares: 拖拽时显示的可落点高亮
 * - flashSquares: 将军时需要闪烁的格子
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { DIFFICULTY_BY_KEY, DIFFICULTY_LEVELS, getCurrentSearchDepth } from './chess-ai'
import BoardSideStatus from './components/BoardSideStatus'
import GameControls from './components/GameControls'
import GameHeader from './components/GameHeader'
import GameInfo from './components/GameInfo'
import MoveHistory from './components/MoveHistory'
import OpeningActions from './components/OpeningActions'
import SoundSettings from './components/SoundSettings'
import { useComputerMove } from './hooks/useComputerMove'
import {
  canInteractWithSquare,
  cloneGameWithHistory,
  getCheckingSquares,
  getExposedKingSquaresAfterVisualMove,
  getKingSquare,
  transformCurrentTurnNonKingPiecesToQueens,
  transformCurrentTurnPawnsToKnights,
} from './lib/gameState'
import { getColorLabel, getDrawNotice, getGameEndSound, getStatusText, groupMovesByTurn } from './lib/gameStatus'
import { canManualMove, getComputerTurnConfig, getOpponentColor } from './lib/sideControl'
import { soundManager, SoundStyle, initSounds, playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playDrawSound, playInvalidMoveSound, playWinSound } from './lib/soundManager'
import './App.css'

const DEFAULT_AI_CONFIG = {
  provider: 'openai',
  requestUrl: '',
  apiKey: '',
  modelName: '',
}

const ROLE_LABELS = {
  player: '玩家',
  computer: '电脑',
  aiModel: 'AI 模型',
}

const PROMOTION_OPTIONS = ['q', 'r', 'b', 'n']
const PROMOTION_PIECE_SYMBOLS = {
  wq: '♕',
  wr: '♖',
  wb: '♗',
  wn: '♘',
  bq: '♛',
  br: '♜',
  bb: '♝',
  bn: '♞',
}

/**
 * 主应用组件
 *
 * 整体数据流：
 * 1. 玩家拖拽棋子 → handlePieceDrop 验证并更新 game 状态
 * 2. game 状态变化触发 useComputerMove 检测是否轮到电脑
 * 3. 电脑走棋完成后 → applyComputerMove 更新 game 状态
 * 4. React 自动重新渲染，展示新局面
 */
function App() {
  // ==================== 状态定义 ====================

  /** @type {Chess} 棋局状态完整实例，包含所有历史着法 */
  const [game, setGame] = useState(() => new Chess())

  /** @type {string} 玩家执棋颜色，'w'=白方，'b'=黑方 */
  const [playerColor, setPlayerColor] = useState('w')

  /** @type {string} 我方角色 */
  const [mySideRole, setMySideRole] = useState('player')

  /** @type {string} 敌方角色 */
  const [opponentSideRole, setOpponentSideRole] = useState('computer')

  /** @type {string} 我方电脑难度 */
  const [myComputerDifficultyKey, setMyComputerDifficultyKey] = useState('hard')

  /** @type {string} 敌方电脑难度 */
  const [opponentComputerDifficultyKey, setOpponentComputerDifficultyKey] = useState('hard')

  /** @type {{requestUrl:string, apiKey:string, modelName:string}} 我方 AI 模型配置 */
  const [myAiConfig, setMyAiConfig] = useState(DEFAULT_AI_CONFIG)

  /** @type {{requestUrl:string, apiKey:string, modelName:string}} 敌方 AI 模型配置 */
  const [opponentAiConfig, setOpponentAiConfig] = useState(DEFAULT_AI_CONFIG)

  /**
   * 棋盘重置计数器
   * 用途：当拖拽失败（如非法走法）时递增，强制 Chessboard 组件重新挂载
   * 原因：消除拖拽残影（库本身不会自动清理失败的拖拽状态）
   */
  const [boardResetCount, setBoardResetCount] = useState(0)

  /** @type {Object} 棋盘格子样式映射，用于显示可落点高亮 */
  const [highlightedSquares, setHighlightedSquares] = useState({})

  /** @type {string[]} 将军闪烁动画的格子列表 */
  const [flashSquares, setFlashSquares] = useState([])

  /** 挂起中的玩家升变选择 */
  const [pendingPromotion, setPendingPromotion] = useState(null)

  /**
   * 将军闪烁定时器引用
   * 用于在组件卸载或重新开始时清除未完成的定时器
   */
  const flashTimeoutRef = useRef(null)

  // ==================== 音效状态 ====================

  /** @type {string} 当前音效风格 */
  const [soundStyle, setSoundStyle] = useState(() => soundManager.getStyle())

  /** @type {number} 当前音量 (0-1) */
  const [soundVolume, setSoundVolume] = useState(() => soundManager.getVolume())

  /** @type {boolean} 是否静音 */
  const [soundMuted, setSoundMuted] = useState(() => soundManager.isMuted())

  /** @type {boolean} 顶部菜单是否展开 */
  const [isCheatMenuOpen, setIsCheatMenuOpen] = useState(false)

  /** @type {boolean} 电脑速度菜单是否展开 */
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false)

  /** @type {number} 电脑最短出招展示时长（毫秒） */
  const [computerMoveDelayMs, setComputerMoveDelayMs] = useState(800)

  /** 上一次将军状态，用于检测变化 */
  const prevIsCheckRef = useRef(false)

  /** 上一次游戏结束状态，用于检测变化 */
  const prevIsGameOverRef = useRef(false)

  /** 当前对局代际。重新开始时递增，用于屏蔽旧对局的异步走棋回调。 */
  const gameSessionRef = useRef(0)

  /** AI 运行时代际。重新开始时递增，用于强制重建整套 AI worker。 */
  const [aiRuntimeKey, setAiRuntimeKey] = useState(0)

  /** 挂起中的延迟动作：重开或作弊 */
  const [pendingAction, setPendingAction] = useState(null)

  /** 是否已开始 1 秒延迟倒计时 */
  const [isPendingActionDelayActive, setIsPendingActionDelayActive] = useState(false)

  /** 延迟动作定时器 */
  const pendingActionTimerRef = useRef(null)

  // ==================== 派生状态（基于 game 计算）====================

  /** 当前局面的 FEN 字符串表示 */
  const fen = game.fen()

  /**
   * 电脑执棋颜色
   * 规则：与玩家颜色相反
   */
  const opponentColor = getOpponentColor(playerColor)

  const currentTurnRole = game.turn() === playerColor ? mySideRole : opponentSideRole

  const activeComputerTurn = getComputerTurnConfig({
    turnColor: game.turn(),
    playerColor,
    mySideRole,
    opponentSideRole,
    myComputerDifficultyKey,
    opponentComputerDifficultyKey,
  })

  const activeDifficultyKey = activeComputerTurn?.difficultyKey ?? null

  /**
   * 当前难度配置的完整对象
   * 来源：chess-ai.js 中的 DIFFICULTY_BY_KEY 映射
   */
  const difficulty = activeDifficultyKey ? DIFFICULTY_BY_KEY[activeDifficultyKey] : null

  /**
   * 是否使用 Stockfish 引擎
   * 判断依据：难度配置中的 engine 字段是否为 'stockfish'
   * 注意：困难和大师模式使用 Stockfish，自定义 AI 用于新手和中等
   */
  const usesStockfish = difficulty?.engine === 'stockfish'

  /** 当前走棋历史的 SAN 表示（如 ['e4', 'd4', 'Nf3']） */
  const moveHistory = game.history()

  /** 走棋历史按回合分组（如 [{moveNumber:1, white:'e4', black:'e5'}, ...]） */
  const groupedMoveHistory = groupMovesByTurn(moveHistory)

  /** 当前走棋历史的详细 verbose 对象，包含 from/to/captured 等信息 */
  const verboseHistory = game.history({ verbose: true })

  /**
   * 当前搜索深度
   * 用途：显示给玩家的 AI 思考深度信息
   * 注意：Stockfish 难度显示的是 stockfishDepth，自定义 AI 显示配置的 depth
   */
  const currentSearchDepth = activeDifficultyKey ? getCurrentSearchDepth(fen, activeDifficultyKey) : 0

  /** 是否存在电脑角色，用于决定是否显示对局信息 */
  const hasComputerSide = mySideRole === 'computer' || opponentSideRole === 'computer'

  /** 我方摘要文案 */
  const mySideSummary = `${ROLE_LABELS[mySideRole]} · ${getColorLabel(playerColor)}`

  /** 敌方摘要文案 */
  const opponentSideSummary = `${ROLE_LABELS[opponentSideRole]} · ${getColorLabel(opponentColor)}`

  const myBoardSideDetail = getBoardSideDetail(mySideRole, myComputerDifficultyKey, myAiConfig)
  const opponentBoardSideDetail = getBoardSideDetail(opponentSideRole, opponentComputerDifficultyKey, opponentAiConfig)

  /**
   * 玩家是否可以走棋
   * 条件：
   * - 棋局未结束（!game.isGameOver()）
   * - 并且（双人模式 或者 当前轮到玩家执棋）
   */
  const canMove = !game.isGameOver() && canManualMove({
    turnColor: game.turn(),
    playerColor,
    mySideRole,
    opponentSideRole,
  })

  /**
   * 将死局面中被将军国王的位置
   * 仅在 checkmate 时有值，用于将死国王格子显示红色
   */
  const matedKingSquare = game.isCheckmate() ? getKingSquare(game, game.turn()) : null

  /** 最后一步走法，格式为 {from, to, captured, ...}，用于高亮上一手 */
  const lastMove = verboseHistory.at(-1) ?? null

  /**
   * 和棋提示文案
   * 来源：根据游戏状态判断返回对应和棋原因
   */
  const drawNotice = getDrawNotice(game)

  /** 状态栏显示的文本，根据游戏状态动态生成 */
  const statusText = getStatusText(game, {
    playerColor,
    mySideRole,
    opponentSideRole,
  })

  const isCheatDisabled = game.isGameOver() || pendingAction !== null

  // ==================== 回调函数 ====================

  /**
   * 应用电脑走法的回调函数
   *
   * @param {Object} move - 走法对象，包含 from/to/promotion 等字段
   *
   * 工作流程：
   * 1. 接收电脑的走法
   * 2. 使用 setGame 函数式更新确保操作最新棋局
   * 3. 克隆棋局以保留历史
   * 4. 应用走法并获取详细的走法结果（包含 captured 字段）
   * 5. 更新 game 状态触发重新渲染
   * 6. 根据是否吃子播放不同音效
   */
  const applyComputerMove = useCallback(
    (move, sessionId) => {
      setGame((currentGame) => {
        if (sessionId !== gameSessionRef.current) {
          return currentGame
        }

        // 克隆棋局以保留历史
        const nextGame = cloneGameWithHistory(currentGame)

        let moveResult = null

        try {
          // 应用走法并获取详细结果（包含 captured 字段）
          moveResult = nextGame.move(move)
        } catch (error) {
          console.warn('[App] Ignored stale computer move, rebuilding AI runtime', {
            move,
            sessionId,
            currentSessionId: gameSessionRef.current,
            error,
          })
          setAiRuntimeKey((current) => current + 1)
          return currentGame
        }

        if (!moveResult) {
          return currentGame
        }

        triggerCheckFlash(nextGame)

        // 根据是否吃子播放不同音效
        if (moveResult.captured) {
          playCaptureSound()
        } else {
          playMoveSound()
        }

        return nextGame
      })
    },
    // 不依赖 game，使用函数式更新确保总是操作最新棋局
    []
  )

  /**
   * 电脑走棋 Hook
   *
   * 职责：
   * - 创建和管理 AI Worker（自定义 AI 和 Stockfish）
   * - 根据难度选择使用哪种引擎
   * - 处理并行计算和结果汇总
   * - 暴露思考状态和取消方法
   *
   * 返回值：
   * - isComputerThinking: 电脑是否正在计算
   * - cancelPendingComputerMove: 取消待处理的电脑走棋
   */
  const { isComputerThinking, cancelPendingComputerMove } = useComputerMove({
    game,
    computerColor: activeComputerTurn?.computerColor ?? null,
    difficultyKey: activeComputerTurn?.difficultyKey ?? null,
    usesStockfish,
    minMoveDisplayMs: computerMoveDelayMs,
    gameSessionId: gameSessionRef.current,
    runtimeKey: aiRuntimeKey,
    suppressNewTurns: pendingAction !== null,
    onEngineCrash: () => {
      console.warn('[App] Stockfish worker crashed, rebuilding AI runtime')
      setAiRuntimeKey((current) => current + 1)
    },
    applyComputerMove,
  })

  const isCurrentSideThinking = isComputerThinking && (currentTurnRole === 'computer' || currentTurnRole === 'aiModel')
  const isResetPending = pendingAction?.type === 'reset'
  const isCheatPending = pendingAction?.type === 'cheat'
  const isDifficultyPending = pendingAction?.type === 'difficulty'

  // ==================== 副作用 ====================

  /**
   * 初始化音效系统
   */
  useEffect(() => {
    initSounds().then(() => {
      // 确保音效风格与状态同步
      soundManager.setStyle(soundStyle)
    })
  }, [soundStyle])

  /**
   * 组件卸载时清理闪烁定时器
   *
   * 防止内存泄漏和定时器回调在组件卸载后执行
   */
  useEffect(
    () => () => {
      window.clearTimeout(flashTimeoutRef.current)
      window.clearTimeout(pendingActionTimerRef.current)
    },
    []
  )

  useEffect(() => {
    if (pendingAction === null || isPendingActionDelayActive || isComputerThinking || pendingActionTimerRef.current !== null) {
      return
    }

    console.info('[App] Current move settled, start delayed action countdown', {
      pendingActionType: pendingAction.type,
      delayMs: 1000,
    })

    setIsPendingActionDelayActive(true)
    window.clearTimeout(pendingActionTimerRef.current)
    pendingActionTimerRef.current = window.setTimeout(() => {
      pendingActionTimerRef.current = null
      setIsPendingActionDelayActive(false)
      const actionToApply = pendingAction
      setPendingAction(null)

      if (!actionToApply) {
        return
      }

      if (actionToApply.type === 'reset') {
        resetGame(actionToApply.nextPlayerColor)
        return
      }

      if (actionToApply.type === 'cheat') {
        setFlashSquares([])
        window.clearTimeout(flashTimeoutRef.current)
        setHighlightedSquares({})
        setGame((currentGame) => actionToApply.transformGame(currentGame))
        playWinSound()
        return
      }

      if (actionToApply.type === 'difficulty') {
        if (actionToApply.side === 'my') {
          setMyComputerDifficultyKey(actionToApply.difficultyKey)
        } else {
          setOpponentComputerDifficultyKey(actionToApply.difficultyKey)
        }
      }
    }, 1000)
  }, [isComputerThinking, isPendingActionDelayActive, pendingAction])

  /**
   * 检测将军和游戏结束状态变化，播放对应音效
   */
  useEffect(() => {
    const gameEndSound = getGameEndSound(game, playerColor)

    // 检测游戏结束
    if (gameEndSound && !prevIsGameOverRef.current) {
      if (gameEndSound === 'win') {
        playWinSound()
      } else if (gameEndSound === 'draw') {
        playDrawSound()
      } else {
        playCheckmateSound()
      }
      prevIsGameOverRef.current = true
    }

    // 检测将军
    if (game.isCheck() && !prevIsCheckRef.current && !game.isCheckmate()) {
      playCheckSound()
      prevIsCheckRef.current = true
    }

    // 如果之前被将军但现在不是，检测是否轮到新的一方
    if (!game.isCheck() && prevIsCheckRef.current && !game.isCheckmate()) {
      prevIsCheckRef.current = false
    }

    // 游戏结束时重置
    if (game.isGameOver()) {
      prevIsGameOverRef.current = true
    } else {
      prevIsGameOverRef.current = false
    }
  }, [fen, game])

  // ==================== 样式计算 ====================

  /**
   * 棋盘格子样式映射
   *
   * 样式优先级（从低到高）：
   * 1. 默认样式（无）
   * 2. 上一手走法的起点和终点高亮
   * 3. 用户自定义高亮（拖拽时显示可落点）
   * 4. 将军闪烁动画（应用于王和攻击它的棋子）
   * 5. 将死国王红色背景
   *
   * 颜色语义：
   * - 黄色半透明：上一手起点 (rgba(250, 204, 21, 0.2))
   * - 橙色半透明（有吃子）：上一手终点 (rgba(249, 115, 22, 0.34))
   * - 黄色半透明（无吃子）：上一手终点 (rgba(250, 204, 21, 0.28))
   * - 绿色半透明：可落点高亮 (rgba(34, 197, 94, 0.42))
   * - 红色：被将死的国王
   */
  const squareStyles = useMemo(
    () => ({
      // 上一手走法的起点格子
      ...(lastMove
        ? {
            [lastMove.from]: {
              backgroundColor: 'rgba(250, 204, 21, 0.2)',
            },
            // 上一手走法的终点格子（有吃子时用橙色区分）
            [lastMove.to]: {
              backgroundColor: lastMove.captured ? 'rgba(249, 115, 22, 0.34)' : 'rgba(250, 204, 21, 0.28)',
            },
          }
        : {}),
      // 用户拖拽时的高亮（可落点）
      ...highlightedSquares,
      // 将军闪烁动画
      ...Object.fromEntries(
        flashSquares.map((square) => [
          square,
          {
            animation: 'check-flash-double 0.72s ease-in-out 1',
          },
        ])
      ),
      // 将死国王的红色背景
      ...(matedKingSquare
        ? {
            [matedKingSquare]: {
              backgroundColor: '#d9534f',
            },
          }
        : {}),
    }),
    [flashSquares, highlightedSquares, lastMove, matedKingSquare]
  )

  // ==================== 事件处理函数 ====================

  /**
   * 重置游戏到初始状态
   *
   * @param {string} nextPlayerColor - 重开后玩家执棋颜色，默认为当前颜色
   *
   * 执行步骤：
   * 1. 取消待处理的电脑走棋
   * 2. 清空闪烁状态
   * 3. 清除闪烁定时器
   * 4. 更新玩家颜色
   * 5. 创建新的空棋局
   * 6. 重置 boardResetCount 强制重新挂载棋盘（消除残影）
   * 7. 清空高亮
   */
  function resetGame(nextPlayerColor = playerColor) {
    gameSessionRef.current += 1
    console.info('[App] Resetting game', {
      nextPlayerColor,
      nextSessionId: gameSessionRef.current,
    })
    cancelPendingComputerMove()
    setFlashSquares([])
    window.clearTimeout(flashTimeoutRef.current)
    prevIsCheckRef.current = false
    prevIsGameOverRef.current = false
    setPlayerColor(nextPlayerColor)
    setGame(new Chess())
    // 强制重新挂载棋盘，用来清掉无效拖拽后的残影。
    setBoardResetCount(0)
    setHighlightedSquares({})
  }

  function scheduleResetGame(nextPlayerColor = playerColor) {
    if (pendingAction !== null) {
      return
    }

    console.info('[App] Schedule reset game after current move settles', {
      nextPlayerColor,
    })

    cancelPendingComputerMove()
    setPendingAction({
      type: 'reset',
      nextPlayerColor,
    })
  }

  function handleCheatAction(transformGame) {
    setIsCheatMenuOpen(false)

    if (pendingAction !== null) {
      return
    }

    cancelPendingComputerMove()
    setPendingAction({
      type: 'cheat',
      transformGame,
    })
  }

  function handleComputerDifficultyChange(side, difficultyKey) {
    if (pendingAction !== null) {
      return
    }

    const currentKey = side === 'my' ? myComputerDifficultyKey : opponentComputerDifficultyKey

    if (currentKey === difficultyKey) {
      return
    }

    cancelPendingComputerMove()
    setPendingAction({
      type: 'difficulty',
      side,
      difficultyKey,
    })
  }

  /**
   * 处理玩家切换执棋颜色
   *
   * @param {string} nextColor - 新的执棋颜色 ('w' 或 'b')
   */
  function handleColorChange(nextColor) {
    scheduleResetGame(nextColor)
  }

  /**
   * 触发将军闪烁效果
   *
   * @param {Chess} nextGame - 要检查的棋局状态，默认为当前 game
   *
   * 逻辑：
   * 1. 获取被将军方的颜色
   * 2. 仅在被将军方为玩家角色时触发
   * 3. 找出王的位置和所有攻击它的敌方棋子位置
   * 4. 设置这些格子用于显示闪烁动画
   * 5. 760ms 后自动清除闪烁
   */
  function triggerCheckFlash(nextGame) {
    const checkedColor = nextGame.turn()

    // 仅在真正被将军时触发（双人模式或轮到玩家时）
    const checkedRole = checkedColor === playerColor ? mySideRole : opponentSideRole

    if (!nextGame.isCheck() || checkedRole !== 'player') {
      return
    }

    // 获取王的位置 + 所有攻击王的其他格子
    const nextFlashSquares = [getKingSquare(nextGame, checkedColor), ...getCheckingSquares(nextGame, checkedColor)].filter(Boolean)

    if (nextFlashSquares.length === 0) {
      return
    }

    // 先清除旧定时器，再设置新的
    window.clearTimeout(flashTimeoutRef.current)
    setFlashSquares(nextFlashSquares)

    // 760ms 后自动清除闪烁
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashSquares([])
    }, 760)
  }

  /**
   * 触发一次性警告闪烁，用于“非法拖拽会暴露己王”的提示。
   *
   * @param {string[]} squares - 需要高亮的格子（通常为国王和攻击者）
   */
  function triggerWarningFlash(squares) {
    if (!squares.length) {
      return
    }

    window.clearTimeout(flashTimeoutRef.current)
    setFlashSquares(squares)

    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashSquares([])
    }, 760)
  }

  function handleAiConfigChange(side, field, value) {
    if (side === 'my') {
      setMyAiConfig((current) => ({
        ...current,
        [field]: value,
      }))
      return
    }

    setOpponentAiConfig((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function isPromotionMove(sourceSquare, targetSquare) {
    const movingPiece = game.get(sourceSquare)

    if (movingPiece?.type !== 'p') {
      return false
    }

    const targetRank = Number.parseInt(targetSquare?.[1] ?? '', 10)

    if (Number.isNaN(targetRank)) {
      return false
    }

    return (movingPiece.color === 'w' && targetRank === 8) || (movingPiece.color === 'b' && targetRank === 1)
  }

  function applyPlayerMove(sourceSquare, targetSquare, promotionPiece = undefined) {
    const gameForMove = cloneGameWithHistory(game)

    try {
      const result = gameForMove.move({
        from: sourceSquare,
        to: targetSquare,
        ...(promotionPiece ? { promotion: promotionPiece } : {}),
      })

      if (result) {
        triggerCheckFlash(gameForMove)
        setGame(gameForMove)

        if (result.captured) {
          playCaptureSound()
        } else {
          playMoveSound()
        }

        return true
      }
    } catch {
      // 走子违反规则
    }

    setBoardResetCount((count) => count + 1)
    return false
  }

  /**
   * 处理棋子拖拽放下（走棋）
   *
   * @param {string} sourceSquare - 起始格子，如 'e2'
   * @param {string} targetSquare - 目标格子，如 'e4'
   * @returns {boolean} 走棋是否成功
   *
   * 核心逻辑：
   * 1. 检查是否可以走棋（canMove）
   * 2. 克隆当前棋局以支持撤销
   * 3. 尝试执行走法（自动处理兵的升变默认为后）
   * 4. 成功时更新 game 状态
   * 5. 失败时触发将军检查和棋盘重置
   */
  function handlePieceDrop(sourceSquare, targetSquare) {
    setHighlightedSquares({})
    window.clearTimeout(flashTimeoutRef.current)
    setFlashSquares([])
    setPendingPromotion(null)

    // 非可走棋状态直接拒绝
    if (!canMove) {
      return false
    }

    // 只能操作当前回合方的棋子
    if (!canInteractWithSquare(game, sourceSquare)) {
      setFlashSquares([])
      setBoardResetCount((count) => count + 1)
      return false
    }

    // 如果目标为空（落在棋盘外或无效区域），直接拒绝
    if (!targetSquare) {
      setBoardResetCount((count) => count + 1)
      return false
    }

    // 检查目标是否是有效落点
    const allLegalMoves = game.moves({ square: sourceSquare, verbose: true })
    const isValidDrop = allLegalMoves.some((move) => move.to === targetSquare)

    if (isValidDrop) {
      if (isPromotionMove(sourceSquare, targetSquare)) {
        const movingPiece = game.get(sourceSquare)

        setPendingPromotion({
          from: sourceSquare,
          to: targetSquare,
          color: movingPiece.color,
        })

        return false
      }

      // 有效落点，走正常流程
      return applyPlayerMove(sourceSquare, targetSquare)
    }

    // 非有效落点：按视觉模拟本次拖拽，检查是否会暴露己方国王
    const exposureSquares = getExposedKingSquaresAfterVisualMove(game, {
      from: sourceSquare,
      to: targetSquare,
    })

    if (exposureSquares.length > 0) {
      triggerWarningFlash(exposureSquares)
      playInvalidMoveSound()
    }

    // 无论是普通非法走法还是会导致被将军，都重置棋盘
    setBoardResetCount((count) => count + 1)
    return false
  }

  /**
   * 处理棋子开始拖拽
   *
   * @param {Object} param - 包含 square 字段的对象
   *
   * 功能：
   * - 当玩家开始拖拽一个棋子时
   * - 计算该棋子所有合法的目标格子
   * - 将这些格子标记为绿色高亮
   *
   * 注意：
   * - 只在 canMove 为 true 时响应
   * - 使用 game.moves({ square, verbose: true }) 获取详细走法信息
   */
  function handlePieceDrag({ square }) {
    window.clearTimeout(flashTimeoutRef.current)

    if (!square || !canMove || !canInteractWithSquare(game, square)) {
      setHighlightedSquares({})
      setFlashSquares([])
      return
    }

    setFlashSquares([])

    // 计算该棋子所有合法走法并提取目标格子
    const nextHighlights = Object.fromEntries(
      game.moves({ square, verbose: true }).map((move) => [
        move.to,
        {
          backgroundColor: 'rgba(34, 197, 94, 0.42)',
        },
      ])
    )

    setHighlightedSquares(nextHighlights)
  }

  // ==================== 拖拽取消监听（用于清除高亮）====================

  /**
   * 棋盘容器 ref，用于添加右键取消监听
   * 目的：当右键取消拖拽时，清除绿色高亮
   */
  const boardWrapRef = useRef(null)

  /**
   * 设置右键取消监听
   * 右键点击时清除拖拽高亮（react-chessboard 使用右键取消拖拽）
   */
  useEffect(() => {
    const boardWrap = boardWrapRef.current
    if (!boardWrap) return

    const handleContextMenu = (e) => {
      // 拖拽高亮存在时，右键取消操作应该清除高亮
      if (Object.keys(highlightedSquares).length > 0) {
        e.preventDefault()
        setHighlightedSquares({})
      }
    }

    boardWrap.addEventListener('contextmenu', handleContextMenu)
    return () => {
      boardWrap.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [highlightedSquares])

  // ==================== 音效控制 ====================

  /**
   * 处理音效风格切换
   */
  function handleSoundStyleChange(style) {
    soundManager.setStyle(style)
    setSoundStyle(style)
  }

  /**
   * 处理音量调节
   */
  function handleVolumeChange(volume) {
    soundManager.setVolume(volume)
    setSoundVolume(volume)
  }

  /**
   * 处理静音切换
   */
  function handleMuteToggle() {
    const newMuted = soundManager.toggleMute()
    setSoundMuted(newMuted)
  }

  function handlePromotionSelect(promotionPiece) {
    if (!pendingPromotion) {
      return
    }

    const { from, to } = pendingPromotion
    setPendingPromotion(null)
    applyPlayerMove(from, to, promotionPiece)
  }

  function getPromotionPickerPosition() {
    if (!pendingPromotion) {
      return {}
    }

    const targetFile = pendingPromotion.to.charCodeAt(0) - 97
    const columnIndex = playerColor === 'w' ? targetFile : 7 - targetFile
    const leftPercent = (columnIndex + 0.5) * 12.5

    return {
      left: `calc(${leftPercent}% - 29px)`,
    }
  }

  // ==================== 渲染 ====================

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <h1 className="topbar-title">
            <img className="topbar-logo" src="/chess-logo.svg" alt="" aria-hidden="true" />
            <span>国际象棋</span>
          </h1>

          <div className="topbar-menu-group">
            <div className="topbar-menu">
              <button
                className={`topbar-menu-trigger${isCheatMenuOpen ? ' open' : ''}`}
                type="button"
                disabled={pendingAction !== null}
                onClick={() => {
                  setIsCheatMenuOpen((current) => !current)
                  setIsSpeedMenuOpen(false)
                }}
              >
                <span>作弊选项</span>
                <span className="topbar-menu-arrow">▾</span>
              </button>

              {isCheatMenuOpen ? (
                <div className="topbar-menu-panel">
                  <button
                    className="topbar-menu-item"
                    type="button"
                    disabled={isCheatDisabled}
                    onClick={() => {
                      handleCheatAction(transformCurrentTurnPawnsToKnights)
                    }}
                  >
                    {isCheatPending ? '等待作弊...' : '给马化腾充 Q 币'}
                  </button>

                  <button
                    className="topbar-menu-item"
                    type="button"
                    disabled={isCheatDisabled}
                    onClick={() => {
                      handleCheatAction(transformCurrentTurnNonKingPiecesToQueens)
                    }}
                  >
                    {isCheatPending ? '等待作弊...' : '请陈帅吃肯德基'}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="topbar-menu">
              <button
                className={`topbar-menu-trigger${isSpeedMenuOpen ? ' open' : ''}`}
                type="button"
                onClick={() => {
                  setIsSpeedMenuOpen((current) => !current)
                  setIsCheatMenuOpen(false)
                }}
              >
                <span>{getComputerSpeedLabel(computerMoveDelayMs)}</span>
                <span className="topbar-menu-arrow">▾</span>
              </button>

              {isSpeedMenuOpen ? (
                <div className="topbar-menu-panel">
                  <button
                    className={`topbar-menu-item${computerMoveDelayMs === 0 ? ' active' : ''}`}
                    type="button"
                    onClick={() => {
                      setComputerMoveDelayMs(0)
                      setIsSpeedMenuOpen(false)
                    }}
                  >
                    无延迟
                  </button>

                  <button
                    className={`topbar-menu-item${computerMoveDelayMs === 200 ? ' active' : ''}`}
                    type="button"
                    onClick={() => {
                      setComputerMoveDelayMs(200)
                      setIsSpeedMenuOpen(false)
                    }}
                  >
                    200 ms
                  </button>

                  <button
                    className={`topbar-menu-item${computerMoveDelayMs === 400 ? ' active' : ''}`}
                    type="button"
                    onClick={() => {
                      setComputerMoveDelayMs(400)
                      setIsSpeedMenuOpen(false)
                    }}
                  >
                    400 ms
                  </button>

                  <button
                    className={`topbar-menu-item${computerMoveDelayMs === 800 ? ' active' : ''}`}
                    type="button"
                    onClick={() => {
                      setComputerMoveDelayMs(800)
                      setIsSpeedMenuOpen(false)
                    }}
                  >
                    800 ms
                  </button>

                  <button
                    className={`topbar-menu-item${computerMoveDelayMs === 1600 ? ' active' : ''}`}
                    type="button"
                    onClick={() => {
                      setComputerMoveDelayMs(1600)
                      setIsSpeedMenuOpen(false)
                    }}
                  >
                    1600 ms
                  </button>

                  <button
                    className={`topbar-menu-item${computerMoveDelayMs === 3200 ? ' active' : ''}`}
                    type="button"
                    onClick={() => {
                      setComputerMoveDelayMs(3200)
                      setIsSpeedMenuOpen(false)
                    }}
                  >
                    3200 ms
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="app-shell">
        {/* 左侧：棋盘区域 */}
        <section className="board-panel">
          {/* 顶部状态区：状态文案、和棋提示 */}
          <GameHeader
            statusText={statusText}
            drawNotice={drawNotice}
          />

          {/* 棋盘容器 */}
          <div className="board-wrap" ref={boardWrapRef}>
            <BoardSideStatus
              label={getColorLabel(opponentColor)}
              detail={opponentBoardSideDetail}
              isThinking={isCurrentSideThinking && game.turn() === opponentColor}
              statusText={game.turn() === opponentColor && opponentSideRole === 'player' ? '> 该你走棋了 <' : ''}
              isActive={game.turn() === opponentColor}
            />

            <div className="board-stage">
              <Chessboard
                // key 变化会强制重新挂载组件，用于消除拖拽残影
                // 触发条件：玩家颜色变化 或 boardResetCount 变化
                key={`${playerColor}-${boardResetCount}`}
                options={{
                  id: 'simple-chess',
                  position: fen,  // 当前局面 FEN
                  onPieceDrop: (params) => handlePieceDrop(params.sourceSquare, params.targetSquare),
                  onPieceDrag: handlePieceDrag,
                  boardOrientation: playerColor === 'w' ? 'white' : 'black',  // 棋盘方向：白方视角或黑方视角
                  allowDragging: canMove,  // 禁止在电脑思考时拖拽
                  dragActivationDistance: 0,  // 按住即拿起，无需拖动距离
                  draggingPieceStyle: { transform: 'scale(1.4)' },  // 拖拽时棋子放大倍数
                  squareStyles,  // 格子样式（高亮、闪烁等）
                  boardStyle: {
                    borderRadius: '18px',
                    boxShadow: '0 24px 50px rgba(61, 41, 20, 0.4), inset 0 0 0 8px #a67c52',
                  },
                  darkSquareStyle: { backgroundColor: '#8ec5dc' },   // 浅蓝色深色格子
                  lightSquareStyle: { backgroundColor: '#d4eef6' },   // 极浅蓝色浅色格子
                  dropSquareStyle: { boxShadow: 'inset 0 0 1px 4px rgba(236, 201, 75, 0.85)' },  // 拖拽放置时目标格子样式
                  animationDurationInMs: 220,  // 棋子移动动画时长
                }}
              />

              {pendingPromotion ? (
                <div
                  className={`promotion-picker promotion-picker-${pendingPromotion.color === 'w' ? 'top' : 'bottom'}`}
                  style={getPromotionPickerPosition()}
                >
                  {PROMOTION_OPTIONS.map((pieceType, index) => (
                    <button
                      key={pieceType}
                      className="promotion-option"
                      type="button"
                      style={{ '--promotion-index': index }}
                      onClick={() => handlePromotionSelect(pieceType)}
                    >
                      <span className="promotion-option-piece">
                        {PROMOTION_PIECE_SYMBOLS[`${pendingPromotion.color}${pieceType}`]}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <BoardSideStatus
              label={getColorLabel(playerColor)}
              detail={myBoardSideDetail}
              isThinking={isCurrentSideThinking && game.turn() === playerColor}
              statusText={game.turn() === playerColor && mySideRole === 'player' ? '> 该你走棋了 <' : ''}
              isActive={game.turn() === playerColor}
            />
          </div>
        </section>

        {/* 右侧：控制面板 */}
        <aside className="sidebar">
          <OpeningActions
            playerColor={playerColor}
            onColorChange={handleColorChange}
            onReset={() => scheduleResetGame()}
            isGameOver={game.isGameOver()}
            isResetPending={isResetPending}
          />

          {/* 游戏控制区：模式切换、难度选择 */}
          <GameControls
            mySideRole={mySideRole}
            opponentSideRole={opponentSideRole}
            myComputerDifficultyKey={myComputerDifficultyKey}
            opponentComputerDifficultyKey={opponentComputerDifficultyKey}
            difficultyLevels={DIFFICULTY_LEVELS}
            myAiConfig={myAiConfig}
            opponentAiConfig={opponentAiConfig}
            isDifficultyPending={isDifficultyPending}
            onMySideRoleChange={setMySideRole}
            onOpponentSideRoleChange={setOpponentSideRole}
            onMyComputerDifficultyChange={(difficultyKey) => handleComputerDifficultyChange('my', difficultyKey)}
            onOpponentComputerDifficultyChange={(difficultyKey) => handleComputerDifficultyChange('opponent', difficultyKey)}
            onMyAiConfigChange={(field, value) => handleAiConfigChange('my', field, value)}
            onOpponentAiConfigChange={(field, value) => handleAiConfigChange('opponent', field, value)}
          />

          {/* 对局信息区：显示玩家/电脑颜色、当前行棋方、难度、搜索深度 */}
          <GameInfo
          hasComputerSide={hasComputerSide}
          mySideSummary={mySideSummary}
          opponentSideSummary={opponentSideSummary}
          turnLabel={getColorLabel(game.turn())}
          currentSearchDepth={currentSearchDepth}
        />

          {/* 走棋记录区：按回合显示着法 */}
          <MoveHistory turns={groupedMoveHistory} />

          {/* 音效设置区 */}
          <SoundSettings
            style={soundStyle}
            volume={soundVolume}
            muted={soundMuted}
            onStyleChange={handleSoundStyleChange}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
          />
        </aside>
      </main>
    </>
  )
}

function getBoardSideDetail(role, computerDifficultyKey, aiConfig) {
  if (role === 'computer') {
    return `电脑 - ${DIFFICULTY_BY_KEY[computerDifficultyKey]?.label ?? computerDifficultyKey}`
  }

  if (role === 'aiModel') {
    return `AI 模型 - ${aiConfig.modelName || '未设置模型'}`
  }

  return '玩家'
}

function getComputerSpeedLabel(delayMs) {
  if (delayMs === 0) {
    return '电脑速度 - 无延迟'
  }

  return `电脑速度 - ${delayMs} ms`
}

export default App
