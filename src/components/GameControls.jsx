/**
 * @file components/GameControls.jsx
 * @description 角色配置面板组件
 *
 * 提供双方角色与附加配置界面：
 * - 我方角色：玩家 / 电脑 / AI 模型
 * - 敌方角色：玩家 / 电脑 / AI 模型
 * - 电脑角色显示独立难度选择
 * - AI 模型角色显示独立配置表单
 */

import PropTypes from 'prop-types'
import { useState } from 'react'

const ROLE_OPTIONS = [
  { key: 'player', label: '玩家' },
  { key: 'computer', label: '电脑' },
  { key: 'aiModel', label: 'AI 模型' },
]

function DifficultySection({ title, difficultyLevels, activeKey, onChange, disabled = false }) {
  return (
    <div className="role-config-section">
      <h4>{title}</h4>
      <div className="difficulty-grid">
        {difficultyLevels.map((level) => (
          <button
            key={level.key}
            className={`${activeKey === level.key ? 'active' : ''}${disabled ? ' difficulty-button-disabled' : ''}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level.key)}
          >
            {level.label}
          </button>
        ))}
      </div>
    </div>
  )
}

DifficultySection.propTypes = {
  title: PropTypes.string.isRequired,
  difficultyLevels: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeKey: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

function AiConfigSection({ title, config, onChange }) {
  const [showApiKey, setShowApiKey] = useState(false)

  return (
    <div className="role-config-section">
      <h4>{title}</h4>
      <div className="config-form-grid">
        <label className="config-field">
          <span>请求 URL</span>
          <input
            type="text"
            value={config.requestUrl}
            onChange={(event) => onChange('requestUrl', event.target.value)}
            placeholder="例：https://api.example.com/v1"
          />
        </label>

        <label className="config-field">
          <span>接口类型</span>
          <select
            value={config.provider}
            onChange={(event) => onChange('provider', event.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>

        <label className="config-field">
          <span>API 密钥</span>
          <div className="password-field">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(event) => onChange('apiKey', event.target.value)}
              placeholder="例：sk-XXXXXXXX"
              autoComplete="new-password"
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={showApiKey ? '隐藏 API 密钥' : '显示 API 密钥'}
              onClick={() => setShowApiKey((current) => !current)}
            >
              {showApiKey ? '🙈' : '👁'}
            </button>
          </div>
        </label>

        <label className="config-field">
          <span>模型名称</span>
          <input
            type="text"
            value={config.modelName}
            onChange={(event) => onChange('modelName', event.target.value)}
            placeholder="例：deepseek-v4-flash"
          />
        </label>
      </div>
    </div>
  )
}

AiConfigSection.propTypes = {
  title: PropTypes.string.isRequired,
  config: PropTypes.shape({
    provider: PropTypes.oneOf(['openai', 'anthropic']).isRequired,
    requestUrl: PropTypes.string.isRequired,
    apiKey: PropTypes.string.isRequired,
    modelName: PropTypes.string.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
}

function RoleCard({
  title,
  role,
  onRoleChange,
}) {
  return (
    <div className="card control-section role-card">
      <h3>{title}</h3>
      <div className="role-button-grid">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.key}
            className={role === option.key ? 'active' : ''}
            type="button"
            onClick={() => onRoleChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

RoleCard.propTypes = {
  title: PropTypes.string.isRequired,
  role: PropTypes.oneOf(['player', 'computer', 'aiModel']).isRequired,
  onRoleChange: PropTypes.func.isRequired,
}

function RoleRow({
  title,
  role,
  difficultyLevels,
  computerDifficultyKey,
  aiConfig,
  isDifficultyPending = false,
  onRoleChange,
  onComputerDifficultyChange,
  onAiConfigChange,
}) {
  const sidePanel =
    role === 'computer' ? (
      <DifficultySection
        title={`${title}难度`}
        difficultyLevels={difficultyLevels}
        activeKey={computerDifficultyKey}
        disabled={isDifficultyPending}
        onChange={onComputerDifficultyChange}
      />
    ) : role === 'aiModel' ? (
      <AiConfigSection
        title={`${title} AI 模型配置`}
        config={aiConfig}
        onChange={onAiConfigChange}
      />
    ) : null

  return (
    <div className="role-row">
      <RoleCard title={title} role={role} onRoleChange={onRoleChange} />
      {sidePanel ? <div className="card role-side-panel">{sidePanel}</div> : null}
    </div>
  )
}

RoleRow.propTypes = {
  title: PropTypes.string.isRequired,
  role: PropTypes.oneOf(['player', 'computer', 'aiModel']).isRequired,
  difficultyLevels: DifficultySection.propTypes.difficultyLevels,
  computerDifficultyKey: PropTypes.string.isRequired,
  aiConfig: AiConfigSection.propTypes.config,
  isDifficultyPending: PropTypes.bool,
  onRoleChange: PropTypes.func.isRequired,
  onComputerDifficultyChange: PropTypes.func.isRequired,
  onAiConfigChange: PropTypes.func.isRequired,
}

export default function GameControls({
  mySideRole,
  opponentSideRole,
  myComputerDifficultyKey,
  opponentComputerDifficultyKey,
  difficultyLevels,
  myAiConfig,
  opponentAiConfig,
  isDifficultyPending = false,
  onMySideRoleChange,
  onOpponentSideRoleChange,
  onMyComputerDifficultyChange,
  onOpponentComputerDifficultyChange,
  onMyAiConfigChange,
  onOpponentAiConfigChange,
}) {
  return (
    <div className="role-columns">
      <RoleRow
        title="敌方"
        role={opponentSideRole}
        difficultyLevels={difficultyLevels}
        computerDifficultyKey={opponentComputerDifficultyKey}
        aiConfig={opponentAiConfig}
        isDifficultyPending={isDifficultyPending}
        onRoleChange={onOpponentSideRoleChange}
        onComputerDifficultyChange={onOpponentComputerDifficultyChange}
        onAiConfigChange={onOpponentAiConfigChange}
      />

      <RoleRow
        title="我方"
        role={mySideRole}
        difficultyLevels={difficultyLevels}
        computerDifficultyKey={myComputerDifficultyKey}
        aiConfig={myAiConfig}
        isDifficultyPending={isDifficultyPending}
        onRoleChange={onMySideRoleChange}
        onComputerDifficultyChange={onMyComputerDifficultyChange}
        onAiConfigChange={onMyAiConfigChange}
      />
    </div>
  )
}

GameControls.propTypes = {
  mySideRole: PropTypes.oneOf(['player', 'computer', 'aiModel']).isRequired,
  opponentSideRole: PropTypes.oneOf(['player', 'computer', 'aiModel']).isRequired,
  myComputerDifficultyKey: PropTypes.string.isRequired,
  opponentComputerDifficultyKey: PropTypes.string.isRequired,
  difficultyLevels: DifficultySection.propTypes.difficultyLevels,
  myAiConfig: AiConfigSection.propTypes.config,
  opponentAiConfig: AiConfigSection.propTypes.config,
  isDifficultyPending: PropTypes.bool,
  onMySideRoleChange: PropTypes.func.isRequired,
  onOpponentSideRoleChange: PropTypes.func.isRequired,
  onMyComputerDifficultyChange: PropTypes.func.isRequired,
  onOpponentComputerDifficultyChange: PropTypes.func.isRequired,
  onMyAiConfigChange: PropTypes.func.isRequired,
  onOpponentAiConfigChange: PropTypes.func.isRequired,
}
