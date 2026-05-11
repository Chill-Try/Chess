/**
 * @file components/GameInfo.jsx
 * @description 对局信息展示组件
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 显示当前对局的详细信息：
 * - 我方角色
 * - 敌方角色
 * - 当前发散程度
 * - 当前搜索深度
 *
 * ============================================================================
 * 组件设计
 * ============================================================================
 *
 * 展示组件特性：
 * - 当任意一方选择电脑时显示
 * - 完全由 props 驱动
 * - 父组件 App.jsx 计算所有显示数据
 */

import PropTypes from 'prop-types'

/**
 * 对局信息展示组件
 *
 * @param {Object} props
 * @param {boolean} props.hasComputerSide - 是否存在电脑角色
 * @param {string} props.mySideSummary - 我方摘要
 * @param {string} props.opponentSideSummary - 敌方摘要
 * @param {string} props.currentDispersionLabel - 当前发散程度标签
 * @param {string} props.currentSearchDepthLabel - 当前搜索深度标签
 *
 * @returns {JSX.Element|null}
 *
 * 注意：没有电脑角色时返回 null，不渲染任何内容
 */
export default function GameInfo({
  hasComputerSide,
  mySideSummary,
  opponentSideSummary,
  currentDispersionLabel,
  currentSearchDepthLabel,
}) {
  if (!hasComputerSide) {
    return null
  }

  return (
    <section className="card info-card">
      <h2>对局信息</h2>

      {/* 信息定义列表 */}
      <dl className="info-grid">
        {/* 我方 */}
        <div>
          <dt>我方</dt>
          <dd>{mySideSummary}</dd>
        </div>

        {/* 敌方 */}
        <div>
          <dt>敌方</dt>
          <dd>{opponentSideSummary}</dd>
        </div>

        {/* 当前发散程度 */}
        <div>
          <dt>当前发散程度</dt>
          <dd>{currentDispersionLabel}</dd>
        </div>

        {/* 当前搜索深度 */}
        <div>
          <dt>当前深度</dt>
          <dd>{currentSearchDepthLabel}</dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * 属性类型定义
 */
GameInfo.propTypes = {
  /** 是否存在电脑角色 */
  hasComputerSide: PropTypes.bool.isRequired,
  /** 我方摘要 */
  mySideSummary: PropTypes.string.isRequired,
  /** 敌方摘要 */
  opponentSideSummary: PropTypes.string.isRequired,
  /** 当前发散程度标签 */
  currentDispersionLabel: PropTypes.string.isRequired,
  /** 当前搜索深度标签 */
  currentSearchDepthLabel: PropTypes.string.isRequired,
}
