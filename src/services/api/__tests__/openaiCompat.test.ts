import { describe, expect, test } from 'bun:test'
import {
  convertAnthropicRequestToOpenAI,
  createAnthropicStreamFromOpenAI,
} from '../openaiCompat'

function createReader(events: unknown[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder()
  const payload = events
    .map(event => `data: ${JSON.stringify(event)}\n\n`)
    .join('')

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload))
      controller.close()
    },
  }).getReader()
}

describe('openaiCompat', () => {
  test('converts anthropic requests into OpenAI-compatible chat payloads', () => {
    process.env.ANTHROPIC_MODEL = 'gpt-4o-mini'

    const request = convertAnthropicRequestToOpenAI({
      model: 'claude-sonnet-4-5',
      system: [{ text: 'system one' }, { text: 'system two' }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'tool_result', tool_use_id: 'tool_1', content: '{"ok":true}' },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'working' },
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'lookup',
              input: { query: 'claudex' },
            },
          ],
        },
      ],
      tools: [
        {
          name: 'lookup',
          description: 'search docs',
          input_schema: {
            type: 'object',
            properties: { query: { type: 'string' } },
          },
        },
      ] as any,
      tool_choice: { type: 'tool', name: 'lookup' } as any,
      temperature: 0.2,
      max_tokens: 512,
    })

    expect(request).toEqual({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'system one\nsystem two' },
        { role: 'tool', tool_call_id: 'tool_1', content: '{"ok":true}' },
        { role: 'user', content: 'hello' },
        {
          role: 'assistant',
          content: 'working',
          tool_calls: [
            {
              id: 'tool_1',
              type: 'function',
              function: {
                name: 'lookup',
                arguments: JSON.stringify({ query: 'claudex' }),
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 512,
      tools: [
        {
          type: 'function',
          function: {
            name: 'lookup',
            description: 'search docs',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
            },
          },
        },
      ],
      tool_choice: {
        type: 'function',
        function: { name: 'lookup' },
      },
    })

    delete process.env.ANTHROPIC_MODEL
  })

  test('maps streamed text and multiple tool calls to unique anthropic content blocks', async () => {
    const generator = createAnthropicStreamFromOpenAI({
      reader: createReader([
        {
          id: 'resp_1',
          choices: [
            {
              delta: { content: 'Hi' },
              finish_reason: null,
            },
          ],
          usage: { prompt_tokens: 11 },
        },
        {
          id: 'resp_1',
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    function: { name: 'alpha', arguments: '{"a":' },
                  },
                  {
                    index: 1,
                    id: 'call_2',
                    function: { name: 'beta', arguments: '{"b":' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'resp_1',
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: '1}' } },
                  { index: 1, function: { arguments: '2}' } },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { completion_tokens: 7 },
        },
      ]),
      model: 'gpt-4o-mini',
    })

    const events: any[] = []
    while (true) {
      const next = await generator.next()
      if (next.done) {
        expect(next.value.stop_reason).toBe('tool_use')
        break
      }
      events.push(next.value)
    }

    expect(events.map(event => event.type)).toEqual([
      'message_start',
      'content_block_start',
      'content_block_delta',
      'content_block_start',
      'content_block_start',
      'content_block_delta',
      'content_block_delta',
      'content_block_stop',
      'content_block_stop',
      'content_block_stop',
      'message_delta',
      'message_stop',
    ])

    expect(events[1]).toMatchObject({ type: 'content_block_start', index: 0 })
    expect(events[3]).toMatchObject({
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id: 'call_1', name: 'alpha' },
    })
    expect(events[4]).toMatchObject({
      type: 'content_block_start',
      index: 2,
      content_block: { type: 'tool_use', id: 'call_2', name: 'beta' },
    })
    expect(events[5]).toMatchObject({
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: '1}' },
    })
    expect(events[6]).toMatchObject({
      type: 'content_block_delta',
      index: 2,
      delta: { type: 'input_json_delta', partial_json: '2}' },
    })
    expect(events[10]).toMatchObject({
      type: 'message_delta',
      delta: { stop_reason: 'tool_use' },
      usage: { input_tokens: 11, output_tokens: 7 },
    })
  })
})
