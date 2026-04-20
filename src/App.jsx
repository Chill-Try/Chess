import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { DIFFICULTY_BY_KEY, DIFFICULTY_LEVELS, getCurrentSearchDepth } from './chess-ai'
import GameControls from './components/GameControls'
import GameHeader from './components/GameHeader'
import GameInfo from './components/GameInfo'
import MoveHistory from './components/MoveHistory'
import { useComputerMove } from './hooks/useComputerMove'
import { applyMoveToGame, cloneGameWithHistory, getCheckingSquares, getKingSquare } from './lib/gameState'
import { getColorLabel, getDrawNotice, getStatusText, groupMovesByTurn } from './lib/gameStatus'
import './App.css'

function App() {
  const [game, setGame] = useState(() => new Chess())
  const [playerColor, setPlayerColor] = useState('w')
  const [gameMode, setGameMode] = useState('computer')
  const [difficultyKey, setDifficultyKey] = useState('beginner')
  const [boardResetCount, setBoardResetCount] = useState(0)
  const [highlightedSquares, setHighlightedSquares] = useState({})
  const [flashSquares, setFlashSquares] = useState([])

  const flashTimeoutRef = useRef(null)

  const fen = game.fen()
  const computerColor = playerColor === 'w' ? 'b' : 'w'
  const difficulty = DIFFICULTY_BY_KEY[difficultyKey]
  const usesStockfish = difficulty?.engine === 'stockfish'
  const moveHistory = game.history()
  const groupedMoveHistory = groupMovesByTurn(moveHistory)
  const verboseHistory = game.history({ verbose: true })
  const currentSearchDepth = getCurrentSearchDepth(fen, difficultyKey)
  const canMove = !game.isGameOver() && (gameMode === 'twoPlayer' || game.turn() === playerColor)
  const matedKingSquare = game.isCheckmate() ? getKingSquare(game, game.turn()) : null
  const lastMove = verboseHistory.at(-1) ?? null
  const drawNotice = getDrawNotice(game)
  const statusText = getStatusText(game, playerColor, gameMode)

  const applyComputerMove = useCallback(
    (move) => {
      setGame((currentGame) => applyMoveToGame(currentGame, move, computerColor))
    },
    [computerColor]
  )

  const { isComputerThinking, cancelPendingComputerMove } = useComputerMove({
    game,
    gameMode,
    computerColor,
    difficultyKey,
    usesStockfish,
    applyComputerMove,
  })

  useEffect(
    () => () => {
      window.clearTimeout(flashTimeoutRef.current)
    },
    []
  )

  const squareStyles = useMemo(
    () => ({
      ...(lastMove
        ? {
            [lastMove.from]: {
              backgroundColor: 'rgba(250, 204, 21, 0.2)',
            },
            [lastMove.to]: {
              backgroundColor: lastMove.captured ? 'rgba(249, 115, 22, 0.34)' : 'rgba(250, 204, 21, 0.28)',
            },
          }
        : {}),
      ...highlightedSquares,
      ...Object.fromEntries(
        flashSquares.map((square) => [
          square,
          {
            animation: 'check-flash-double 0.72s ease-in-out 1',
          },
        ])
      ),
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

  function resetGame(nextPlayerColor = playerColor) {
    cancelPendingComputerMove()
    setFlashSquares([])
    window.clearTimeout(flashTimeoutRef.current)
    setPlayerColor(nextPlayerColor)
    setGame(new Chess())
    // 强制重新挂载棋盘，用来清掉无效拖拽后的残影。
    setBoardResetCount(0)
    setHighlightedSquares({})
  }

  function handleColorChange(nextColor) {
    resetGame(nextColor)
  }

  function triggerCheckFlash(nextGame = game) {
    const checkedColor = nextGame.turn()

    if (!nextGame.isCheck() || (gameMode === 'computer' && checkedColor !== playerColor)) {
      return
    }

    const nextFlashSquares = [getKingSquare(nextGame, checkedColor), ...getCheckingSquares(nextGame, checkedColor)].filter(Boolean)

    if (nextFlashSquares.length === 0) {
      return
    }

    window.clearTimeout(flashTimeoutRef.current)
    setFlashSquares(nextFlashSquares)
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashSquares([])
    }, 760)
  }

  function handleDifficultyChange(nextDifficultyKey) {
    setDifficultyKey(nextDifficultyKey)
    resetGame(playerColor)
  }

  function handleModeChange(nextMode) {
    setGameMode(nextMode)
    resetGame(playerColor)
  }

  function handlePieceDrop(sourceSquare, targetSquare) {
    setHighlightedSquares({})

    if (!canMove) {
      return false
    }

    const nextGame = cloneGameWithHistory(game)
    let result = null

    try {
      result = nextGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })
    } catch {
      triggerCheckFlash()
      setBoardResetCount((count) => count + 1)
      return false
    }

    if (!result) {
      triggerCheckFlash()
      setBoardResetCount((count) => count + 1)
      return false
    }

    setGame(nextGame)
    return true
  }

  function handlePieceDrag({ square }) {
    if (!square || !canMove) {
      setHighlightedSquares({})
      return
    }

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

  return (
    <main className="app-shell">
      <section className="board-panel">
        <GameHeader statusText={statusText} isComputerThinking={isComputerThinking && gameMode === 'computer'} drawNotice={drawNotice} />

        <div className="board-wrap">
          <Chessboard
            key={`${playerColor}-${boardResetCount}`}
            options={{
              id: 'simple-chess',
              position: fen,
              onPieceDrop: ({ sourceSquare, targetSquare }) => handlePieceDrop(sourceSquare, targetSquare),
              onPieceDrag: handlePieceDrag,
              boardOrientation: playerColor === 'w' ? 'white' : 'black',
              allowDragging: canMove,
              squareStyles,
              boardStyle: {
                borderRadius: '18px',
                boxShadow: '0 24px 50px rgba(15, 23, 42, 0.22)',
              },
              darkSquareStyle: { backgroundColor: '#5b7fa6' },
              lightSquareStyle: { backgroundColor: '#eef6ff' },
              dropSquareStyle: { boxShadow: 'inset 0 0 1px 4px rgba(236, 201, 75, 0.85)' },
              animationDurationInMs: 220,
            }}
          />
        </div>
      </section>

      <aside className="sidebar">
        <GameControls
          gameMode={gameMode}
          playerColor={playerColor}
          difficultyKey={difficultyKey}
          difficultyLevels={DIFFICULTY_LEVELS}
          onModeChange={handleModeChange}
          onColorChange={handleColorChange}
          onDifficultyChange={handleDifficultyChange}
          onReset={() => resetGame()}
        />

        <GameInfo
          gameMode={gameMode}
          playerLabel={getColorLabel(playerColor)}
          computerLabel={getColorLabel(computerColor)}
          turnLabel={getColorLabel(game.turn())}
          difficultyLabel={difficulty.label}
          currentSearchDepth={currentSearchDepth}
        />

        <MoveHistory turns={groupedMoveHistory} />
      </aside>
    </main>
  )
}

export default App
