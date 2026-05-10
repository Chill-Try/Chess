/**
 * @file components/SoundSettings.jsx
 * @description 音效设置面板组件
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 提供音效设置界面：
 * - 音效风格选择（电子/木质/游戏）
 * - 音量调节滑块
 * - 静音开关
 *
 * ============================================================================
 * 组件设计
 * ============================================================================
 *
 * 纯展示组件，通过回调与父组件通信：
 * - onStyleChange: 风格切换回调
 * - onVolumeChange: 音量调节回调
 * - onMuteToggle: 静音切换回调
 */

import PropTypes from 'prop-types'
import { soundManager, SoundStyle, SoundStyleLabels, playMoveSound } from '../lib/soundManager'

/**
 * 音效设置面板组件
 *
 * @param {Object} props
 * @param {string} props.style - 当前音效风格
 * @param {number} props.volume - 当前音量 (0-1)
 * @param {boolean} props.muted - 是否静音
 * @param {Function} props.onStyleChange - 风格切换回调
 * @param {Function} props.onVolumeChange - 音量调节回调
 * @param {Function} props.onMuteToggle - 静音切换回调
 *
 * @returns {JSX.Element}
 */
export default function SoundSettings({
  style,
  volume,
  muted,
  onStyleChange,
  onVolumeChange,
  onMuteToggle,
}) {
  return (
    <section className="card sound-card">
      <h2>音效设置</h2>

      {/* 风格选择 */}
      <div className="sound-style-section">
        <h3>音效风格</h3>
        <div className="style-buttons">
          {Object.values(SoundStyle).map((s) => (
            <button
              key={s}
              type="button"
              className={`style-button ${style === s ? 'active' : ''}`}
              onClick={() => {
                // 先切换风格，再播放预览音效
                soundManager.setStyle(s)
                playMoveSound()
                onStyleChange(s)
              }}
            >
              {SoundStyleLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 音量控制 */}
      <div className="volume-section">
        <h3>
          音量
          <button
            type="button"
            className="mute-button"
            onClick={onMuteToggle}
            title={muted ? '取消静音' : '静音'}
          >
            {muted ? '🔇' : volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
        </h3>
        <div className="volume-slider-container">
          <input
            type="range"
            min="0"
            max="100"
            value={muted ? 0 : volume * 100}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            className="volume-slider"
            disabled={muted}
          />
          <span className="volume-value">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </section>
  )
}

/**
 * 属性类型定义
 */
SoundSettings.propTypes = {
  /** 当前音效风格 */
  style: PropTypes.oneOf(Object.values(SoundStyle)).isRequired,
  /** 当前音量 (0-1) */
  volume: PropTypes.number.isRequired,
  /** 是否静音 */
  muted: PropTypes.bool.isRequired,
  /** 风格切换回调 */
  onStyleChange: PropTypes.func.isRequired,
  /** 音量调节回调 */
  onVolumeChange: PropTypes.func.isRequired,
  /** 静音切换回调 */
  onMuteToggle: PropTypes.func.isRequired,
}