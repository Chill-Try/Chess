/**
 * @file lib/workerUtils.js
 * @description Worker 分片与数量策略工具
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 提供 Worker 相关的辅助函数：
 *
 * 1. chunkMoves - 将走法列表分片
 *    - 用于并行计算时分配任务
 *
 * 2. getWorkerCount - 计算 Worker 数量
 *    - 根据硬件并发能力确定
 *    - 限制在合理范围内
 *
 * 这些函数被 useComputerMove.js 使用
 */

/**
 * 将走法列表分片
 *
 * @param {Object[]} moves - 走法列表
 * @param {number} chunkCount - 分片数量
 * @returns {Object[][]} 分片后的走法数组
 *
 * @example
 * // 将 10 个走法分成 3 组
 * chunkMoves(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 3)
 * // 结果: [['a','d','g','j'], ['b','e','h'], ['c','f','i']]
 *
 * 算法：
 * - 创建 chunkCount 个空数组
 * - 循环遍历走法，使用取模分散到各组
 * - 过滤掉空数组
 *
 * 注意：
 * - 如果 chunkCount > moves.length，结果会包含空数组（被过滤）
 */
export function chunkMoves(moves, chunkCount) {
  // 初始化分片数组
  const chunks = Array.from({ length: chunkCount }, () => [])

  // 分配走法到各分片
  moves.forEach((move, index) => {
    chunks[index % chunkCount].push(move)
  })

  // 移除空分片
  return chunks.filter((chunk) => chunk.length > 0)
}

/**
 * 获取 Worker 数量
 *
 * 根据硬件并发能力计算合适的 Worker 数量
 *
 * @returns {number} Worker 数量
 *
 * 计算逻辑：
 * 1. 如果无法获取 hardwareConcurrency（服务端环境），返回 2
 * 2. 获取硬件线程数
 * 3. 计算：hardwareConcurrency - 1，限制在 [2, 4] 范围内
 *
 * 设计理由：
 * - 预留一个线程给主线程
 * - 最多 4 个 Worker，避免过度并行化
 * - 最少 2 个 Worker，保证基本并行
 *
 * @example
 * // 8 核 CPU -> 7 -> min(max(7,2),4) = 4
 * // 4 核 CPU -> 3 -> min(max(3,2),4) = 3
 * // 2 核 CPU -> 1 -> min(max(1,2),4) = 2
 */
export function getWorkerCount() {
  // 服务端环境（Node.js）
  if (typeof navigator === 'undefined') {
    return 2
  }

  // 获取硬件线程数
  const hardwareThreads = navigator.hardwareConcurrency ?? 4

  // 限制在 [2, 4] 范围内
  return Math.min(Math.max(hardwareThreads - 1, 2), 4)
}