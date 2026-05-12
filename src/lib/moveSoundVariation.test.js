import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMoveSoundVariation } from './moveSoundVariation.js'

const baseParams = {
  baseFreq: 400,
  noiseFreq: 1200,
  noiseQ: 3,
  noiseDuration: 0.05,
  duration: 0.18,
  attackTime: 0.003,
  peakGain: 0.4,
}

test('扰动配置为 0 时返回原始参数', () => {
  const varied = applyMoveSoundVariation(baseParams, {
    baseFreq: 0,
    noiseFreq: 0,
    duration: 0,
    peakGain: 0,
  }, () => 0.9)

  assert.deepEqual(varied, baseParams)
})

test('扰动只影响普通落子相关的四个参数且幅度受配置限制', () => {
  const varied = applyMoveSoundVariation(baseParams, {
    baseFreq: 0.1,
    noiseFreq: 0.2,
    duration: 0.05,
    peakGain: 0.1,
  }, () => 1)

  assert.equal(varied.baseFreq, 440)
  assert.equal(varied.noiseFreq, 1440)
  assert.equal(varied.duration, 0.189)
  assert.equal(varied.peakGain, 0.44)
  assert.equal(varied.noiseQ, baseParams.noiseQ)
  assert.equal(varied.noiseDuration, baseParams.noiseDuration)
  assert.equal(varied.attackTime, baseParams.attackTime)
})
