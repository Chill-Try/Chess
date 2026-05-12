function getRandomScale(amount, random) {
  if (!amount) return 1
  const centered = random() * 2 - 1
  return 1 + centered * amount
}

export function applyMoveSoundVariation(params, variationConfig, random = Math.random) {
  if (!variationConfig) {
    return { ...params }
  }

  return {
    ...params,
    baseFreq: params.baseFreq * getRandomScale(variationConfig.baseFreq, random),
    noiseFreq: params.noiseFreq * getRandomScale(variationConfig.noiseFreq, random),
    duration: params.duration * getRandomScale(variationConfig.duration, random),
    peakGain: params.peakGain * getRandomScale(variationConfig.peakGain, random),
  }
}
