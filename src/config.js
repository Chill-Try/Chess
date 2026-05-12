/**
 * @file config.js
 * @description 基础配置
 */

export const SOUND_CONFIG = {
  moveVariation: {
    // 普通落子主音高的轻微随机幅度，按比例生效；0 表示关闭
    baseFreq: 0.03,
    // 普通落子起音噪声频率的轻微随机幅度，按比例生效；0 表示关闭
    noiseFreq: 0.04,
    // 普通落子总时长的轻微随机幅度，按比例生效；0 表示关闭
    duration: 0.03,
    // 普通落子音量峰值的轻微随机幅度，按比例生效；0 表示关闭
    peakGain: 0.025,
  },
}
