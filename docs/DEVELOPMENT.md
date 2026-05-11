# 开发指南

## 环境要求

- Node.js 18+
- npm 9+

## 本地运行

```bash
npm install
npm run dev
```

默认由 Vite 启动本地开发服务。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run lint` | 运行 ESLint |
| `npm run build` | 构建生产包 |
| `npm run preview` | 预览生产构建 |

## 代码组织建议

### 改 UI 时

优先看这些文件：

- `src/App.jsx`
- `src/components/`
- `src/App.css`
- `src/index.css`

如果只是新增侧栏展示或按钮，优先放到现有展示组件中，而不是把 JSX 再塞回 `App.jsx`。

### 改棋局辅助逻辑时

优先放到 `src/lib/`：

- `gameState.js`：棋局副本、走法应用、将军相关辅助、非法拖拽模拟、当前行棋方校验
- `gameStatus.js`：展示文案、行棋记录整理
- `workerUtils.js`：Worker 数量与任务分片
- `soundManager.js`：音效管理（Web Audio API）

### 改电脑走棋调度时

优先看 `src/hooks/useComputerMove.js`：

- Worker 初始化与销毁
- 请求取消
- 普通 AI / Stockfish 分发
- Stockfish 失败降级逻辑
- 思考中状态

如果修改的是 AI 强度、评估或候选走法策略，再进入 `src/chess-ai.js`。

### 改 AI 难度时

优先看这些位置：

- `src/ai/config.js`：`DIFFICULTY_LEVELS`、基础 AI 配置
- `src/ai/search.js`：`getCurrentSearchDepth()`、搜索深度策略
- `src/ai/moveScoring.js`：`getCandidateMoves()` 依赖的开局过滤与单步启发式
- `src/chess-ai.js`：AI 聚合入口与评分主流程
- `src/stockfishWorker.js`：Stockfish 实际执行参数

当前困难模式的真实链路是：

1. `src/ai/config.js` 中 `hard.engine = 'stockfish'`
2. `src/hooks/useComputerMove.js` 检测到该引擎类型后走 `stockfishWorker.js`
3. `src/stockfishWorker.js` 中 `hard` 配置实际执行：
   - `depth = 8`
   - `limitStrength = true`
   - `elo = 1700`

因此困难模式本质上是 **Stockfish 深度 8 + 限强到约 ELO 1700**，不是普通 minimax 搜索。

### 改自定义 AI 逻辑时

按职责优先看这些模块：

- `src/ai/boardUtils.js`：底层棋盘查询、攻守与威胁分析
- `src/ai/evaluation.js`：静态局面评估
- `src/ai/moveScoringShared.js`：阶段判断、易位与共享开局规则
- `src/ai/moveScoring.js`：候选走法过滤、战术/安全性附加分
- `src/ai/search.js`：搜索深度、排序、`minimax()`、转置表
- `src/ai/trapBook.js`：中局战术陷阱检测
- `src/chess-ai.js`：仅保留对外 API 与主流程组装

### 改音效系统时

优先看 `src/lib/soundManager.js`：

- 使用 Web Audio API 实时合成，无需外部文件
- 音效参数配置在 `SOUND_PARAMS` 常量中
- 支持三种风格（electronic、wooden、game）
- 三种音效类型（move、check、checkmate）

音效实现原理：

- 使用 `OscillatorNode` 创建振荡器
- 使用 `GainNode` 控制音量包络（ADSR）
- 使用 `BiquadFilter` 添加音色滤波
- 落子音：单音短促
- 将军音：双音错位增加紧迫感
- 将死音：和弦三音（根音、五度、八度）

### 改拖拽与非法走子反馈时

优先看这些位置：

- `src/App.jsx`
  - `handlePieceDrag()`：开始拖拽时的当前行棋方校验、绿色合法落点高亮
  - `handlePieceDrop()`：合法落子、非法回弹、暴露己王警告入口
  - `triggerWarningFlash()`：非法暴露己王时的红色一次性闪烁
- `src/lib/gameState.js`
  - `canInteractWithSquare()`：当前回合是否允许操作该棋子
  - `getExposedKingSquaresAfterVisualMove()`：不经 `move()` 校验的视觉模拟

注意事项：

- 不要用 `chess.js.move()` 去“模拟非法走法”，它会直接拒绝，拿不到暴露己王的中间局面
- `attackers(square)` 默认只看当前行棋方；做手动模拟时必须显式传入攻击方颜色
- 每次新的拖拽或落子开始前，都要先清理旧的 `flashSquares` 和定时器，否则红色高亮会残留

## Worker 调试

### 普通 AI Worker

入口文件：`src/chessWorker.js`

消息格式：

```js
{
  requestId,
  fen,
  computerColor,
  difficultyKey,
  candidateMoves,
}
```

### Stockfish Worker

入口文件：`src/stockfishWorker.js`

关键点：

- 通过 `waitForReady()` 等待 `readyok`
- 每次新请求前先 `stop`
- 返回值从 UCI `bestmove` 解析得到
- 最多重试 2 次，失败时通知主线程进行降级

### 陷阱检测 Worker

入口文件：`src/ai/trapBook.js`

陷阱类型：

- Smothered Mate：闷杀（用己方棋子堵住王的退路）
- Double Attack：双重攻击（一着攻击两个目标）
- Fork：叉攻（用一子攻击两个目标，通常是兵）
- Skewer：牵制（强制对方移动高价值棋子后攻击另一目标）
- Removal：消除保护（吃掉保护关键棋子的棋子）
- Decoy：引离（诱使对方棋子离开保护位置）
- Discovered Attack：闪击（移动遮挡棋子露出后面的攻击）

## 手动验证清单

每次涉及交互或 AI 逻辑时，至少检查：

1. 人机模式可正常开局和自动应手
2. 双人模式不会触发电脑走棋
3. 切换执白 / 执黑后棋盘方向正确
4. 切换难度后局面会重置，难度信息同步更新
5. 非法拖拽不会留下棋子残影
6. 将军、将死、和棋提示仍然正确
7. 行棋记录按回合显示正常
8. 只有当前行棋方的棋子可以被拖动
9. 普通非法拖拽只回弹，不出现红色警告
10. 只有“拖动后会暴露己王”的非法拖拽才会红色高亮并播放警告音
11. 连续先后执行“暴露己王非法拖拽”与“普通非法拖拽”时，红色高亮不会残留

### 音效验证

12. 三种音效风格切换后音效音色变化
13. 音量滑块能实时调整音量
14. 静音按钮能正确静音/取消静音
15. 落子、吃子、将军、将死、非法警告时正确播放对应音效

### 陷阱检测验证

16. 中局阶段电脑能识别并执行常见战术
17. 陷阱走法不会在开局阶段使用
18. 困难/大师模式下使用 Stockfish 内置战术，不使用自定义陷阱

### Stockfish 降级验证

19. 当 Stockfish 引擎加载失败时，能自动降级到自定义 AI
20. 降级后游戏仍能正常进行

## 提交前检查

```bash
npm run lint
npm run build
```

如果改动了界面，还应启动开发服务器进行手动验证。

## 性能优化说明

### 转置表优化

搜索模块使用转置表加速：

- 最大容量：50000 条记录
- LRU 淘汰策略：当容量超限时，删除最久未访问的记录
- 节点限制：单次搜索最多 100000 个节点，防止超时

### 并行计算

- 普通 AI 使用 Worker 池并行评分
- Worker 数量根据 CPU 线程数自动确定
- 候选走法均匀分片给各 Worker

### 开局库优化

- 扩展了开局库，支持更多常见开局
- 支持分支变化，同一局面可有多个走法选择
- 陷阱检测在开局库之后执行，进一步丰富中局走法选择
