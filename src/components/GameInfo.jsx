export default function GameInfo({ gameMode, playerLabel, computerLabel, turnLabel, difficultyLabel, currentSearchDepth }) {
  if (gameMode !== 'computer') {
    return null
  }

  return (
    <section className="card info-card">
      <h2>对局信息</h2>
      <dl className="info-grid">
        <div>
          <dt>你方</dt>
          <dd>{playerLabel}</dd>
        </div>
        <div>
          <dt>电脑</dt>
          <dd>{computerLabel}</dd>
        </div>
        <div>
          <dt>当前行棋</dt>
          <dd>{turnLabel}</dd>
        </div>
        <div>
          <dt>当前难度</dt>
          <dd>{difficultyLabel}</dd>
        </div>
        <div>
          <dt>当前深度</dt>
          <dd>{currentSearchDepth}</dd>
        </div>
      </dl>
    </section>
  )
}
