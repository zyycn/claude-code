import { afterEach, describe, expect, test } from 'bun:test'
import { getCliBin, getCliDisplayName } from '../cliBranding'

describe('cliBranding', () => {
  const savedBinName = process.env.CLAUDE_CODE_BIN_NAME

  afterEach(() => {
    if (savedBinName === undefined) delete process.env.CLAUDE_CODE_BIN_NAME
    else process.env.CLAUDE_CODE_BIN_NAME = savedBinName
  })

  test('prefers CLAUDE_CODE_BIN_NAME when provided', () => {
    process.env.CLAUDE_CODE_BIN_NAME = 'claudex'

    expect(getCliBin()).toBe('claudex')
    expect(getCliDisplayName()).toBe('Claudex Code')
  })

  test('falls back to claude when runtime macros are unavailable', () => {
    delete process.env.CLAUDE_CODE_BIN_NAME

    expect(getCliBin()).toBe('claude')
    expect(getCliDisplayName()).toBe('Claude Code')
  })

  test('keeps the upstream display name for the default binary', () => {
    expect(getCliDisplayName('claude')).toBe('Claude Code')
  })
})
