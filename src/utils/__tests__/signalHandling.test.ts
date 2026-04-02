import { describe, expect, mock, test } from 'bun:test'
import { handleMainSigint } from 'src/utils/signalHandling.js'

describe('handleMainSigint', () => {
  test('uses graceful shutdown for interactive sessions', () => {
    const shutdown = mock(() => {})

    handleMainSigint(['claude'], shutdown)

    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(shutdown).toHaveBeenCalledWith(0)
  })

  test('ignores SIGINT here in print mode', () => {
    const shutdown = mock(() => {})

    handleMainSigint(['claude', '--print'], shutdown)
    handleMainSigint(['claude', '-p'], shutdown)

    expect(shutdown).not.toHaveBeenCalled()
  })
})
