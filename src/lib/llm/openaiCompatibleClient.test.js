import test from 'node:test'
import assert from 'node:assert/strict'
import { requestOpenAiCompatibleMove } from './openaiCompatibleClient.js'

test('requestOpenAiCompatibleMove POST 到 chat/completions 并返回 content', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: '{"move":"e2e4"}',
              },
            },
          ],
        }
      },
    }
  }

  const content = await requestOpenAiCompatibleMove({
    requestUrl: 'https://example.com/v1/',
    apiKey: 'test-key',
    modelName: 'demo-model',
    messages: [{ role: 'user', content: 'pick a move' }],
    fetchImpl,
  })

  assert.equal(content, '{"move":"e2e4"}')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://example.com/v1/chat/completions')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: 'demo-model',
    messages: [{ role: 'user', content: 'pick a move' }],
    temperature: 0.2,
  })
})

test('requestOpenAiCompatibleMove 非 2xx 时抛出包含 status 和文本的稳定错误', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    async text() {
      return 'unauthorized'
    },
  })

  await assert.rejects(
    () =>
      requestOpenAiCompatibleMove({
        requestUrl: 'https://example.com/api',
        apiKey: 'bad-key',
        modelName: 'demo-model',
        messages: [],
        fetchImpl,
      }),
    (error) => {
      assert.match(error.message, /401/)
      assert.match(error.message, /unauthorized/)
      return true
    }
  )
})

test('requestOpenAiCompatibleMove 调试日志只输出请求与响应的 messages 内容', async () => {
  const originalConsoleInfo = console.info
  const logs = []
  console.info = (...args) => {
    logs.push(args)
  }

  try {
    await requestOpenAiCompatibleMove({
      requestUrl: 'https://example.com/v1',
      apiKey: 'super-secret-key',
      modelName: 'demo-model',
      messages: [{ role: 'user', content: 'pick a move' }],
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: '{"thought":"控制中心","move":"e2e4"}',
                },
              },
            ],
          }
        },
      }),
    })
  } finally {
    console.info = originalConsoleInfo
  }

  assert.equal(logs.length, 2)
  assert.equal(logs[0][0], '[LLM] Request messages')
  assert.deepEqual(logs[0][1], [{ role: 'user', content: 'pick a move' }])
  assert.equal(logs[1][0], '[LLM] Response message')
  assert.equal(logs[1][1], '{"thought":"控制中心","move":"e2e4"}')
})
