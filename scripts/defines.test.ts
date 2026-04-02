import { execFileSync } from 'child_process'
import { describe, expect, test } from 'bun:test'
import { getMacroDefines } from './defines'

describe('getMacroDefines', () => {
  test('falls back to CLAUDE_CODE_BIN_NAME when package bin override is unset', () => {
    const defines = getMacroDefines({
      CLAUDE_CODE_BIN_NAME: 'claudex',
    })

    expect(defines['MACRO.PACKAGE_BIN']).toBe('"claudex"')
  })

  test('prefers CLAUDE_CODE_PACKAGE_BIN over CLAUDE_CODE_BIN_NAME', () => {
    const defines = getMacroDefines({
      CLAUDE_CODE_BIN_NAME: 'claudex',
      CLAUDE_CODE_PACKAGE_BIN: 'custom-bin',
    })

    expect(defines['MACRO.PACKAGE_BIN']).toBe('"custom-bin"')
  })

  test('uses fork version with git sha for non-official packages by default', () => {
    const shortSha = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim()

    const defines = getMacroDefines({})

    expect(defines['MACRO.VERSION']).toBe(`"1.0.3-fork.${shortSha}"`)
  })
})
