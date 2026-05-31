# 系统架构

## 分层概览

当前代码按"页面装配 → 调度逻辑 → 计算执行 → AI 评估"分层：

```text
React UI
├── App.jsx
├── components/
│   ├── GameHeader.jsx
│   ├── GameControls.jsx
│   ├── GameInfo.jsx
│   ├── MoveHistory.jsx
│   ├── OpeningActions.jsx
│   ├── AiThoughtPanel.jsx
│   ├── BoardSideStatus.jsx
│   └── SoundSettings.jsx
├── hooks/
│   └── useComputerMove.js
├── lib/
│   ├── gameState.js
│   ├── endgameDrill.js
│   ├── gameStatus.js
│   ├── workerUtils.js
│   └── soundManager.js
├── chessWorker.js
├── stockfishWorker.js
├── chess-ai.js
└── ai/
    └── endgameBook.js
```

## 组件层

### `src/App.jsx`

负责顶层状态与页面装配：

- 持有棋局、模式、执棋方、难度、高亮和动画状态
- 组合 `Chessboard` 与侧栏组件
- 处理用户拖拽走子、切换模式、切换难度、重开对局、残局练习入口
- 将电脑走棋逻辑委托给 `useComputerMove`
- 管理音效状态（风格、音量、静音）
- 管理顶部栏菜单、作弊入口、升变选择条和残局练习生成
- 维护两类棋盘反馈状态：
  - `highlightedSquares`：绿色合法落点提示
  - `flashSquares`：红色一次性警告/将军闪烁
- 维护统一的延迟动作流水线：
  - `pendingAction`
  - `isPendingActionDelayActive`
  - `pendingActionTimerRef`

该流水线现在覆盖四类按钮动作：

- 重新开始
- 作弊选项
- 难度切换
- `残局对抗`

统一行为为：

```text
点击按钮
→ 立即禁用相关按钮
→ 取消后续电脑走棋请求
→ 等待当前电脑落子完成
→ 再等待 1 秒
→ 应用目标动作
→ 恢复正常调度
```

另外，`App.jsx` 还承担以下新增 UI 行为：

- 顶部栏标题左侧显示应用 Logo，并复用于浏览器页签图标
- 双方身份信息牌中间显示状态词：
  - 当前轮到玩家时：`> 该你走棋了 <`
  - 电脑思考时：`思考中。。。`
  - 将死胜方：`获胜！`
  - 和棋时双方：`和棋`
- 玩家兵升变时显示手动选择条，顺序固定为“后、车、象、马”
- 对局信息中的 Stockfish 深度只做展示偏移，显示值为 `实际深度 - 4`

### `src/components/`

这些组件都是展示型组件，只接收 props：

- `GameHeader.jsx`：顶部标题、状态文案、思考提示、和棋提示
- `GameControls.jsx`：模式切换、执棋颜色、难度选择、重新开始
- `GameInfo.jsx`：当前对局信息
- `MoveHistory.jsx`：行棋记录列表
- `OpeningActions.jsx`：执棋颜色与重新开始
- `AiThoughtPanel.jsx`：左侧 thought 面板，展示 `aiModel` 的状态、模型名、思路、走法与错误
- `BoardSideStatus.jsx`：棋盘上下方身份牌、思考提示、获胜/和棋提示
- `SoundSettings.jsx`：音效风格选择、音量调节、静音切换

## UI 设计约束

以下布局与文案属于当前项目的显式 UI 约束，后续 agent 修改时应默认保持，不要自行重排：

1. 页面主区固定为三大区：
   - 左侧：`AiThoughtPanel`
   - 中间：棋盘与棋盘上下身份牌
   - 右侧：控制侧栏

2. 右侧控制侧栏使用“两列 + 多行”心智模型：
   - 第一行左列是 `OpeningActions`
   - 第二、三行是 `GameControls`，按“敌方一行、我方一行”配对显示
   - `敌方` 必须与 `敌方难度 / 敌方 AI 配置` 同一水平行
   - `我方` 必须与 `我方难度 / 我方 AI 配置` 同一水平行
   - `GameInfo`、`MoveHistory`、`SoundSettings` 都位于左列

3. 右侧左列卡片宽度必须统一：
   - `OpeningActions`
   - `敌方 / 我方` 角色卡
   - `GameInfo`
   - `MoveHistory`
   - `SoundSettings`
   这些卡片的宽度需要保持一致，避免以后出现角色卡更宽、信息卡更窄的回退。

4. 左侧 `AiThoughtPanel` 的头部规则固定为：
   - 标题格式：`AI (模型名)`
   - 标题右侧显示状态胶囊
   - 状态胶囊需要兼容错误态；错误文案直接融合在状态里，不单独再出现“错误”区块
   - 面板正文只保留“思考”和“走法”两个内容区块

5. `aiModel` 相关视觉约束：
   - 左侧 thought 面板是模型链路的主要调试出口
   - 不要把模型状态、错误信息重新塞回棋盘中央或右侧控制栏
   - 若需新增 LLM 调试信息，优先扩展左侧 thought 面板或浏览器控制台，而不是打散到多个区域

## 通用工具层

### `src/lib/gameState.js`

封装与棋局状态有关的辅助能力：

- 克隆棋局
- 在副本上应用走法
- 查找国王位置
- 计算将军来源格子
- 判断指定格子是否属于当前行棋方
- 模拟非法拖拽后的棋盘状态，并检查是否暴露己方国王
- 提供直接改写当前回合方盘面的作弊工具：
  - `transformCurrentTurnPawnsToKnights()`
  - `transformCurrentTurnNonKingPiecesToQueens()`

这些作弊操作不依赖标准合法走法校验，而是直接重建局面。

### `src/lib/endgameDrill.js`

负责生成残局练习局面：

- 从当前已接入的残局规则模板中随机挑选一种
- 当前约束为“强方固定是我方，弱方固定是敌方，且由强方先走”
- 只生成项目已具备轻量残局规则支持的局面族
- 会过滤掉初始即将军或已结束的无效局面

目前已接入的模板包括：

- `K+Q vs K`
- `K+R vs K`
- `K+B+B vs K`
- `K+B+N vs K`
- `K+Q+额外子力 vs K`
- `K+R+额外非兵子力 vs K`
- 以及上述若干 `vs K+P` 版本

### `src/lib/gameStatus.js`

封装展示文本与历史整理：

- 当前状态文案
- 和棋原因文案
- 颜色标签
- 行棋记录按回合分组
- 对局结束音效类别：
  - 我方胜利：`win`
  - 我方失败：`lose`
  - 和棋：`draw`

### `src/lib/workerUtils.js`

封装 Worker 相关的小型工具：

- 根据硬件线程数计算 Worker 数量
- 将候选走法分片给多个 Worker

### `src/lib/soundManager.js`

使用 Web Audio API 程序化生成音效：

- 三种风格：electronic（电子）、wooden（木质）、game（游戏）
- 多类音效：move（落子）、capture（吃子）、check（将军）、checkmate（失败/敌方获胜）、win（我方获胜/作弊）、draw（和棋）、invalid（非法拖拽警告）
- 通过振荡器和增益节点实时合成声音
- 无需外部音频文件

近期调整：

- 吃子音效去掉了额外的低沉叠加声，整体改为更积极、更轻快的单一反馈
- 作弊按钮直接复用胜利音效
- 胜利 / 失败 / 和棋已拆分为不同播放路径

音效风格特点：

| 风格 | 特点 | 波形类型 |
|------|------|----------|
| electronic | 现代数字感，干净清脆 | square/sawtooth |
| wooden | 温暖自然，类似真实木质棋子声 | triangle |
| game | 游戏感，有一定的复古像素风 | sine |

## 调度层

### `src/hooks/useComputerMove.js`

这个 Hook 负责隔离 AI 调度细节：

- 创建与销毁普通 AI Worker 和 Stockfish Worker
- 用请求 ID 屏蔽过期结果
- 根据当前角色与难度决定走 `aiModel`、开局库、自定义 AI 或 Stockfish
- 统一暴露 `isComputerThinking` 与取消逻辑
- 处理 Stockfish 引擎失败时的降级逻辑（回退到自定义 AI）
- 支持在 `pendingAction` 期间抑制新一轮电脑回合启动
- 为按钮延迟动作提供“取消后续电脑走棋，但等待当前走棋自然结束”的调度基础

新增的 `aiModel` 调度分支约束如下：

- 当前回合角色为 `aiModel` 时，不走 Worker，而是由浏览器直接向 OpenAI-compatible 接口发请求
- 请求内容会携带当前 FEN、最近行棋以及 `chess.js` 生成的合法走法列表
- LLM 只允许从这份合法走法列表中选一步，不负责直接生成新局面
- 返回结果会先解析出 `thought` 与 `move`，再用当前合法走法列表做二次校验
- 只有命中合法列表的走法才会回到 `App.jsx` 落子；否则按错误处理，不写入棋盘

对应 UI 反馈也统一经过这一层：

- 开始请求时通知左侧 thought 面板进入“思考中”
- 请求成功后回写模型名、简短思路与最终选步
- 请求失败、配置缺失或返回非法走法时，回写错误信息供左侧面板展示

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
- 实现错误恢复机制（最多重试 2 次）
- 检测引擎失败并通知主线程

### `src/lib/llm/`

这一组模块负责 `aiModel` 的浏览器直连链路：

- `chessLegalMoves.js`：把 `chess.js` 的 verbose 合法走法转换为结构化列表与 `uci`
- `chessPrompt.js`：组装给模型的提示词，明确要求“只从合法走法里选一步”
- `chessMoveParser.js`：解析严格 JSON 响应，提取 `thought` 与 `move`
- `openaiCompatibleClient.js`：使用浏览器 `fetch` 调用 OpenAI-compatible 接口

这些模块都不拥有棋局真相，只负责整理输入、请求模型和解析输出；最终是否能落子仍由 `chess.js` 决定。

## AI 层

### `src/chess-ai.js`

该文件现在只保留稳定对外入口，负责组装主流程：

- `DIFFICULTY_LEVELS` / `DIFFICULTY_BY_KEY`
- `getCurrentSearchDepth()`
- `getCandidateMoves()`
- `getBookOrForcedMove()`
- `getTrappedMove()`
- `scoreComputerMoves()`
- `pickBestMove()`
- `chooseComputerMove()`

新增职责：

- `getBookOrForcedMove()` 负责统一处理非搜索类优先分支，当前优先级为：

```text
唯一合法手
→ 开局库
→ 自定义陷阱检测
→ 常规搜索/Stockfish
```

### `src/ai/config.js`

集中维护 AI 常量和难度配置：

- 棋子价值表
- 位置分表
- 开局/发展相关常量
- `DIFFICULTY_LEVELS`

### `src/ai/openingBook.js`

负责开局库能力：

- 开局库表（支持分支变化）
- 开局 key 生成
- 当前局面的开局走法匹配
- `getOpeningName()` 获取开局名称
- `isInOpeningBook()` 判断局面是否在开局库中

Stockfish 难度现在也可以按配置使用开局库：

- `hard` 已接入 `useOpeningBook`
- `master` 已接入 `useOpeningBook`
- 大师难度在开局阶段允许少量随机分流，避免每盘都完全同谱

### `src/ai/trapBook.js`

负责中局战术陷阱检测：

- 陷阱类型：Smothered Mate、Double Attack、Fork、Skewer、Removal、Decoy、Discovered Attack
- `findTraps()` 查找可执行的战术陷阱
- `findIncomingThreats()` 检测对手的威胁
- `getTrapHints()` 获取战术提示

陷阱检测策略：

- 只在中局使用陷阱（开局阶段用开局库）
- 根据难度决定是否使用陷阱
- 高优先级陷阱直接执行，低优先级有概率执行

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
- 转置表大小限制（50000 条记录）
- LRU 淘汰策略
- 节点数量限制（100000）

Stockfish 相关难度的搜索深度策略已经扩展为动态深度：

- `hard`：随双方总子力从 `8` 渐变到 `12`
- `master`：随双方总子力从 `11` 渐变到 `17`
- 前期采用更平缓的曲线，残局阶段再逐渐拉高深度

注意：

- UI 展示时，Stockfish 的“当前深度”会显示为 `实际深度 - 4`
- 这是纯界面层修饰，不影响引擎真实搜索深度
- 若命中以下基础必胜残局集合，则强方的 Stockfish 搜索深度直接提升到 `18`：
  - `K+Q vs K`
  - `K+R vs K`
  - `K+B+B vs K`
  - `K+B+N vs K`
  - `K+Q+任意额外子力 vs K`
  - `K+R+任意额外非兵子力 vs K`
  - `K+2 个及以上轻子（至少含一象）vs K`
  - `K+Q vs K+P`
  - `K+R vs K+P`
  - `K+Q+任意额外子力 vs K+P`
  - `K+R+任意额外非兵子力 vs K+P`

### `src/ai/endgameBook.js`

负责轻量残局识别模块：

- 在无需 7 子残局库文件的前提下，识别若干基础必胜残局家族
- 支持弱方为：
  - 单王
  - 单王 + 单兵
- 当前已接入的残局家族：
  - `queen`
  - `rook`
  - `double-bishop`
  - `bishop-knight`
  - `minor-net`

当前项目中的实际用途：

- 为 `stockfishDepth.js` 提供残局家族识别结果
- 命中这些基础必胜残局时，不直接替 Stockfish 出招
- 而是把强方的 Stockfish 搜索深度直接提升到 `18`

这层不是 Syzygy，也不是 Stockfish 内部逻辑修改，而是项目侧的轻量残局识别与策略补强。

## 数据流

### 人机模式

```text
玩家拖拽落子
→ App.jsx 验证并更新棋局
→ 若触发升变，则先弹出手动升变选择条
→ useComputerMove 检测轮到电脑
→ 若当前角色是 `aiModel`：
  → 浏览器直连 OpenAI-compatible 接口
  → LLM 从合法走法列表中选择一步并返回 `thought` + `move`
  → useComputerMove 用当前合法走法再次校验返回走法
→ 否则选择开局库 / 陷阱检测 / 普通 AI / Stockfish
→ aiModel 或 Worker 返回走法
→ App.jsx 应用电脑走法 + 播放音效
→ React 重新渲染棋盘和侧栏
```

### 延迟动作模式

```text
用户点击重新开始 / 作弊 / 难度切换 / 残局对抗
→ App.jsx 记录 pendingAction
→ useComputerMove 停止派发新的电脑回合
→ 若当前已有电脑回合在执行，则等待其完成
→ 1 秒后应用目标动作
→ 清理高亮、闪烁、挂起升变等临时状态
→ 重新进入正常对局流
```

### 双人模式

```text
玩家拖拽落子
→ App.jsx 验证并更新棋局
→ 不触发电脑调度
→ 直接进入下一手
```

### 非法拖拽反馈

```text
玩家开始拖拽
→ App.jsx 先校验 sourceSquare 是否属于当前行棋方
→ 若不是当前行棋方：直接拒绝，不显示红色警告
→ 若是当前行棋方：读取该棋子全部合法走法并显示绿色高亮

玩家释放到目标格
→ 若目标格在合法走法列表中：正常走子并按是否吃子播放音效
→ 若目标格不在合法走法列表中：
  → gameState.getExposedKingSquaresAfterVisualMove() 进行“视觉模拟”
  → 若模拟后己方国王被攻击：闪烁高亮国王与攻击者，播放警告音
  → 否则只回弹，不显示警告
```

### 音效系统

```text
状态变化（走棋、将军、将死）
→ App.jsx 检测状态变化
→ 调用 playMoveSound() / playCheckSound() / playCheckmateSound()
→ soundManager 使用 Web Audio API 合成音效
→ 播放到音频上下文
```

## 关键设计点

1. **UI 与调度解耦**
   - 页面层不再直接堆积 Worker 初始化和消息分发逻辑。

2. **过期结果保护**
   - Worker 结果通过请求 ID 校验，避免旧搜索污染新棋局。

3. **保留单一 AI 核心**
   - `chess-ai.js` 继续负责评估与选步，重构没有改动整体决策入口。
   - 对于 `aiModel`，则复用相同调度入口，但把“选步”委托给浏览器直连的 OpenAI-compatible 请求。

4. **程序化音效生成**
   - 使用 Web Audio API 实时合成音效，无需外部音频文件
   - 三种风格通过不同的波形类型和参数实现

5. **统一延迟动作机制**
   - 所有“会重置或重建局面 / AI 状态”的按钮都共享同一套等待机制
   - 避免旧电脑请求在新局面上落子，降低竞态问题

6. **中局陷阱检测**
   - 独立于开局库的中局战术检测模块
   - 检测常见战术模式并在适当时机使用

7. **Stockfish 降级机制**
   - 当 Stockfish 引擎失败时，自动降级到自定义 AI
   - 保证游戏不会因引擎问题而中断

8. **非法拖拽与规则层分离**
   - 合法走法仍完全依赖 `chess.js`
   - 非法拖拽警告不调用 `move()` 强行试走，而是通过 `remove()/put()` 做视觉模拟
   - 这样可以覆盖“被钉住棋子横移导致暴露国王”这类 `move()` 会直接拒绝的场景

9. **LLM 只做选步，不做规则真源**
   - `aiModel` 收到的是 `chess.js` 产出的合法走法白名单
   - 模型只能从列表中挑选一步，不直接描述或构造新局面
   - 最终合法性校验与棋局更新仍只通过 `chess.js` 完成

10. **左侧 thought 面板是模型链路的可视化出口**
   - `AiThoughtPanel.jsx` 统一展示模型状态、思路、走法与错误
   - 这样可以把“请求中 / 返回成功 / 配置错误 / 非法响应”等状态从棋盘逻辑中拆出来单独观察

11. **警告高亮是一次性状态**
   - `flashSquares` 同时服务于将军提示和非法拖拽警告
   - 每次新的拖拽或落子前先清理旧高亮与定时器，避免红色状态残留到下一次非法拖拽

12. **残局识别与残局练习联动**
   - `endgameBook.js` 提供残局家族识别能力
   - `stockfishDepth.js` 在命中基础必胜残局时把强方深度直接提到 `18`
   - `endgameDrill.js` 负责随机生成项目已支持的残局模板
   - 顶部栏 `残局对抗` 直接复用统一延迟动作机制，便于快速进入练习局面
