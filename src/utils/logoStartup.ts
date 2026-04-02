import { getGlobalConfig } from './config.js'
import { isBareMode } from './envUtils.js'
import { getRecentActivity } from './logoV2Utils.js'
import { checkForReleaseNotes } from './releaseNotes.js'

export async function preloadLogoData(): Promise<void> {
  if (isBareMode()) {
    return
  }

  await Promise.all([
    checkForReleaseNotes(getGlobalConfig().lastReleaseNotesSeen),
    getRecentActivity(),
  ])
}
