import PropTypes from 'prop-types'

export default function BoardSideStatus({
  label,
  detail,
  isThinking = false,
  isActive = false,
  thinkingText = '正在思考中。。。',
  align = 'center',
}) {
  return (
    <div className={`board-side-status-shell${isActive ? ' active' : ' inactive'}`}>
      <div className={`board-side-status board-side-status-${align}${isActive ? ' active' : ' inactive'}`}>
        <div className="board-side-status-content">
          <span className="board-side-label">{label}</span>
          <span className={`board-side-thinking${isThinking ? ' visible' : ''}`}>
            {isThinking ? thinkingText : ''}
          </span>
          <strong className="board-side-detail">{detail}</strong>
        </div>
      </div>
    </div>
  )
}

BoardSideStatus.propTypes = {
  label: PropTypes.string.isRequired,
  detail: PropTypes.string.isRequired,
  isThinking: PropTypes.bool,
  isActive: PropTypes.bool,
  thinkingText: PropTypes.string,
  align: PropTypes.oneOf(['start', 'center', 'end']),
}

BoardSideStatus.defaultProps = {
  isThinking: false,
  isActive: false,
  thinkingText: '正在思考中。。。',
  align: 'center',
}
