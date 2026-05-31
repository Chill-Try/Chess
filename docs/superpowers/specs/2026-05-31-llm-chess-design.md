# LLM Chess Integration Design

**Date:** 2026-05-31

**Goal:** 在现有国际象棋前端中接入“AI 模型”角色，使访客可以在浏览器中填写 OpenAI 兼容接口配置，由浏览器直接请求 LLM，让 LLM 输出简短思路与下一步合法走法，并将思路展示在棋盘左侧、将走法反映到棋盘上。

## Scope

本次设计只覆盖浏览器端直连方案：

- API Key 保存在访客当前浏览器会话内，不经过宿主机器代理。
- 先支持 OpenAI 兼容聊天接口。
- LLM 只负责“选择下一步”，不负责直接返回新的 FEN。
- 局面合法性、走法执行、升变处理全部仍由 `chess.js` 负责。

不在本次范围内：

- 服务端代理
- 多 provider 深度适配
- 流式输出
- 持久化保存 API Key

## Existing Project Constraints

- `src/App.jsx` 已经有 `aiModel` 角色和 `myAiConfig` / `opponentAiConfig` 状态。
- `src/components/GameControls.jsx` 已经能采集 `requestUrl`、`apiKey`、`modelName`、`provider`。
- `src/hooks/useComputerMove.js` 是统一的电脑走棋调度入口，已经处理了：
  - 请求过期保护
  - 最短思考展示时长
  - 取消待处理走棋
  - 重新开始 / 切难度时抑制旧回合结果
- `App.jsx` 的 `applyComputerMove()` 已经能安全把一个走法应用到当前棋局。

因此，LLM 接入应复用现有调度框架，而不是在 `App.jsx` 里单独写一套异步请求逻辑。

## Architecture

新增一条 “AI 模型走棋” 支路，结构如下：

```text
GameControls
  -> App.jsx 保存 AI 配置
  -> useComputerMove 识别当前回合角色是否为 aiModel
  -> llm client 生成请求 payload 并调用 OpenAI-compatible API
  -> llm response parser 提取 thought + selected move
  -> 本地合法性校验
  -> applyComputerMove 执行走法
  -> AiThoughtPanel 展示思路与状态
```

### New Units

- `src/lib/llm/openaiCompatibleClient.js`
  - 负责调用 OpenAI 兼容接口
  - 只关心 HTTP 请求、超时、鉴权、响应解析

- `src/lib/llm/chessPrompt.js`
  - 负责把当前棋局转换成给 LLM 的输入
  - 输出系统提示词、用户消息、合法走法列表

- `src/lib/llm/chessMoveParser.js`
  - 负责从 LLM 返回文本中解析出严格 JSON
  - 校验 `thought` 和 `move`

- `src/lib/chessLegalMoves.js`
  - 负责把 `chess.js` 的合法走法转换成结构化列表
  - 统一生成 `uci` / `san` / `from` / `to` / `promotion`

- `src/components/AiThoughtPanel.jsx`
  - 展示当前 AI 思路、状态、错误信息、所选走法

## LLM Request Contract

### Input

发送给 LLM 的内容应尽量短，只包含决策所需信息：

- 当前 FEN
- 当前执棋方：`w` / `b`
- 最近 6 到 10 步历史
- 合法走法列表
- 输出格式要求

合法走法列表示例：

```json
[
  { "uci": "e2e4", "san": "e4", "from": "e2", "to": "e4", "promotion": null },
  { "uci": "g1f3", "san": "Nf3", "from": "g1", "to": "f3", "promotion": null }
]
```

### Output

要求模型只返回 JSON：

```json
{
  "thought": "控制中心并保持子力发展，优先走稳健着法。",
  "move": "e2e4"
}
```

约束：

- `thought` 必须简短，建议限制在 120 个汉字以内。
- `move` 必须精确命中 `legal_moves[].uci` 中某一项。
- 不允许返回 Markdown 代码块，不允许追加解释文本。

## Why Move Selection Instead Of New FEN

不让 LLM 直接返回新的局面，原因如下：

- 新 FEN 难以验证是否只走了一步。
- 易位权、半回合计数、升变等元数据容易错。
- 即使看起来像对，错误来源也很难定位。

因此：

- LLM 负责“选一步”
- `chess.js` 负责“判合法 + 执行”

## Data Flow

1. 当前回合进入 `useComputerMove`。
2. 如果当前角色是 `computer`，保持现有逻辑。
3. 如果当前角色是 `aiModel`：
   - 读取对应一侧的 AI 配置
   - 生成当前局面的合法走法列表
   - 组织 prompt 并发起浏览器 `fetch`
   - 解析返回 JSON
   - 校验 `move` 是否存在于合法走法列表
   - 合法则调用 `applyComputerMove`
   - 同时把 `thought`、`move`、状态写回 UI
4. 如果请求过期、对局重开或切换角色，则忽略结果。

## UI Design

新增左侧思考面板，位置在棋盘左侧，与右侧 `MoveHistory` 平衡布局。

建议展示四类信息：

- 当前状态：未配置 / 思考中 / 已完成 / 出错
- 当前模型：展示 `modelName`
- 本步思路：最多展示一小段文本
- 本步选择：展示 `move`，必要时可追加 `san`

如果双方都使用 `aiModel`，只展示“当前轮到哪一方，该方的本步思路”。不做双列表堆叠，避免噪音。

## Error Handling

需要覆盖以下错误：

- URL 为空
- API Key 为空
- 模型名为空
- 请求超时
- 网络失败
- 服务器返回非 2xx
- 返回内容不是合法 JSON
- `move` 不在合法走法列表中

错误策略：

- 当前回合不落子
- 停止思考状态
- 在思考面板中显示简短错误
- 保持棋局不变，等待用户修正配置或重新开始

不做自动多次重试，避免重复消耗用户 Key。

## Testing Strategy

优先做纯函数测试，避免把网络与 UI 一起测：

- `chessLegalMoves.js`
  - 能从 `chess.js` verbose move 生成正确的 `uci`
  - 能正确处理升变

- `chessMoveParser.js`
  - 能解析纯 JSON
  - 能拒绝代码块包裹或字段缺失

- `chessPrompt.js`
  - 能截断历史
  - 能把合法走法列表带入请求内容

- `openaiCompatibleClient.js`
  - 能在 mock fetch 下正确构造请求
  - 能处理非 2xx 与超时

- `sideControl.js`
  - 新增当前回合为 `aiModel` 时的配置提取函数测试

UI 侧只做轻量验证：

- `App.jsx` / `useComputerMove.js` 接入后，至少保证构建通过
- 手动验证 thoughts 展示、AI 自动落子、配置错误提示

## Open Questions Resolved

- API Key 存放位置：前端浏览器内直接使用
- Provider 优先级：先只实现 OpenAI 兼容接口
- LLM 返回内容：返回一步走法，不返回新 FEN
- 合法性约束：由前端提供合法走法列表，并在本地再次校验

## Implementation Boundary

本次实现完成的判定标准：

- 选择任一侧为 `AI 模型` 并填写有效 OpenAI 兼容配置后，轮到该侧行棋时会自动请求模型
- 模型返回的简短思路能显示在棋盘左侧
- 模型返回的合法走法会真实落到棋盘上
- 非法 / 异常返回不会污染棋局，只会显示错误
