import PropTypes from 'prop-types'

export default function OpeningActions({ playerColor, onColorChange, onReset }) {
  return (
    <section className="card opening-actions-card">
      <h2>开局操作</h2>

      <div className="button-row">
        <button
          className={playerColor === 'w' ? 'active' : ''}
          type="button"
          onClick={() => onColorChange('w')}
        >
          执白先行
        </button>

        <button
          className={playerColor === 'b' ? 'active' : ''}
          type="button"
          onClick={() => onColorChange('b')}
        >
          执黑后行
        </button>
      </div>

      <button className="primary-button" type="button" onClick={onReset}>
        重新开始
      </button>
    </section>
  )
}

OpeningActions.propTypes = {
  playerColor: PropTypes.oneOf(['w', 'b']).isRequired,
  onColorChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
}
