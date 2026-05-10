/**
 * @file components/GameInfo.jsx
 * @description 对局信息展示组件
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 显示当前对局的详细信息：
 * - 玩家方（你方）
 * - 电脑方
 * - 当前行棋方
 * - 当前难度
 * - 当前搜索深度
 *
 * ============================================================================
 * 组件设计
 * ============================================================================
 *
 * 展示组件特性：
 * - 仅在人机模式下显示（双人模式返回 null）
 * - 完全由 props 驱动
 * - 父组件 App.jsx 计算所有显示数据
 */

import PropTypes from 'prop-types'

/**
 * 对局信息展示组件
 *
 * @param {Object} props
 * @param {string} props.gameMode - 游戏模式
 * @param {string} props.playerLabel - 玩家方标签（如"白方"）
 * @param {string} props.computerLabel - 电脑方标签
 * @param {string} props.turnLabel - 当前行棋方标签
 * @param {string} props.difficultyLabel - 难度标签
 * @param {number} props.currentSearchDepth - 当前搜索深度
 *
 * @returns {JSX.Element|null}
 *
 * 注意：双人模式时返回 null，不渲染任何内容
 */
export default function GameInfo({
  gameMode,
  playerLabel,
  computerLabel,
  turnLabel,
  difficultyLabel,
  currentSearchDepth,
}) {
  // 仅在人机模式下显示
  if (gameMode !== 'computer') {
    return null
  }

  return (
    <section className="card info-card">
      <h2>对局信息</h2>

      {/* 信息定义列表 */}
      <dl className="info-grid">
        {/* 玩家方 */}
        <div>
          <dt>你方</dt>
          <dd>{playerLabel}</dd>
        </div>

        {/* 电脑方 */}
        <div>
          <dt>电脑</dt>
          <dd>{computerLabel}</dd>
        </div>

        {/* 当前行棋方 */}
        <div>
          <dt>当前行棋</dt>
          <dd>{turnLabel}</dd>
        </div>

        {/* 当前难度 */}
        <div>
          <dt>当前难度</dt>
          <dd>{difficultyLabel}</dd>
        </div>

        {/* 当前搜索深度 */}
        <div>
          <dt>当前深度</dt>
          <dd>{currentSearchDepth}</dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * 属性类型定义
 */
GameInfo.propTypes = {
  /** 游戏模式 */
  gameMode: PropTypes.oneOf(['computer', 'twoPlayer']).isRequired,
  /** 玩家方标签 */
  playerLabel: PropTypes.string.isRequired,
  /** 电脑方标签 */
  computerLabel: PropTypes.string.isRequired,
  /** 当前行棋方标签 */
  turnLabel: PropTypes.string.isRequired,
  /** 难度标签 */
  difficultyLabel: PropTypes.string.isRequired,
  /** 当前搜索深度 */
  currentSearchDepth: PropTypes.number.isRequired,
}