import { describe, expect, test } from 'bun:test'
import {
  isOfficialAnthropicPackage,
  supportsManagedAutoInstall,
} from '../packageIdentity'

describe('packageIdentity', () => {
  test('recognizes official anthropic packages', () => {
    expect(isOfficialAnthropicPackage('@anthropic-ai/claude-code')).toBe(true)
    expect(supportsManagedAutoInstall('@anthropic-ai/claude-code')).toBe(true)
  })

  test('disables managed updates for fork distributions', () => {
    expect(isOfficialAnthropicPackage('@zyycn/claudex')).toBe(false)
    expect(supportsManagedAutoInstall('@zyycn/claudex')).toBe(false)
  })
})
