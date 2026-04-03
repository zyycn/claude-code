import * as React from 'react';
import { useEffect } from 'react';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { usePackageUpdateNotice } from '../../hooks/usePackageUpdateNotice.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { stringWidth } from '../../ink/stringWidth.js';
import { Box, Text } from '../../ink.js';
import { useAppState } from '../../state/AppState.js';
import { getGlobalConfig } from '../../utils/config.js';
import { getEffortSuffix } from '../../utils/effort.js';
import { truncate } from '../../utils/format.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
import {
  formatModelAndBilling,
  formatWelcomeMessage,
  getLogoDisplayData,
  getRecentActivitySync,
  truncatePath,
} from '../../utils/logoV2Utils.js';
import { renderModelSetting } from '../../utils/model/model.js';
import { formatPackageUpdateNotice } from '../../utils/packageUpdateNotice.js';
import { OffscreenFreeze } from '../OffscreenFreeze.js';
import { AnimatedClawd } from './AnimatedClawd.js';
import { Clawd } from './Clawd.js';
import { GuestPassesUpsell, incrementGuestPassesSeenCount, useShowGuestPassesUpsell } from './GuestPassesUpsell.js';
import {
  incrementOverageCreditUpsellSeenCount,
  OverageCreditUpsell,
  useShowOverageCreditUpsell,
} from './OverageCreditUpsell.js';

export function CondensedLogo() {
  const { columns } = useTerminalSize();
  const agent = useAppState(state => state.agent);
  const effortValue = useAppState(state => state.effortValue);
  const model = useMainLoopModel();
  const packageUpdateInfo = usePackageUpdateNotice();
  const modelDisplayName = renderModelSetting(model);
  const { version, cwd, billingType, agentName: agentNameFromSettings } = getLogoDisplayData();
  const username = getGlobalConfig().oauthAccount?.displayName ?? '';
  const welcomeMessage = formatWelcomeMessage(username);
  const agentName = agent ?? agentNameFromSettings;
  const activities = getRecentActivitySync();
  const showGuestPassesUpsell = useShowGuestPassesUpsell();
  const showOverageCreditUpsell = useShowOverageCreditUpsell();

  useEffect(() => {
    if (showGuestPassesUpsell) {
      incrementGuestPassesSeenCount();
    }
  }, [showGuestPassesUpsell]);

  useEffect(() => {
    if (showOverageCreditUpsell && !showGuestPassesUpsell) {
      incrementOverageCreditUpsellSeenCount();
    }
  }, [showOverageCreditUpsell, showGuestPassesUpsell]);

  const contentWidth = Math.max(columns - 4, 20);
  const truncatedVersion = truncate(version, Math.max(contentWidth - 14, 6));
  const borderTitle = columns < 36 ? ' Claude Code ' : ` Claude Code v${truncatedVersion} `;
  const effortSuffix = getEffortSuffix(model, effortValue);
  const { shouldSplit, truncatedModel, truncatedBilling } = formatModelAndBilling(
    modelDisplayName + effortSuffix,
    billingType,
    contentWidth,
  );
  const packageUpdateNotice = packageUpdateInfo ? formatPackageUpdateNotice(packageUpdateInfo, contentWidth) : null;
  const cwdAvailableWidth = agentName ? contentWidth - 1 - stringWidth(agentName) - 3 : contentWidth;
  const truncatedCwd = truncatePath(cwd, Math.max(cwdAvailableWidth, 10));
  const recentSummaryItems = activities
    .map(log => {
      if (log.summary && log.summary !== 'No prompt') {
        return log.summary;
      }

      return log.firstPrompt ?? '';
    })
    .filter(Boolean)
    .slice(0, 3);
  const recentSummary = truncate(`Recent: ${recentSummaryItems.join(' · ') || 'No recent activity'}`, contentWidth);
  const logo = isFullscreenEnvEnabled() ? <AnimatedClawd /> : <Clawd />;

  return (
    <>
      <OffscreenFreeze>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="claude"
          borderText={{
            content: borderTitle,
            position: 'top',
            align: 'start',
            offset: 1,
          }}
          paddingX={1}
          paddingY={1}
          alignItems="center"
          width={columns}
        >
          <Text bold={true}>{welcomeMessage}</Text>
          <Box marginY={1}>{logo}</Box>
          {packageUpdateNotice && <Text color="warning">{packageUpdateNotice}</Text>}
          {shouldSplit ? (
            <>
              <Text dimColor={true}>{truncatedModel}</Text>
              <Text dimColor={true}>{truncatedBilling}</Text>
            </>
          ) : (
            <Text dimColor={true}>
              {truncatedModel} · {truncatedBilling}
            </Text>
          )}
          <Text dimColor={true}>{agentName ? `@${agentName} · ${truncatedCwd}` : truncatedCwd}</Text>
          <Box marginTop={1}>
            <Text dimColor={true}>{recentSummary}</Text>
          </Box>
        </Box>
      </OffscreenFreeze>
      {showGuestPassesUpsell && <GuestPassesUpsell />}
      {!showGuestPassesUpsell && showOverageCreditUpsell && (
        <OverageCreditUpsell maxWidth={contentWidth} twoLine={true} />
      )}
    </>
  );
}
