import * as React from 'react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import BaseText from '../../../ink/components/Text.js';
import { renderToString as renderInkToString } from '../../../utils/staticRender.tsx';

type LogoState = {
  hasReleaseNotes: boolean;
  showOnboarding: boolean;
  showGuestPassesUpsell: boolean;
  showOverageCreditUpsell: boolean;
  forceFull: boolean;
  columns: number;
  agent: string | undefined;
  effortValue: string | undefined;
  version: string;
  cwd: string;
  billingType: string;
  agentNameFromSettings: string | undefined;
  displayName: string;
  organizationName: string | undefined;
  numStartups: number;
  companyAnnouncements: string[];
  lastReleaseNotesSeen: string;
};

const state: LogoState = {
  hasReleaseNotes: false,
  showOnboarding: false,
  showGuestPassesUpsell: false,
  showOverageCreditUpsell: false,
  forceFull: false,
  columns: 100,
  agent: 'builder',
  effortValue: undefined,
  version: '1.2.3',
  cwd: '/repo/project',
  billingType: 'Pro',
  agentNameFromSettings: 'settings-agent',
  displayName: 'Zyy',
  organizationName: undefined,
  numStartups: 1,
  companyAnnouncements: [],
  lastReleaseNotesSeen: '1.0.0',
};

(globalThis as unknown as { MACRO?: { PACKAGE_URL: string; VERSION: string } }).MACRO = {
  PACKAGE_URL: 'claudex',
  VERSION: state.version,
};

async function renderLogoV2ToString(node: React.ReactNode): Promise<string> {
  const rendered = await renderInkToString(node, state.columns);
  return rendered.replace(/\s+/g, ' ');
}

mock.module('bun:bundle', () => ({
  feature: () => false,
}));

mock.module('../../../hooks/useTerminalSize.js', () => ({
  useTerminalSize: () => ({ columns: state.columns, rows: 40 }),
}));

mock.module('../../../utils/logoV2Utils.js', () => ({
  getRecentActivitySync: () => [],
  getRecentReleaseNotesSync: () => [],
  getLogoDisplayData: () => ({
    version: state.version,
    cwd: state.cwd,
    billingType: state.billingType,
    agentName: state.agentNameFromSettings,
  }),
}));

mock.module('src/utils/config.js', () => ({
  getGlobalConfig: () => ({
    lastReleaseNotesSeen: state.lastReleaseNotesSeen,
    numStartups: state.numStartups,
    oauthAccount: {
      displayName: state.displayName,
      organizationName: state.organizationName,
    },
  }),
  saveGlobalConfig: () => {},
}));

mock.module('src/utils/settings/settings.js', () => ({
  getInitialSettings: () => ({
    companyAnnouncements: state.companyAnnouncements,
  }),
}));

mock.module('src/utils/debug.js', () => ({
  isDebugMode: () => false,
  isDebugToStdErr: () => false,
  getDebugLogPath: () => '/tmp/debug.log',
}));

mock.module('../../../projectOnboardingState.js', () => ({
  getSteps: () => [],
  shouldShowProjectOnboarding: () => state.showOnboarding,
  incrementProjectOnboardingSeenCount: () => {},
}));

mock.module('../../../utils/releaseNotes.js', () => ({
  checkForReleaseNotesSync: () => ({ hasReleaseNotes: state.hasReleaseNotes }),
}));

mock.module('src/utils/envUtils.js', () => ({
  isEnvTruthy: () => state.forceFull,
}));

mock.module('../feedConfigs.js', () => ({
  createRecentActivityFeed: () => ({ title: 'Recent activity', lines: [{ text: 'Activity item' }] }),
  createProjectOnboardingFeed: () => ({ title: 'Tips', lines: [{ text: 'Do the thing' }] }),
  createGuestPassesFeed: () => ({ title: 'Guest passes', lines: [{ text: 'Invite teammates' }] }),
  createWhatsNewFeed: () => ({ title: "What's new", lines: [{ text: 'Release note' }] }),
}));

mock.module('../GuestPassesUpsell.js', () => ({
  useShowGuestPassesUpsell: () => state.showGuestPassesUpsell,
  incrementGuestPassesSeenCount: () => {},
}));

mock.module('../OverageCreditUpsell.js', () => ({
  useShowOverageCreditUpsell: () => state.showOverageCreditUpsell,
  incrementOverageCreditUpsellSeenCount: () => {},
  createOverageCreditFeed: () => ({ title: 'Credits', lines: [{ text: 'Add credits' }] }),
}));

mock.module('../../../state/AppState.js', () => ({
  useAppState: (selector: (value: { agent: string | undefined; effortValue: string | undefined }) => unknown) =>
    selector({ agent: state.agent, effortValue: state.effortValue }),
}));

mock.module('../../../utils/effort.js', () => ({
  getEffortSuffix: () => '',
}));

mock.module('../../../hooks/useMainLoopModel.js', () => ({
  useMainLoopModel: () => 'claude-opus-4-6',
}));

mock.module('../../../utils/model/model.js', () => ({
  renderModelSetting: () => 'Claude Opus',
}));

mock.module('../CondensedLogo.js', () => ({
  CondensedLogo: () => <BaseText>[[CONDENSED_LOGO]]</BaseText>,
}));

mock.module('../FullLogo.js', () => ({
  FullLogo: () => <BaseText>[[FULL_LOGO]]</BaseText>,
}));

mock.module('../EmergencyTip.js', () => ({
  EmergencyTip: () => null,
}));

mock.module('../VoiceModeNotice.js', () => ({
  VoiceModeNotice: () => null,
}));

mock.module('../KirakiraNotice.js', () => ({
  KirakiraNotice: () => null,
}));

mock.module('src/utils/sandbox/sandbox-adapter.js', () => ({
  SandboxManager: {
    isSandboxingEnabled: () => false,
  },
}));

const { LogoV2 } = await import('../LogoV2.js');

function resetState(): void {
  state.hasReleaseNotes = false;
  state.showOnboarding = false;
  state.showGuestPassesUpsell = false;
  state.showOverageCreditUpsell = false;
  state.forceFull = false;
  state.columns = 100;
  state.agent = 'builder';
  state.effortValue = undefined;
  state.version = '1.2.3';
  state.cwd = '/repo/project';
  state.billingType = 'Pro';
  state.agentNameFromSettings = 'settings-agent';
  state.displayName = 'Zyy';
  state.organizationName = undefined;
  state.numStartups = 1;
  state.companyAnnouncements = [];
  state.lastReleaseNotesSeen = '1.0.0';
  (globalThis as unknown as { MACRO?: { PACKAGE_URL: string; VERSION: string } }).MACRO = {
    PACKAGE_URL: 'claudex',
    VERSION: state.version,
  };
}

beforeEach(() => {
  resetState();
});

describe('LogoV2', () => {
  test('renders condensed logo when release notes and onboarding are absent', async () => {
    const output = await renderLogoV2ToString(<LogoV2 />);

    expect(output).toContain('[[CONDENSED_LOGO]]');
    expect(output).not.toContain('[[FULL_LOGO]]');
  });

  test('renders full logo when release notes are available', async () => {
    state.hasReleaseNotes = true;

    const output = await renderLogoV2ToString(<LogoV2 />);

    expect(output).toContain('[[FULL_LOGO]]');
    expect(output).not.toContain('[[CONDENSED_LOGO]]');
  });

  test('renders full logo when force full mode is enabled', async () => {
    state.forceFull = true;

    const output = await renderLogoV2ToString(<LogoV2 />);

    expect(output).toContain('[[FULL_LOGO]]');
    expect(output).not.toContain('[[CONDENSED_LOGO]]');
  });
});
