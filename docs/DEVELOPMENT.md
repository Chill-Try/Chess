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

- `gameState.js`：棋局副本、走法应用、将军相关辅助
- `gameStatus.js`：展示文案、走棋记录整理
- `workerUtils.js`：Worker 数量与任务分片

### 改电脑走棋调度时

优先看 `src/hooks/useComputerMove.js`：

- Worker 初始化与销毁
- 请求取消
- 普通 AI / Stockfish 分发
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
- `src/ai/search.js`：搜索深度、排序、`minimax()`
- `src/chess-ai.js`：仅保留对外 API 与主流程组装

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

## 手动验证清单

每次涉及交互或 AI 逻辑时，至少检查：

1. 人机模式可正常开局和自动应手
2. 双人模式不会触发电脑走棋
3. 切换执白 / 执黑后棋盘方向正确
4. 切换难度后局面会重置，难度信息同步更新
5. 非法拖拽不会留下棋子残影
6. 将军、将死、和棋提示仍然正确
7. 走棋记录按回合显示正常

## 提交前检查

```bash
npm run lint
npm run build
```

如果改动了界面，还应启动开发服务器进行手动验证。
