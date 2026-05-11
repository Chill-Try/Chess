/**
 * @file components/MoveHistory.jsx
 * @description 行棋记录展示组件
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 以回合制形式展示走棋历史：
 * - 每行显示一个回合
 * - 包含白方和黑方的走法
 * - 空局面显示提示文字
 *
 * ============================================================================
 * 数据格式
 * ============================================================================
 *
 * 期望的 turns 数组格式：
 * [
 *   { moveNumber: 1, white: 'e4', black: 'e5' },
 *   { moveNumber: 2, white: 'Nf3', black: 'Nc6' },
 *   ...
 * ]
 *
 * - moveNumber: 回合编号（从1开始）
 * - white: 白方走法（字符串或空字符串）
 * - black: 黑方走法（字符串或空字符串）
 *
 * ============================================================================
 * 组件设计
 * ============================================================================
 *
 * 纯展示组件：
 * - 接收预处理后的 turns 数据
 * - 数据转换由父组件 App.jsx 中的 groupMovesByTurn() 完成
 */

import PropTypes from 'prop-types'
import { useLayoutEffect, useRef } from 'react'
import { scrollMoveHistoryToBottom } from '../lib/moveHistoryScroll'

/**
 * 行棋记录展示组件
 *
 * @param {Object} props
 * @param {Object[]} props.turns - 按回合分组的走法列表
 *
 * @returns {JSX.Element}
 *
 * @example
 * // 空局面
 * <MoveHistory turns={[]} />
 * // 输出: "对局尚未开始。"
 *
 * @example
 * // 有走法
 * <MoveHistory turns={[{ moveNumber: 1, white: 'e4', black: 'e5' }]} />
 * // 输出:
 * // 1. e4  e5
 */
export default function MoveHistory({ turns }) {
  const listRef = useRef(null)

  useLayoutEffect(() => {
    scrollMoveHistoryToBottom(listRef.current)
  }, [turns])

  return (
    <section className="card moves-card">
      <h2>行棋记录</h2>

      {/* 走法列表 */}
      <ol className="moves-list" ref={listRef}>
        {/* 空局面提示 */}
        {turns.length === 0 ? <li>对局尚未开始。</li> : null}

        {/* 渲染每一回合 */}
        {turns.map((turn) => (
          <li key={turn.moveNumber}>
            {/* 回合编号 */}
            <span className="move-index">{turn.moveNumber}.</span>

            {/* 白黑走法对 */}
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

/**
 * 属性类型定义
 */
MoveHistory.propTypes = {
  /**
   * 按回合分组的走法列表
   * @type {Array<{moveNumber: number, white: string, black: string}>}
   */
  turns: PropTypes.arrayOf(
    PropTypes.shape({
      /** 回合编号 */
      moveNumber: PropTypes.number.isRequired,
      /** 白方走法 */
      white: PropTypes.string,
      /** 黑方走法 */
      black: PropTypes.string,
    })
  ).isRequired,
}
