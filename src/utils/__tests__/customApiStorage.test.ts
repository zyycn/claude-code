import { describe, expect, test } from 'bun:test'
import {
  addSavedModelForProvider,
  getSavedModelsForProvider,
} from '../customApiStorage'

describe('customApiStorage model persistence', () => {
  test('keeps saved models isolated by compatible endpoint provider', () => {
    const seeded = addSavedModelForProvider(
      {},
      'anthropic',
      'claude-3-5-sonnet',
    )
    const updated = addSavedModelForProvider(seeded, 'openai', 'gpt-4o-mini')

    expect(getSavedModelsForProvider(updated, 'anthropic')).toEqual([
      'claude-3-5-sonnet',
    ])
    expect(getSavedModelsForProvider(updated, 'openai')).toEqual([
      'gpt-4o-mini',
    ])
  })

  test('deduplicates saved models for the same provider', () => {
    const seeded = addSavedModelForProvider({}, 'openai', 'gpt-4o-mini')
    const updated = addSavedModelForProvider(seeded, 'openai', 'gpt-4o-mini')

    expect(getSavedModelsForProvider(updated, 'openai')).toEqual([
      'gpt-4o-mini',
    ])
  })
})
