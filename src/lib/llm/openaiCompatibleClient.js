function normalizeRequestUrl(requestUrl) {
  return String(requestUrl).replace(/\/+$/, '')
}

export async function requestOpenAiCompatibleMove({
  requestUrl,
  apiKey,
  modelName,
  messages,
  fetchImpl = fetch,
}) {
  const url = `${normalizeRequestUrl(requestUrl)}/chat/completions`
  console.info('[LLM] Request messages', messages)

  const response = await fetchImpl(url, {
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
    const responseText = typeof response.text === 'function' ? await response.text() : ''
    const detail = responseText ? `: ${responseText}` : ''
    throw new Error(`OpenAI-compatible request failed with status ${response.status}${detail}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    throw new Error('OpenAI-compatible response missing choices[0].message.content')
  }

  console.info('[LLM] Response message', content)

  return content
}
