/**
 * @file components/GameHeader.jsx
 * @description 游戏顶部状态区组件
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 显示游戏状态信息：
 * - 标题
 * - 当前状态文案（轮到谁、将军、将死等）
 * - 和棋提示（和棋原因说明）
 *
 * ============================================================================
 * 组件设计
 * ============================================================================
 *
 * 这是一个纯展示组件（Presentational Component）：
 * - 只接收 props，不管理状态
 * - 完全由父组件 (App.jsx) 控制显示内容
 */

import PropTypes from 'prop-types'

/**
 * 游戏顶部状态区组件
 *
 * @param {Object} props
 * @param {string} props.statusText - 状态文案
 * @param {string|null} props.drawNotice - 和棋提示文案
 *
 * @returns {JSX.Element}
 */
export default function GameHeader({ statusText, drawNotice }) {
  return (
    <>
      {/* 标题行 */}
      <div className="panel-header">
        <div>
          <p className="eyebrow">国际象棋</p>
        </div>

        {/* 状态信息堆叠 */}
        <div className="status-stack">
          {/* 主要状态提示 */}
          <p className="status-pill">{statusText}</p>
        </div>
      </div>

      {/* 和棋提示 - 仅在和棋时显示 */}
      {drawNotice ? <p className="draw-notice">{drawNotice}</p> : null}
    </>
  )
}

/**
 * 属性类型定义
 */
GameHeader.propTypes = {
  /** 状态文案，如"轮到你走，你执白方。当前被将军。" */
  statusText: PropTypes.string.isRequired,
  /** 和棋原因文案，null 表示不是和棋 */
  drawNotice: PropTypes.string,
}

/**
 * 默认属性值
 */
GameHeader.defaultProps = {
  drawNotice: null,
}
