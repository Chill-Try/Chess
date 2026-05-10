# 国际象棋对弈应用

一个基于 React 和 Vite 的浏览器国际象棋项目，支持本地双人对弈，以及使用自定义 AI / Stockfish 的人机对弈。

## 功能

- 人机模式与本地双人模式
- 执白 / 执黑切换
- 新手、中等、困难、大师四档难度
- 拖拽走子、落点高亮、将军闪烁
- 非法拖拽时区分普通回弹与"暴露己王"警告
- 只允许拖动当前行棋方的棋子
- 走棋记录与当前对局信息展示
- Web Worker 并行计算与 Stockfish 引擎集成

## 技术栈

- React 19
- Vite 8
- chess.js
- react-chessboard
- Stockfish 18

## 开发命令

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

## 目录结构

```text
src/
├── ai/
│   ├── boardUtils.js           # 攻守关系、坐标与棋子查询工具
│   ├── config.js               # AI 常量与难度配置
│   ├── evaluation.js           # 静态局面评估
│   ├── moveScoring.js          # 候选走法过滤与单步启发式打分
│   ├── moveScoringShared.js    # 开局/阶段/易位相关共享规则
│   ├── openingBook.js          # 开局库与开局走法
│   └── search.js               # 搜索深度、排序与 minimax
├── App.jsx                    # 页面装配与交互入口
├── App.css                    # 页面级样式
├── main.jsx                   # 应用入口
├── index.css                  # 全局样式
├── chess-ai.js                # AI 聚合入口，对外导出稳定 API
├── chessWorker.js             # 自定义 AI Worker
├── stockfishWorker.js         # Stockfish Worker
├── components/
│   ├── GameControls.jsx       # 控制面板
│   ├── GameHeader.jsx         # 顶部状态区
│   ├── GameInfo.jsx           # 对局信息区
│   └── MoveHistory.jsx        # 走棋记录区
├── hooks/
│   └── useComputerMove.js     # 电脑走棋调度
└── lib/
    ├── gameState.js           # 棋局状态辅助函数（克隆、国王检测、非法拖拽模拟）
    ├── gameStatus.js          # 展示文案与历史整理
    └── workerUtils.js         # Worker 分片与数量策略
```

## 拖拽规则

- 合法落点：正常走子；若吃子则播放吃子音效，否则播放普通落子音效
- 非法落点但会暴露己王：高亮己方国王与攻击者，并播放警告音
- 普通非法落点：仅回弹，不显示警告
- 非当前行棋方的棋子：不可作为交互目标，不触发警告高亮

## 难度说明

| 难度 | 引擎 | 搜索深度 | 说明 |
| --- | --- | --- | --- |
| 新手 | 自定义 AI | 2 | 随机性更高，适合入门 |
| 中等 | 自定义 AI | 3 | 带更多位置与战术评估 |
| 困难 | Stockfish | 8 | 限制强度，约 ELO 1700 |
| 大师 | Stockfish | 16 | 更深搜索与最高技能 |

## 文档

- [docs/README.md](docs/README.md)：文档导航
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：代码结构与数据流
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)：开发与调试说明
