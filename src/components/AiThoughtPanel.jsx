import PropTypes from 'prop-types'

function getDisplayText(value, fallback = '-') {
  return value?.trim() ? value : fallback
}

function getStatusClassName(status) {
  if (status === '思考中') {
    return 'is-thinking'
  }

  if (status === '已完成') {
    return 'is-complete'
  }

  if (status === '出错') {
    return 'is-error'
  }

  return 'is-idle'
}

export default function AiThoughtPanel({ state }) {
  const { status, modelName, thought, move, error } = state
  const titleModelName = getDisplayText(modelName, '未设置模型')
  const statusText = error ? `${status}：${error}` : status

  return (
    <section className="card ai-thought-card">
      <div className="ai-thought-header">
        <h2>{`AI (${titleModelName})`}</h2>
        <span className={`ai-thought-status ${getStatusClassName(status)}`}>
          {statusText}
        </span>
      </div>

      <dl className="ai-thought-list">
        <div className="ai-thought-item">
          <dt>思考</dt>
          <dd className="ai-thought-text">{getDisplayText(thought, '暂无')}</dd>
        </div>

        <div className="ai-thought-item">
          <dt>走法</dt>
          <dd>{getDisplayText(move, '暂无')}</dd>
        </div>
      </dl>
    </section>
  )
}

AiThoughtPanel.propTypes = {
  state: PropTypes.shape({
    status: PropTypes.string.isRequired,
    modelName: PropTypes.string.isRequired,
    thought: PropTypes.string.isRequired,
    move: PropTypes.string.isRequired,
    error: PropTypes.string.isRequired,
  }).isRequired,
}
