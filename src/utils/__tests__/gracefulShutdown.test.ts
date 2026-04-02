import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

type WriteCall = {
  fd: number
  text: string
}

const writeCalls: WriteCall[] = []
const processExitCalls: number[] = []

mock.module('fs', () => ({
  writeSync: (fd: number, text: string) => {
    writeCalls.push({ fd, text: String(text) })
    return String(text).length
  },
}))

mock.module('chalk', () => ({
  default: {
    dim: (text: string) => text,
  },
}))

mock.module('signal-exit', () => ({
  onExit: () => () => {},
}))

mock.module('src/bootstrap/state.js', () => ({
  getIsInteractive: () => true,
  getIsScrollDraining: () => false,
  getLastMainRequestId: () => undefined,
  getSessionId: () => 'session-1',
  isSessionPersistenceDisabled: () => false,
}))

mock.module('src/ink/instances.js', () => ({
  default: {
    get: () => ({
      isAltScreenActive: false,
      drainStdin: () => {},
      detachForShutdown: () => {},
    }),
  },
}))

mock.module('src/ink/termio/csi.js', () => ({
  DISABLE_KITTY_KEYBOARD: '<kitty-off>',
  DISABLE_MODIFY_OTHER_KEYS: '<mok-off>',
}))

mock.module('src/ink/termio/dec.js', () => ({
  DBP: '<dbp-off>',
  DFE: '<dfe-off>',
  DISABLE_MOUSE_TRACKING: '<mouse-off>',
  EXIT_ALT_SCREEN: '<alt-off>',
  SHOW_CURSOR: '<cursor-on>',
}))

mock.module('src/ink/termio/osc.js', () => ({
  CLEAR_ITERM2_PROGRESS: '<progress-off>',
  CLEAR_TAB_STATUS: '<tab-off>',
  CLEAR_TERMINAL_TITLE: '<title-off>',
  supportsTabStatus: () => false,
  wrapForMultiplexer: (text: string) => text,
}))

mock.module('src/services/analytics/datadog.js', () => ({
  shutdownDatadog: async () => {},
}))

mock.module('src/services/analytics/firstPartyEventLogger.js', () => ({
  shutdown1PEventLogging: async () => {},
}))

mock.module('src/services/analytics/index.js', () => ({
  logEvent: () => {},
}))

mock.module('src/utils/cleanupRegistry.js', () => ({
  runCleanupFunctions: async () => {},
}))

mock.module('src/utils/debug.js', () => ({
  logForDebugging: () => {},
}))

mock.module('src/utils/diagLogs.js', () => ({
  logForDiagnosticsNoPII: () => {},
}))

mock.module('src/utils/cliBranding.js', () => ({
  getCliBin: () => 'claudex',
}))

mock.module('src/utils/envUtils.js', () => ({
  isEnvTruthy: () => false,
}))

mock.module('src/utils/sessionStorage.js', () => ({
  getCurrentSessionTitle: () => undefined,
  sessionIdExists: () => false,
}))

mock.module('src/utils/sleep.js', () => ({
  sleep: async () => {},
}))

mock.module('src/utils/startupProfiler.js', () => ({
  profileReport: () => {},
}))

mock.module('src/utils/hooks.js', () => ({
  executeSessionEndHooks: async () => {},
  getSessionEndHookTimeoutMs: () => 0,
}))

const {
  gracefulShutdown,
  resetShutdownState,
} = await import('src/utils/gracefulShutdown.js')

describe('gracefulShutdown exit boundary', () => {
  const originalExit = process.exit
  const stdoutTTY = process.stdout.isTTY
  const stderrTTY = process.stderr.isTTY

  beforeEach(() => {
    writeCalls.length = 0
    processExitCalls.length = 0
    resetShutdownState()

    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(process.stderr, 'isTTY', {
      configurable: true,
      value: true,
    })

    process.exit = ((code?: number) => {
      processExitCalls.push(code ?? 0)
      throw new Error(`process.exit:${code ?? 0}`)
    }) as typeof process.exit
  })

  afterEach(() => {
    process.exit = originalExit
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: stdoutTTY,
    })
    Object.defineProperty(process.stderr, 'isTTY', {
      configurable: true,
      value: stderrTTY,
    })
    resetShutdownState()
  })

  test('prints a newline when no resume hint or final message is available', async () => {
    await expect(gracefulShutdown(0)).rejects.toThrow('process.exit:0')

    expect(processExitCalls).toEqual([0])
    expect(writeCalls.some(call => call.fd === 1 && call.text === '\n')).toBe(
      true,
    )
  })

  test('does not print an extra stdout newline before a final message', async () => {
    await expect(
      gracefulShutdown(0, 'other', { finalMessage: 'bye' }),
    ).rejects.toThrow('process.exit:0')

    expect(processExitCalls).toEqual([0])
    expect(writeCalls.some(call => call.fd === 1 && call.text === '\n')).toBe(
      false,
    )
    expect(writeCalls.some(call => call.fd === 2 && call.text === 'bye\n')).toBe(
      true,
    )
  })
})
