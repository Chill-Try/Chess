import test from 'node:test'
import assert from 'node:assert/strict'
import { parseChessMoveResponse } from './chessMoveParser.js'

test('parseChessMoveResponse 严格 JSON 正常解析并 trim', () => {
  assert.deepEqual(
    parseChessMoveResponse('{"thought":"  控制中心  ","move":"  Nf3  "}'),
    { thought: '控制中心', move: 'Nf3' }
  )
})

test('parseChessMoveResponse 拒绝 markdown 代码围栏响应', () => {
  assert.throws(
    () => parseChessMoveResponse('```json\n{"thought":"控制中心","move":"Nf3"}\n```'),
    /strict json/i
  )
})

test('parseChessMoveResponse 缺少 move 字段时拒绝', () => {
  assert.throws(
    () => parseChessMoveResponse('{"thought":"控制中心"}'),
    /move/i
  )
})

test('parseChessMoveResponse 非法 JSON 文本时抛出稳定业务错误', () => {
  assert.throws(
    () => parseChessMoveResponse('not json'),
    /strict json/i
  )
})
