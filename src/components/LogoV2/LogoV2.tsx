// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Box, Text } from '../../ink.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { getRecentActivitySync, getRecentReleaseNotesSync, getLogoDisplayData } from '../../utils/logoV2Utils.js';
import { truncate } from '../../utils/format.js';
import { getGlobalConfig, saveGlobalConfig } from 'src/utils/config.js';
import { getInitialSettings } from 'src/utils/settings/settings.js';
import { isDebugMode, isDebugToStdErr, getDebugLogPath } from 'src/utils/debug.js';
import {
  getSteps,
  shouldShowProjectOnboarding,
  incrementProjectOnboardingSeenCount,
} from '../../projectOnboardingState.js';
import { CondensedLogo } from './CondensedLogo.js';
import { FullLogo } from './FullLogo.js';
import { checkForReleaseNotesSync } from '../../utils/releaseNotes.js';
import { isEnvTruthy } from 'src/utils/envUtils.js';
import { EmergencyTip } from './EmergencyTip.js';
import { VoiceModeNotice } from './VoiceModeNotice.js';
import { KirakiraNotice } from './KirakiraNotice.js';
import { feature } from 'bun:bundle';
import { SandboxManager } from 'src/utils/sandbox/sandbox-adapter.js';
import {
  createRecentActivityFeed,
  createProjectOnboardingFeed,
  createGuestPassesFeed,
  createWhatsNewFeed,
} from './feedConfigs.js';
import { useShowGuestPassesUpsell, incrementGuestPassesSeenCount } from './GuestPassesUpsell.js';
import {
  useShowOverageCreditUpsell,
  incrementOverageCreditUpsellSeenCount,
  createOverageCreditFeed,
} from './OverageCreditUpsell.js';
import { useAppState } from '../../state/AppState.js';
import { getEffortSuffix } from '../../utils/effort.js';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { renderModelSetting } from '../../utils/model/model.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const ChannelsNoticeModule =
  feature('KAIROS') || feature('KAIROS_CHANNELS')
    ? (require('./ChannelsNotice.js') as typeof import('./ChannelsNotice.js'))
    : null;
/* eslint-enable @typescript-eslint/no-require-imports */

const LEFT_PANEL_MAX_WIDTH = 50;

export function LogoV2() {
  const activities = getRecentActivitySync();
  const config = getGlobalConfig();
  const username = config.oauthAccount?.displayName ?? '';
  const { columns } = useTerminalSize();
  const showOnboarding = shouldShowProjectOnboarding();
  const showSandboxStatus = SandboxManager.isSandboxingEnabled();
  const showGuestPassesUpsell = useShowGuestPassesUpsell();
  const showOverageCreditUpsell = useShowOverageCreditUpsell();
  const agent = useAppState(state => state.agent);
  const effortValue = useAppState(state => state.effortValue);
  const model = useMainLoopModel();
  const fullModelDisplayName = renderModelSetting(model);
  const { version, cwd, billingType, agentName: agentNameFromSettings } = getLogoDisplayData();
  const agentName = agent ?? agentNameFromSettings;
  const effortSuffix = getEffortSuffix(model, effortValue);
  const modelDisplayName = truncate(fullModelDisplayName + effortSuffix, LEFT_PANEL_MAX_WIDTH - 20);
  const { hasReleaseNotes } = checkForReleaseNotesSync(config.lastReleaseNotesSeen);
  const showCondensedMode =
    !hasReleaseNotes && !showOnboarding && !isEnvTruthy(process.env.CLAUDE_CODE_FORCE_FULL_LOGO);

  let changelog: string[];
  try {
    changelog = getRecentReleaseNotesSync(3);
  } catch {
    changelog = [];
  }

  const [announcement] = useState(() => {
    const announcements = getInitialSettings().companyAnnouncements;
    if (!announcements || announcements.length === 0) {
      return undefined;
    }

    return config.numStartups === 1
      ? announcements[0]
      : announcements[Math.floor(Math.random() * announcements.length)];
  });

  useEffect(() => {
    if (config.lastReleaseNotesSeen === MACRO.VERSION) {
      return;
    }

    saveGlobalConfig(current => {
      if (current.lastReleaseNotesSeen === MACRO.VERSION) {
        return current;
      }

      return {
        ...current,
        lastReleaseNotesSeen: MACRO.VERSION,
      };
    });

    if (showOnboarding) {
      incrementProjectOnboardingSeenCount();
    }
  }, [config, showOnboarding]);

  useEffect(() => {
    if (showGuestPassesUpsell && !showOnboarding && !showCondensedMode) {
      incrementGuestPassesSeenCount();
    }
  }, [showGuestPassesUpsell, showOnboarding, showCondensedMode]);

  useEffect(() => {
    if (showOverageCreditUpsell && !showOnboarding && !showGuestPassesUpsell && !showCondensedMode) {
      incrementOverageCreditUpsellSeenCount();
    }
  }, [showOverageCreditUpsell, showOnboarding, showGuestPassesUpsell, showCondensedMode]);

  const rightFeeds = showOnboarding
    ? [createProjectOnboardingFeed(getSteps()), createRecentActivityFeed(activities)]
    : showGuestPassesUpsell
      ? [createRecentActivityFeed(activities), createGuestPassesFeed()]
      : showOverageCreditUpsell
        ? [createRecentActivityFeed(activities), createOverageCreditFeed()]
        : [createRecentActivityFeed(activities)];

  const reservedRightColumnFeeds =
    !showOnboarding && !showGuestPassesUpsell && !showOverageCreditUpsell
      ? [...rightFeeds, createWhatsNewFeed(changelog)]
      : rightFeeds;

  const modelLine =
    !process.env.IS_DEMO && config.oauthAccount?.organizationName
      ? `${modelDisplayName} · ${billingType} · ${config.oauthAccount.organizationName}`
      : `${modelDisplayName} · ${billingType}`;

  const logo = showCondensedMode ? (
    <CondensedLogo />
  ) : (
    <FullLogo
      columns={columns}
      version={version}
      username={username}
      modelDisplayName={modelDisplayName}
      billingType={billingType}
      cwd={cwd}
      agentName={agentName}
      modelLine={modelLine}
      rightFeeds={rightFeeds}
      reservedRightColumnFeeds={reservedRightColumnFeeds}
    />
  );

  return (
    <>
      {logo}
      <VoiceModeNotice />
      <KirakiraNotice />
      {ChannelsNoticeModule && <ChannelsNoticeModule.ChannelsNotice />}
      {isDebugMode() && (
        <Box paddingLeft={2} flexDirection="column">
          <Text color="warning">Debug mode enabled</Text>
          <Text dimColor={true}>Logging to: {isDebugToStdErr() ? 'stderr' : getDebugLogPath()}</Text>
        </Box>
      )}
      <EmergencyTip />
      {process.env.CLAUDE_CODE_TMUX_SESSION && (
        <Box paddingLeft={2} flexDirection="column">
          <Text dimColor={true}>tmux session: {process.env.CLAUDE_CODE_TMUX_SESSION}</Text>
          <Text dimColor={true}>
            {process.env.CLAUDE_CODE_TMUX_PREFIX_CONFLICTS
              ? `Detach: ${process.env.CLAUDE_CODE_TMUX_PREFIX} ${process.env.CLAUDE_CODE_TMUX_PREFIX} d (press prefix twice - Claude uses ${process.env.CLAUDE_CODE_TMUX_PREFIX})`
              : `Detach: ${process.env.CLAUDE_CODE_TMUX_PREFIX} d`}
          </Text>
        </Box>
      )}
      {announcement && (
        <Box paddingLeft={2} flexDirection="column">
          {!process.env.IS_DEMO && config.oauthAccount?.organizationName && (
            <Text dimColor={true}>Message from {config.oauthAccount.organizationName}:</Text>
          )}
          <Text>{announcement}</Text>
        </Box>
      )}
      {!showCondensedMode && showSandboxStatus && (
        <Box paddingLeft={2} flexDirection="column">
          <Text color="warning">Your bash commands will be sandboxed. Disable with /sandbox.</Text>
        </Box>
      )}
    </>
  );
}
