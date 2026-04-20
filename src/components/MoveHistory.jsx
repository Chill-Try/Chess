export default function MoveHistory({ turns }) {
  return (
    <section className="card moves-card">
      <h2>走棋记录</h2>
      <ol className="moves-list">
        {turns.length === 0 ? <li>对局尚未开始。</li> : null}
        {turns.map((turn) => (
          <li key={turn.moveNumber}>
            <span className="move-index">{turn.moveNumber}.</span>
            <span className="move-pair">
              <span>{turn.white || '-'}</span>
              <span>{turn.black || '-'}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
