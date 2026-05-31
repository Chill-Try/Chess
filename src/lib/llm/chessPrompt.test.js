import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChessPrompt } from './chessPrompt.js'

test('buildChessPrompt 会生成包含 system 和 user 的消息体', () => {
  const prompt = buildChessPrompt({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    history: ['e4', 'e5', 'Nf3', 'Nc6'],
    legalMoves: [{ uci: 'd2d4', san: 'd4', from: 'd2', to: 'd4', promotion: null }],
  })

  assert.equal(prompt.messages.length, 2)
  assert.deepEqual(prompt.messages.map((message) => message.role), ['system', 'user'])
  assert.match(prompt.messages[0].content, /legal_san_moves/i)
  assert.match(prompt.messages[0].content, /120/)
  assert.match(prompt.messages[0].content, /strict json/i)
  assert.match(prompt.messages[0].content, /thought/i)
  assert.match(prompt.messages[0].content, /Chinese/i)

  const payload = JSON.parse(prompt.messages[1].content)
  assert.equal(payload.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  assert.equal(payload.turn, 'w')
  assert.deepEqual(payload.recent_history, [['e4', 'e5'], ['Nf3', 'Nc6']])
  assert.deepEqual(payload.legal_san_moves, ['d4'])
  assert.equal('legal_moves' in payload, false)
})

test('buildChessPrompt 发给 LLM 的 legal_san_moves 只保留 san 字符串数组', () => {
  const payload = JSON.parse(
    buildChessPrompt({
      fen: 'fen',
      turn: 'w',
      history: [],
      legalMoves: [
        { uci: 'a7a8q', san: 'a8=Q+', from: 'a7', to: 'a8', promotion: 'q' },
      ],
    }).messages[1].content
  )

  assert.deepEqual(payload.legal_san_moves, ['a8=Q+'])
  assert.equal(Array.isArray(payload.legal_san_moves), true)
  assert.equal(typeof payload.legal_san_moves[0], 'string')
  assert.equal('legal_moves' in payload, false)
})

test('buildChessPrompt 只保留最近 5 个回合历史，并按白黑走法成对输出', () => {
  const prompt = buildChessPrompt({
    fen: 'test-fen',
    turn: 'b',
    history: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
    legalMoves: [],
  })

  const payload = JSON.parse(prompt.messages[1].content)

  assert.deepEqual(payload.recent_history, [
    ['c', 'd'],
    ['e', 'f'],
    ['g', 'h'],
    ['i', 'j'],
    ['k', 'l'],
  ])
  assert.equal(payload.recent_history.length, 5)
})

test('buildChessPrompt 在黑方尚未落子时，最近回合保留空黑棋位', () => {
  const payload = JSON.parse(
    buildChessPrompt({
      fen: 'fen',
      turn: 'b',
      history: ['e4', 'e5', 'Nf3'],
      legalMoves: [],
    }).messages[1].content
  )

  assert.deepEqual(payload.recent_history, [
    ['e4', 'e5'],
    ['Nf3', ''],
  ])
})

test('buildChessPrompt 在 history 不是数组时按空历史处理', () => {
  assert.deepEqual(
    JSON.parse(
      buildChessPrompt({
        fen: 'fen',
        turn: 'w',
        history: null,
        legalMoves: [],
      }).messages[1].content
    ).recent_history,
    []
  )

  assert.deepEqual(
    JSON.parse(
      buildChessPrompt({
        fen: 'fen',
        turn: 'w',
        history: undefined,
        legalMoves: [],
      }).messages[1].content
    ).recent_history,
    []
  )

  assert.deepEqual(
    JSON.parse(
      buildChessPrompt({
        fen: 'fen',
        turn: 'w',
        history: 'e4 e5',
        legalMoves: [],
      }).messages[1].content
    ).recent_history,
    []
  )
})
