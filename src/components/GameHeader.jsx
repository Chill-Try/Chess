export default function GameHeader({ statusText, isComputerThinking, drawNotice }) {
  return (
    <>
      <div className="panel-header">
        <div>
          <p className="eyebrow">国际象棋</p>
        </div>
        <div className="status-stack">
          <p className="status-pill">{statusText}</p>
          <p className={`thinking-pill${isComputerThinking ? '' : ' hidden'}`}>电脑思考中...</p>
        </div>
      </div>

      {drawNotice ? <p className="draw-notice">{drawNotice}</p> : null}
    </>
  )
}
