# 系统架构

## 分层概览

当前代码按“页面装配 → 调度逻辑 → 计算执行 → AI 评估”分层：

```text
React UI
├── App.jsx
├── components/
│   ├── GameHeader.jsx
│   ├── GameControls.jsx
│   ├── GameInfo.jsx
│   └── MoveHistory.jsx
├── hooks/
│   └── useComputerMove.js
├── lib/
│   ├── gameState.js
│   ├── gameStatus.js
│   └── workerUtils.js
├── chessWorker.js
├── stockfishWorker.js
└── chess-ai.js
```

## 组件层

### `src/App.jsx`

负责顶层状态与页面装配：

- 持有棋局、模式、执棋方、难度、高亮和动画状态
- 组合 `Chessboard` 与侧栏组件
- 处理用户拖拽走子、切换模式、切换难度、重开对局
- 将电脑走棋逻辑委托给 `useComputerMove`

### `src/components/`

这些组件都是展示型组件，只接收 props：

- `GameHeader.jsx`：顶部标题、状态文案、思考提示、和棋提示
- `GameControls.jsx`：模式切换、执棋颜色、难度选择、重新开始
- `GameInfo.jsx`：当前对局信息
- `MoveHistory.jsx`：走棋记录列表

## 通用工具层

### `src/lib/gameState.js`

封装与棋局状态有关的辅助能力：

- 克隆棋局
- 在副本上应用走法
- 查找国王位置
- 计算将军来源格子

### `src/lib/gameStatus.js`

封装展示文本与历史整理：

- 当前状态文案
- 和棋原因文案
- 颜色标签
- 走棋记录按回合分组

### `src/lib/workerUtils.js`

封装 Worker 相关的小型工具：

- 根据硬件线程数计算 Worker 数量
- 将候选走法分片给多个 Worker

## 调度层

### `src/hooks/useComputerMove.js`

这个 Hook 负责隔离 AI 调度细节：

- 创建与销毁普通 AI Worker 和 Stockfish Worker
- 用请求 ID 屏蔽过期结果
- 根据难度决定走开局库、自定义 AI 或 Stockfish
- 统一暴露 `isComputerThinking` 与取消逻辑

这层的目标是让 `App.jsx` 不再直接管理 Worker 生命周期。

## 计算执行层

### `src/chessWorker.js`

负责普通 AI 的评分任务：

- 接收局面、难度、候选走法
- 调用 `scoreComputerMoves()` 执行评分
- 在需要时直接返回最佳走法或返回分片评分结果

### `src/stockfishWorker.js`

负责 Stockfish 的浏览器内封装：

- 初始化 UCI 引擎
- 配置深度、技能等级、ELO 限制
- 解析 `bestmove` 输出并回传主线程

## AI 层

### `src/chess-ai.js`

该文件现在只保留稳定对外入口，负责组装主流程：

- `DIFFICULTY_LEVELS` / `DIFFICULTY_BY_KEY`
- `getCurrentSearchDepth()`
- `getCandidateMoves()`
- `getBookOrForcedMove()`
- `scoreComputerMoves()`
- `pickBestMove()`
- `chooseComputerMove()`

### `src/ai/config.js`

集中维护 AI 常量和难度配置：

- 棋子价值表
- 位置分表
- 开局/发展相关常量
- `DIFFICULTY_LEVELS`

### `src/ai/openingBook.js`

负责开局库能力：

- 开局库表
- 开局 key 生成
- 当前局面的开局走法匹配

### `src/ai/boardUtils.js`

负责底层棋盘分析工具：

- 坐标转换
- 攻击者/支援者信息
- 威胁棋子识别
- 线性压制与棋子定位

### `src/ai/evaluation.js`

负责静态局面评估：

- 子力与位置分
- 中心控制
- 发展平衡
- 攻击压力
- 王翼兵结构
- 子力协调与兵结构

### `src/ai/moveScoringShared.js`

负责多个 AI 模块共享的阶段与开局规则：

- 开局阶段计数
- 游戏阶段判断
- 易位计划与兵盾辅助
- 早期后走/王走判断

### `src/ai/moveScoring.js`

负责候选走法筛选与单步启发式附加项：

- 开局候选走法过滤
- 开局加分
- 重复走子惩罚
- 子力安全性惩罚
- 战术动机与忽视威胁惩罚

### `src/ai/search.js`

负责搜索层逻辑：

- 搜索深度选择
- 当前深度展示值
- 走法排序
- 转置表 key
- `minimax()` 与超时判断

## 数据流

### 人机模式

```text
玩家拖拽落子
→ App.jsx 验证并更新棋局
→ useComputerMove 检测轮到电脑
→ 选择开局库 / 普通 AI / Stockfish
→ Worker 返回走法
→ App.jsx 应用电脑走法
→ React 重新渲染棋盘和侧栏
```

### 双人模式

```text
玩家拖拽落子
→ App.jsx 验证并更新棋局
→ 不触发电脑调度
→ 直接进入下一手
```

## 关键设计点

1. **UI 与调度解耦**
   - 页面层不再直接堆积 Worker 初始化和消息分发逻辑。

2. **过期结果保护**
   - Worker 结果通过请求 ID 校验，避免旧搜索污染新棋局。

3. **保留单一 AI 核心**
   - `chess-ai.js` 继续负责评估与选步，重构没有改动整体决策入口。
