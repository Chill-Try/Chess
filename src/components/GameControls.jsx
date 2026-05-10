/**
 * @file components/GameControls.jsx
 * @description 游戏控制面板组件
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 提供游戏控制界面：
 * - 模式切换：人机模式 / 双人模式
 * - 颜色选择：执白先行 / 执黑后行
 * - 难度选择：新手 / 中等 / 困难 / 大师（仅人机模式显示）
 * - 重新开始按钮
 *
 * ============================================================================
 * 组件设计
 * ============================================================================
 *
 * 纯展示组件：
 * - 所有交互通过回调函数传递给父组件处理
 * - 不直接管理任何状态
 * - 所有状态由 App.jsx 持有
 */

import PropTypes from 'prop-types'

/**
 * 游戏控制面板组件
 *
 * @param {Object} props
 * @param {string} props.gameMode - 当前游戏模式 ('computer'/'twoPlayer')
 * @param {string} props.playerColor - 玩家执棋颜色 ('w'/'b')
 * @param {string} props.difficultyKey - 当前难度键值
 * @param {Object[]} props.difficultyLevels - 难度等级列表
 * @param {Function} props.onModeChange - 模式切换回调
 * @param {Function} props.onColorChange - 颜色切换回调
 * @param {Function} props.onDifficultyChange - 难度切换回调
 * @param {Function} props.onReset - 重新开始回调
 *
 * @returns {JSX.Element}
 */
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

      {/* ========== 模式切换 ========== */}
      <div className="button-row mode-row">
        {/* 人机模式按钮 */}
        <button
          className={gameMode === 'computer' ? 'active' : ''}
          type="button"
          onClick={() => onModeChange('computer')}
        >
          人机模式
        </button>

        {/* 双人模式按钮 */}
        <button
          className={gameMode === 'twoPlayer' ? 'active' : ''}
          type="button"
          onClick={() => onModeChange('twoPlayer')}
        >
          双人模式
        </button>
      </div>

      {/* ========== 颜色选择 ========== */}
      <div className="button-row">
        {/* 执白按钮 */}
        <button
          className={playerColor === 'w' ? 'active' : ''}
          type="button"
          onClick={() => onColorChange('w')}
        >
          执白先行
        </button>

        {/* 执黑按钮 */}
        <button
          className={playerColor === 'b' ? 'active' : ''}
          type="button"
          onClick={() => onColorChange('b')}
        >
          执黑后行
        </button>
      </div>

      {/* ========== 重新开始按钮 ========== */}
      <button className="primary-button" type="button" onClick={onReset}>
        重新开始
      </button>

      {/* ========== 难度选择（仅人机模式显示）========== */}
      {gameMode === 'computer' ? (
        <div className="difficulty-section">
          <h3>难度</h3>

          {/* 难度网格 */}
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

/**
 * 属性类型定义
 */
GameControls.propTypes = {
  /** 游戏模式 */
  gameMode: PropTypes.oneOf(['computer', 'twoPlayer']).isRequired,
  /** 玩家执棋颜色 */
  playerColor: PropTypes.oneOf(['w', 'b']).isRequired,
  /** 当前难度键值 */
  difficultyKey: PropTypes.string.isRequired,
  /** 难度等级列表 */
  difficultyLevels: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  /** 模式切换回调 */
  onModeChange: PropTypes.func.isRequired,
  /** 颜色切换回调 */
  onColorChange: PropTypes.func.isRequired,
  /** 难度切换回调 */
  onDifficultyChange: PropTypes.func.isRequired,
  /** 重新开始回调 */
  onReset: PropTypes.func.isRequired,
}