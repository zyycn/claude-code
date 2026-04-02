import { describe, expect, mock, test } from 'bun:test'

const state = {
  bareMode: false,
  lastReleaseNotesSeen: '1.2.3',
  releaseNotesArgs: [] as Array<string | undefined>,
  releaseNotesCalls: 0,
  recentActivityCalls: 0,
}

mock.module('src/utils/config.js', () => ({
  getGlobalConfig: () => ({
    lastReleaseNotesSeen: state.lastReleaseNotesSeen,
  }),
}))

mock.module('src/utils/envUtils.js', () => ({
  isBareMode: () => state.bareMode,
}))

mock.module('src/utils/releaseNotes.js', () => ({
  checkForReleaseNotes: async (lastReleaseNotesSeen?: string) => {
    state.releaseNotesCalls += 1
    state.releaseNotesArgs.push(lastReleaseNotesSeen)
    return { hasReleaseNotes: false, releaseNotes: [] }
  },
}))

mock.module('src/utils/logoV2Utils.js', () => ({
  getRecentActivity: async () => {
    state.recentActivityCalls += 1
    return []
  },
}))

const { preloadLogoData } = await import('src/utils/logoStartup.js')

function resetState(): void {
  state.bareMode = false
  state.lastReleaseNotesSeen = '1.2.3'
  state.releaseNotesArgs = []
  state.releaseNotesCalls = 0
  state.recentActivityCalls = 0
}

describe('preloadLogoData', () => {
  test('preloads both release notes and recent activity in interactive mode', async () => {
    resetState()

    await preloadLogoData()

    expect(state.releaseNotesCalls).toBe(1)
    expect(state.releaseNotesArgs).toEqual(['1.2.3'])
    expect(state.recentActivityCalls).toBe(1)
  })

  test('still preloads recent activity when no release notes are available', async () => {
    resetState()

    await preloadLogoData()

    expect(state.recentActivityCalls).toBe(1)
  })

  test('skips all preloading in bare mode', async () => {
    resetState()
    state.bareMode = true

    await preloadLogoData()

    expect(state.releaseNotesCalls).toBe(0)
    expect(state.recentActivityCalls).toBe(0)
  })
})
