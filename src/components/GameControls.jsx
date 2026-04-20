export default function GameControls({
  gameMode,
  playerColor,
  difficultyKey,
  difficultyLevels,
  onModeChange,
  onColorChange,
  onDifficultyChange,
  onReset,
}) {
  return (
    <section className="card controls-card">
      <h2>对局控制</h2>
      <div className="button-row mode-row">
        <button className={gameMode === 'computer' ? 'active' : ''} type="button" onClick={() => onModeChange('computer')}>
          人机模式
        </button>
        <button className={gameMode === 'twoPlayer' ? 'active' : ''} type="button" onClick={() => onModeChange('twoPlayer')}>
          双人模式
        </button>
      </div>
      <div className="button-row">
        <button className={playerColor === 'w' ? 'active' : ''} type="button" onClick={() => onColorChange('w')}>
          执白先行
        </button>
        <button className={playerColor === 'b' ? 'active' : ''} type="button" onClick={() => onColorChange('b')}>
          执黑后行
        </button>
      </div>
      <button className="primary-button" type="button" onClick={onReset}>
        重新开始
      </button>

      {gameMode === 'computer' ? (
        <div className="difficulty-section">
          <h3>难度</h3>
          <div className="difficulty-grid">
            {difficultyLevels.map((level) => (
              <button
                key={level.key}
                className={difficultyKey === level.key ? 'active' : ''}
                type="button"
                onClick={() => onDifficultyChange(level.key)}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
