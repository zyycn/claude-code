import * as React from 'react';
import { Box, Text, color } from '../../ink.js';
import { usePackageUpdateNotice } from '../../hooks/usePackageUpdateNotice.js';
import { stringWidth } from '../../ink/stringWidth.js';
import { getGlobalConfig } from 'src/utils/config.js';
import { resolveThemeSetting } from 'src/utils/systemTheme.js';
import {
  getLayoutMode,
  calculateLayoutDimensions,
  calculateOptimalLeftWidth,
  formatWelcomeMessage,
  truncatePath,
} from '../../utils/logoV2Utils.js';
import { formatPackageUpdateNotice } from '../../utils/packageUpdateNotice.js';
import { Clawd } from './Clawd.js';
import { calculateFeedWidth, type FeedConfig } from './Feed.js';
import { FeedColumn } from './FeedColumn.js';
import { Divider } from '../design-system/Divider.js';
import { OffscreenFreeze } from '../OffscreenFreeze.js';

type FullLogoProps = {
  columns: number;
  version: string;
  username: string;
  modelDisplayName: string;
  billingType: string;
  cwd: string;
  agentName?: string;
  modelLine: string;
  rightFeeds: FeedConfig[];
  reservedRightColumnFeeds: FeedConfig[];
};

const LEFT_PANEL_MAX_WIDTH = 50;
const HIDDEN_WHATS_NEW_WIDTH_REDUCTION = 10;

export function FullLogo({
  columns,
  version,
  username,
  modelDisplayName,
  billingType,
  cwd,
  agentName,
  modelLine,
  rightFeeds,
  reservedRightColumnFeeds,
}: FullLogoProps) {
  const packageUpdateInfo = usePackageUpdateNotice();
  const layoutMode = getLayoutMode(columns);
  const userTheme = resolveThemeSetting(getGlobalConfig().theme);
  const borderTitle = ` ${color('claude', userTheme)('Claude Code')} ${color('inactive', userTheme)(`v${version}`)} `;
  const compactBorderTitle = color('claude', userTheme)(' Claude Code ');

  if (layoutMode === 'compact') {
    let welcomeMessage = formatWelcomeMessage(username);
    if (stringWidth(welcomeMessage) > columns - 4) {
      welcomeMessage = formatWelcomeMessage('');
    }

    const cwdAvailableWidth = agentName ? columns - 4 - 1 - stringWidth(agentName) - 3 : columns - 4;
    const truncatedCwd = truncatePath(cwd, Math.max(cwdAvailableWidth, 10));
    const compactUpdateNotice = packageUpdateInfo
      ? formatPackageUpdateNotice(packageUpdateInfo, Math.max(columns - 4, 20))
      : null;

    return (
      <OffscreenFreeze>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="claude"
          borderText={{
            content: compactBorderTitle,
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
          <Box marginY={1}>
            <Clawd />
          </Box>
          {compactUpdateNotice && <Text color="warning">{compactUpdateNotice}</Text>}
          <Text dimColor={true}>{modelDisplayName}</Text>
          <Text dimColor={true}>{billingType}</Text>
          <Text dimColor={true}>{agentName ? `@${agentName} · ${truncatedCwd}` : truncatedCwd}</Text>
        </Box>
      </OffscreenFreeze>
    );
  }

  const welcomeMessage = formatWelcomeMessage(username);
  const cwdAvailableWidth = agentName ? LEFT_PANEL_MAX_WIDTH - 1 - stringWidth(agentName) - 3 : LEFT_PANEL_MAX_WIDTH;
  const truncatedCwd = truncatePath(cwd, Math.max(cwdAvailableWidth, 10));
  const cwdLine = agentName ? `@${agentName} · ${truncatedCwd}` : truncatedCwd;
  const optimalLeftWidth = calculateOptimalLeftWidth(welcomeMessage, cwdLine, modelLine);
  const { leftWidth, rightWidth } = calculateLayoutDimensions(columns, layoutMode, optimalLeftWidth);
  const preferredRightColumnWidth = Math.max(...reservedRightColumnFeeds.map(calculateFeedWidth));
  const minimumVisibleRightColumnWidth = Math.max(...rightFeeds.map(calculateFeedWidth));
  const rightColumnWidth = Math.min(
    Math.max(minimumVisibleRightColumnWidth, preferredRightColumnWidth - HIDDEN_WHATS_NEW_WIDTH_REDUCTION),
    rightWidth,
  );
  const fullUpdateNotice = packageUpdateInfo
    ? formatPackageUpdateNotice(packageUpdateInfo, Math.max(rightColumnWidth - stringWidth('✦ '), 12))
    : null;

  return (
    <OffscreenFreeze>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="claude"
        borderText={{
          content: borderTitle,
          position: 'top',
          align: 'start',
          offset: 3,
        }}
      >
        <Box flexDirection="row" paddingX={1} gap={1}>
          <Box
            flexDirection="column"
            width={leftWidth}
            justifyContent="space-between"
            alignItems="center"
            minHeight={10}
          >
            <Box marginTop={1}>
              <Text bold={true}>{welcomeMessage}</Text>
            </Box>
            <Clawd />
            <Box flexDirection="column" alignItems="center">
              <Text dimColor={true}>{modelLine}</Text>
              <Text dimColor={true}>{cwdLine}</Text>
            </Box>
          </Box>
          <Box
            height="100%"
            borderStyle="single"
            borderColor="claude"
            borderDimColor={true}
            borderTop={false}
            borderBottom={false}
            borderLeft={false}
          />
          <Box
            flexDirection="column"
            width={rightColumnWidth}
            minHeight={10}
            justifyContent={fullUpdateNotice ? 'space-between' : 'flex-start'}
          >
            <FeedColumn feeds={rightFeeds} maxWidth={rightWidth} />
            {fullUpdateNotice && (
              <Box flexDirection="column" width={rightColumnWidth}>
                <Divider color="claude" width={rightColumnWidth} />
                <Text color="warning">✦ {fullUpdateNotice}</Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </OffscreenFreeze>
  );
}
