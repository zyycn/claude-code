import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../../Tool.js'
import {
  applyPermissionCommandSelection,
  getPermissionCommandCancelMessage,
  getPermissionCommandOptions,
} from '../utils.js'

describe('getPermissionCommandOptions', () => {
  test('marks default as current when session is in default mode', () => {
    const options = getPermissionCommandOptions('default', true)

    expect(options[0]).toMatchObject({
      label: 'Default (current)',
      value: 'default',
    })
    expect(options[1]).toMatchObject({
      label: 'Full Access',
      value: 'full-access',
      disabled: false,
    })
  })

  test('marks full access as current and disabled when unavailable', () => {
    const options = getPermissionCommandOptions('bypassPermissions', false)

    expect(options[1]).toMatchObject({
      label: 'Full Access (current)',
      value: 'full-access',
      disabled: true,
    })
  })
})

describe('applyPermissionCommandSelection', () => {
  test('switches to bypassPermissions and unlocks full access for the session', () => {
    const nextContext = applyPermissionCommandSelection(
      getEmptyToolPermissionContext(),
      'full-access',
    )

    expect(nextContext.mode).toBe('bypassPermissions')
    expect(nextContext.isBypassPermissionsModeAvailable).toBe(true)
  })

  test('returns to default mode while preserving session full-access availability', () => {
    const fullAccessContext = applyPermissionCommandSelection(
      getEmptyToolPermissionContext(),
      'full-access',
    )
    const nextContext = applyPermissionCommandSelection(
      fullAccessContext,
      'default',
    )

    expect(nextContext.mode).toBe('default')
    expect(nextContext.isBypassPermissionsModeAvailable).toBe(true)
  })
})

describe('getPermissionCommandCancelMessage', () => {
  test('uses the current permission mode title in the cancel message', () => {
    expect(getPermissionCommandCancelMessage('plan')).toBe(
      'Kept permission mode: Plan Mode',
    )
  })
})
