# LLM Chess Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-direct OpenAI-compatible LLM move generation for the existing `aiModel` role, show the model's short thought on the left side of the board, and apply the validated move to the live chess game.

**Architecture:** Reuse the existing `useComputerMove` scheduling path instead of building a second async flow in `App.jsx`. Add small focused LLM helper modules for legal move extraction, prompt building, response parsing, and HTTP requests, then thread an `aiModel` branch through the current role/config pipeline and expose a new thought panel in the layout.

**Tech Stack:** React 19, Vite, `chess.js`, browser `fetch`, `node:test`

---

## File Structure

- Create: `src/lib/chessLegalMoves.js`
  - Convert `chess.js` legal moves into stable `uci`-based payloads.
- Create: `src/lib/chessLegalMoves.test.js`
  - Verify legal move conversion, including promotion cases.
- Create: `src/lib/llm/chessPrompt.js`
  - Build the OpenAI-compatible messages payload from FEN, history, side to move, and legal moves.
- Create: `src/lib/llm/chessPrompt.test.js`
  - Verify prompt shape and history truncation.
- Create: `src/lib/llm/chessMoveParser.js`
  - Parse and validate strict JSON output from the LLM.
- Create: `src/lib/llm/chessMoveParser.test.js`
  - Reject malformed payloads and accept valid move JSON.
- Create: `src/lib/llm/openaiCompatibleClient.js`
  - Execute the browser request and normalize response text.
- Create: `src/lib/llm/openaiCompatibleClient.test.js`
  - Verify request body, non-2xx handling, and timeout behavior with mocked `fetch`.
- Create: `src/components/AiThoughtPanel.jsx`
  - Render AI model state, thought, chosen move, and error text.
- Modify: `src/lib/sideControl.js`
  - Add helper(s) to resolve the current turn's `aiModel` config by color.
- Modify: `src/lib/sideControl.test.js`
  - Cover the new helper behavior.
- Modify: `src/hooks/useComputerMove.js`
  - Add the `aiModel` scheduling branch and result callbacks.
- Modify: `src/App.jsx`
  - Hold thought panel state, pass AI config into the hook, and render the panel.
- Modify: `src/App.css`
  - Add left panel layout and panel styling.
- Modify: `docs/ARCHITECTURE.md`
  - Document the new LLM branch.

### Task 1: Add structured legal move generation

**Files:**
- Create: `src/lib/chessLegalMoves.js`
- Test: `src/lib/chessLegalMoves.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { buildLegalMoves } from './chessLegalMoves.js'

test('buildLegalMoves returns uci and san for standard moves', () => {
  const game = new Chess()
  const moves = buildLegalMoves(game)
  const e4 = moves.find((move) => move.uci === 'e2e4')

  assert.deepEqual(e4, {
    uci: 'e2e4',
    san: 'e4',
    from: 'e2',
    to: 'e4',
    promotion: null,
  })
})

test('buildLegalMoves keeps promotion suffix in uci', () => {
  const game = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
  const moves = buildLegalMoves(game)
  const promote = moves.find((move) => move.uci === 'a7a8q')

  assert.equal(promote.promotion, 'q')
  assert.equal(promote.san, 'a8=Q+')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/chessLegalMoves.test.js`
Expected: FAIL with module not found or missing export for `buildLegalMoves`

- [ ] **Step 3: Write minimal implementation**

```js
export function buildLegalMoves(game) {
  return game.moves({ verbose: true }).map((move) => ({
    uci: `${move.from}${move.to}${move.promotion ?? ''}`,
    san: move.san,
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? null,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/chessLegalMoves.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/chessLegalMoves.js src/lib/chessLegalMoves.test.js
git commit -m "test: add legal move payload builder"
```

### Task 2: Add prompt builder for chess LLM requests

**Files:**
- Create: `src/lib/llm/chessPrompt.js`
- Test: `src/lib/llm/chessPrompt.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChessPrompt } from './chessPrompt.js'

test('buildChessPrompt includes fen, side to move, recent history, and legal moves', () => {
  const prompt = buildChessPrompt({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    history: ['e4', 'e5', 'Nf3', 'Nc6'],
    legalMoves: [{ uci: 'd2d4', san: 'd4', from: 'd2', to: 'd4', promotion: null }],
  })

  assert.equal(prompt.messages[0].role, 'system')
  assert.match(prompt.messages[1].content, /"fen":/)
  assert.match(prompt.messages[1].content, /"legal_moves":/)
  assert.match(prompt.messages[1].content, /"move":"<uci>"/)
})

test('buildChessPrompt truncates long history to the latest 10 plies', () => {
  const history = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
  const prompt = buildChessPrompt({
    fen: 'test',
    turn: 'b',
    history,
    legalMoves: [],
  })

  assert.doesNotMatch(prompt.messages[1].content, /"a"/)
  assert.match(prompt.messages[1].content, /"l"/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/llm/chessPrompt.test.js`
Expected: FAIL with module not found or missing export for `buildChessPrompt`

- [ ] **Step 3: Write minimal implementation**

```js
const SYSTEM_PROMPT = [
  'You are a chess move selector.',
  'Choose exactly one move from legal_moves.',
  'Keep thought within 120 Chinese characters.',
  'Return strict JSON only: {"thought":"...","move":"<uci>"}',
].join(' ')

export function buildChessPrompt({ fen, turn, history, legalMoves }) {
  const payload = {
    fen,
    turn,
    recent_history: history.slice(-10),
    legal_moves: legalMoves,
  }

  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/llm/chessPrompt.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/chessPrompt.js src/lib/llm/chessPrompt.test.js
git commit -m "test: add chess llm prompt builder"
```

### Task 3: Add strict LLM response parsing

**Files:**
- Create: `src/lib/llm/chessMoveParser.js`
- Test: `src/lib/llm/chessMoveParser.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseChessMoveResponse } from './chessMoveParser.js'

test('parseChessMoveResponse returns thought and move from strict JSON', () => {
  const parsed = parseChessMoveResponse('{"thought":"控制中心","move":"e2e4"}')

  assert.deepEqual(parsed, {
    thought: '控制中心',
    move: 'e2e4',
  })
})

test('parseChessMoveResponse rejects markdown code fences', () => {
  assert.throws(
    () => parseChessMoveResponse('```json\n{"thought":"x","move":"e2e4"}\n```'),
    /strict JSON/
  )
})

test('parseChessMoveResponse rejects missing move field', () => {
  assert.throws(
    () => parseChessMoveResponse('{"thought":"x"}'),
    /move/
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/llm/chessMoveParser.test.js`
Expected: FAIL with module not found or missing export for `parseChessMoveResponse`

- [ ] **Step 3: Write minimal implementation**

```js
export function parseChessMoveResponse(text) {
  if (text.includes('```')) {
    throw new Error('LLM response must be strict JSON without code fences')
  }

  const parsed = JSON.parse(text)

  if (typeof parsed?.move !== 'string' || parsed.move.length === 0) {
    throw new Error('LLM response missing move')
  }

  if (typeof parsed?.thought !== 'string') {
    throw new Error('LLM response missing thought')
  }

  return {
    thought: parsed.thought.trim(),
    move: parsed.move.trim(),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/llm/chessMoveParser.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/chessMoveParser.js src/lib/llm/chessMoveParser.test.js
git commit -m "test: add chess llm response parser"
```

### Task 4: Add OpenAI-compatible browser client

**Files:**
- Create: `src/lib/llm/openaiCompatibleClient.js`
- Test: `src/lib/llm/openaiCompatibleClient.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { requestOpenAiCompatibleMove } from './openaiCompatibleClient.js'

test('requestOpenAiCompatibleMove posts JSON body to chat completions endpoint', async () => {
  let request

  const fetchImpl = async (url, init) => {
    request = { url, init }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"thought":"稳健发展","move":"e2e4"}' } }],
      }),
    }
  }

  const result = await requestOpenAiCompatibleMove({
    requestUrl: 'https://example.com/v1',
    apiKey: 'sk-test',
    modelName: 'demo-model',
    messages: [{ role: 'user', content: 'x' }],
    fetchImpl,
  })

  assert.equal(request.url, 'https://example.com/v1/chat/completions')
  assert.equal(result.content, '{"thought":"稳健发展","move":"e2e4"}')
})

test('requestOpenAiCompatibleMove throws on non-2xx responses', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    text: async () => 'unauthorized',
  })

  await assert.rejects(
    () => requestOpenAiCompatibleMove({
      requestUrl: 'https://example.com/v1',
      apiKey: 'bad',
      modelName: 'demo-model',
      messages: [],
      fetchImpl,
    }),
    /401/
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/llm/openaiCompatibleClient.test.js`
Expected: FAIL with module not found or missing export for `requestOpenAiCompatibleMove`

- [ ] **Step 3: Write minimal implementation**

```js
function normalizeBaseUrl(requestUrl) {
  return requestUrl.endsWith('/') ? requestUrl.slice(0, -1) : requestUrl
}

export async function requestOpenAiCompatibleMove({
  requestUrl,
  apiKey,
  modelName,
  messages,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(`${normalizeBaseUrl(requestUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const detail = typeof response.text === 'function' ? await response.text() : ''
    throw new Error(`OpenAI-compatible request failed: ${response.status} ${detail}`.trim())
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('OpenAI-compatible response missing message content')
  }

  return { content }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/llm/openaiCompatibleClient.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/openaiCompatibleClient.js src/lib/llm/openaiCompatibleClient.test.js
git commit -m "test: add openai-compatible llm client"
```

### Task 5: Resolve aiModel config by turn

**Files:**
- Modify: `src/lib/sideControl.js`
- Test: `src/lib/sideControl.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAiModelTurnConfig } from './sideControl.js'

test('getAiModelTurnConfig returns my-side aiModel config when it is my turn', () => {
  const config = getAiModelTurnConfig({
    turnColor: 'w',
    playerColor: 'w',
    mySideRole: 'aiModel',
    opponentSideRole: 'player',
    myAiConfig: { requestUrl: 'u1', apiKey: 'k1', modelName: 'm1', provider: 'openai' },
    opponentAiConfig: { requestUrl: 'u2', apiKey: 'k2', modelName: 'm2', provider: 'openai' },
  })

  assert.deepEqual(config, {
    computerColor: 'w',
    aiConfig: { requestUrl: 'u1', apiKey: 'k1', modelName: 'm1', provider: 'openai' },
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/sideControl.test.js`
Expected: FAIL with missing export for `getAiModelTurnConfig`

- [ ] **Step 3: Write minimal implementation**

```js
export function getAiModelTurnConfig({
  turnColor,
  playerColor,
  mySideRole,
  opponentSideRole,
  myAiConfig,
  opponentAiConfig,
}) {
  if (turnColor === playerColor) {
    return mySideRole === 'aiModel'
      ? { computerColor: turnColor, aiConfig: myAiConfig }
      : null
  }

  return opponentSideRole === 'aiModel'
    ? { computerColor: turnColor, aiConfig: opponentAiConfig }
    : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/sideControl.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sideControl.js src/lib/sideControl.test.js
git commit -m "test: add ai model turn config helper"
```

### Task 6: Integrate aiModel scheduling into useComputerMove

**Files:**
- Modify: `src/hooks/useComputerMove.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add a failing integration-oriented test for the new pure helpers if another hook test is not present**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseChessMoveResponse } from '../lib/llm/chessMoveParser.js'

test('selected move must be validated against legal move uci list', () => {
  const legalMoves = ['e2e4', 'd2d4']
  const result = parseChessMoveResponse('{"thought":"x","move":"e2e4"}')

  assert.ok(legalMoves.includes(result.move))
})
```

- [ ] **Step 2: Thread aiModel config and callbacks into the hook API**

Add to `useComputerMove()` params in `src/hooks/useComputerMove.js` and its call site in `src/App.jsx`:

```js
aiModelConfig,
onAiThought,
onAiError,
```

Pass the current-turn `aiModel` config from `App.jsx`:

```js
aiModelConfig: activeAiModelTurn?.aiConfig ?? null,
onAiThought: handleAiThought,
onAiError: handleAiError,
```

- [ ] **Step 3: Implement the aiModel branch in the hook**

In `src/hooks/useComputerMove.js`, before the existing Stockfish/custom-AI branches, add:

```js
if (aiModelConfig) {
  pendingRequestRef.current += 1
  const requestId = pendingRequestRef.current
  const legalMoves = buildLegalMoves(game)
  const prompt = buildChessPrompt({
    fen: game.fen(),
    turn: computerColor,
    history: game.history(),
    legalMoves,
  })

  ;(async () => {
    try {
      const { content } = await requestOpenAiCompatibleMove({
        requestUrl: aiModelConfig.requestUrl,
        apiKey: aiModelConfig.apiKey,
        modelName: aiModelConfig.modelName,
        messages: prompt.messages,
      })

      if (requestId !== pendingRequestRef.current) return

      const result = parseChessMoveResponse(content)
      const selectedMove = legalMoves.find((move) => move.uci === result.move)

      if (!selectedMove) {
        throw new Error('LLM returned illegal move')
      }

      onAiThought?.({
        thought: result.thought,
        move: result.move,
        modelName: aiModelConfig.modelName,
      })

      applyMoveWithMinimumDelay({
        from: selectedMove.from,
        to: selectedMove.to,
        promotion: selectedMove.promotion ?? undefined,
      }, requestId)
    } catch (error) {
      if (requestId !== pendingRequestRef.current) return
      setIsComputerThinking(false)
      activeSearchRef.current = null
      onAiError?.(error)
    }
  })()
}
```

- [ ] **Step 4: Add config validation before requesting**

In the same branch, reject early when config is incomplete:

```js
if (!aiModelConfig.requestUrl || !aiModelConfig.apiKey || !aiModelConfig.modelName) {
  setIsComputerThinking(false)
  onAiError?.(new Error('AI 模型配置不完整'))
  return undefined
}
```

- [ ] **Step 5: Run focused tests**

Run: `node --test src/lib/chessLegalMoves.test.js src/lib/llm/chessPrompt.test.js src/lib/llm/chessMoveParser.test.js src/lib/llm/openaiCompatibleClient.test.js src/lib/sideControl.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useComputerMove.js src/App.jsx
git commit -m "feat: schedule ai model moves through llm client"
```

### Task 7: Render the left-side AI thought panel

**Files:**
- Create: `src/components/AiThoughtPanel.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write the component**

```jsx
import PropTypes from 'prop-types'

export default function AiThoughtPanel({ status, modelName, thought, move, error }) {
  return (
    <aside className="card ai-thought-panel">
      <h3>AI 思考</h3>
      <p className="ai-thought-status">{status}</p>
      <p className="ai-thought-model">{modelName || '未设置模型'}</p>
      <p className="ai-thought-body">{thought || '当前暂无思考内容。'}</p>
      <p className="ai-thought-move">{move ? `走法：${move}` : '走法：-'}</p>
      {error ? <p className="ai-thought-error">{error}</p> : null}
    </aside>
  )
}

AiThoughtPanel.propTypes = {
  status: PropTypes.string.isRequired,
  modelName: PropTypes.string,
  thought: PropTypes.string,
  move: PropTypes.string,
  error: PropTypes.string,
}
```

- [ ] **Step 2: Add state and callbacks in App.jsx**

```js
const [aiThoughtState, setAiThoughtState] = useState({
  status: '未开始',
  modelName: '',
  thought: '',
  move: '',
  error: '',
})

function handleAiThought(nextThought) {
  setAiThoughtState({
    status: '已完成',
    modelName: nextThought.modelName,
    thought: nextThought.thought,
    move: nextThought.move,
    error: '',
  })
}

function handleAiError(error) {
  setAiThoughtState((current) => ({
    ...current,
    status: '出错',
    error: error.message,
  }))
}
```

- [ ] **Step 3: Render the panel and update layout**

In `src/App.jsx`, place the panel to the left of the board column and update the board area structure.

In `src/App.css`, add:

```css
.play-area {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) var(--sidebar-main-width);
  gap: 20px;
  align-items: start;
}

.ai-thought-panel {
  min-height: 240px;
}

.ai-thought-body {
  white-space: pre-wrap;
  line-height: 1.6;
}

.ai-thought-error {
  color: #b42318;
}
```

- [ ] **Step 4: Set thinking state transitions**

When an `aiModel` turn begins in `App.jsx`, set:

```js
setAiThoughtState({
  status: '思考中',
  modelName: activeAiModelTurn?.aiConfig?.modelName ?? '',
  thought: '',
  move: '',
  error: '',
})
```

When game resets or role/config changes, clear back to the initial state.

- [ ] **Step 5: Run build verification**

Run: `npm run build`
Expected: Vite build completes successfully without new errors

- [ ] **Step 6: Commit**

```bash
git add src/components/AiThoughtPanel.jsx src/App.jsx src/App.css
git commit -m "feat: show llm chess thoughts beside board"
```

### Task 8: Document and manually verify the feature

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Update architecture docs**

Add a short subsection under the scheduling layer and UI layer documenting:

```md
- `aiModel` now uses browser-direct OpenAI-compatible requests
- LLM chooses a move only from a legal move list
- `chess.js` remains the source of truth for legality and board updates
```

- [ ] **Step 2: Run the full targeted verification set**

Run:

```bash
node --test src/lib/chessLegalMoves.test.js src/lib/llm/chessPrompt.test.js src/lib/llm/chessMoveParser.test.js src/lib/llm/openaiCompatibleClient.test.js src/lib/sideControl.test.js
npm run build
```

Expected:

- All node tests PASS
- Build PASS

- [ ] **Step 3: Manual verification checklist**

Check in the browser:

- One side set to `AI 模型` with valid config can自动请求并落子
- Left panel shows `思考中` then `已完成`
- Left panel shows returned short thought and chosen `uci`
- Invalid API key shows an error without changing the board
- Missing config shows `AI 模型配置不完整`
- Restarting during a pending request ignores the stale result

- [ ] **Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: describe llm move integration"
```

## Self-Review

- Spec coverage: covers direct-browser API usage, legal move list constraint, left-side thought display, move legality validation, and error handling.
- Placeholder scan: no `TODO` / `TBD` placeholders remain.
- Type consistency: `aiModelConfig`, `buildLegalMoves`, `buildChessPrompt`, `parseChessMoveResponse`, and `requestOpenAiCompatibleMove` names stay consistent across tasks.
