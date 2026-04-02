import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js';
import { installOAuthTokens } from '../cli/handlers/auth.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { setClipboard } from '../ink/termio/osc.js';
import { useTerminalNotification } from '../ink/useTerminalNotification.js';
import { Box, Link, Text } from '../ink.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { getSSLErrorHint } from '../services/api/errorUtils.js';
import { sendNotification } from '../services/notifier.js';
import { OAuthService } from '../services/oauth/index.js';
import { getOauthAccountInfo, validateForceLoginOrg } from '../utils/auth.js';
import { normalizeApiKeyForConfig } from '../utils/authPortable.js';
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js';
import {
  addSavedModelForProvider,
  type CompatibleApiProvider,
  getSavedModelsForProvider,
  readCustomApiStorage,
  writeCustomApiStorage,
} from '../utils/customApiStorage.js';
import { logError } from '../utils/log.js';
import { getSettings_DEPRECATED } from '../utils/settings/settings.js';
import { Select } from './CustomSelect/select.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { Spinner } from './Spinner.js';
import TextInput from './TextInput.js';

type Props = {
  onDone(): void;
  startingMessage?: string;
  mode?: 'login' | 'setup-token';
  forceLoginMethod?: 'claudeai' | 'console';
};

type OAuthStatus =
  | { state: 'idle' }
  | { state: 'custom_config'; provider: CompatibleApiProvider; step: 'baseURL' | 'apiKey' | 'model' }
  | { state: 'platform_setup' }
  | { state: 'ready_to_start' }
  | { state: 'waiting_for_login'; url: string }
  | { state: 'creating_api_key' }
  | { state: 'about_to_retry'; nextState: OAuthStatus }
  | { state: 'success'; token?: string }
  | { state: 'error'; message: string; toRetry?: OAuthStatus };

const PASTE_HERE_MSG = 'Paste code here if prompted > ';

export function ConsoleOAuthFlow({
  onDone,
  startingMessage,
  mode = 'login',
  forceLoginMethod: forceLoginMethodProp,
}: Props): React.ReactNode {
  const settings = getSettings_DEPRECATED() || {};
  const forceLoginMethod = forceLoginMethodProp ?? settings.forceLoginMethod;
  const orgUUID = settings.forceLoginOrgUUID;
  const forcedMethodMessage =
    forceLoginMethod === 'claudeai'
      ? 'Login method pre-selected: Subscription Plan (Claude Pro/Max)'
      : forceLoginMethod === 'console'
        ? 'Login method pre-selected: API Usage Billing (Anthropic Console)'
        : null;

  const persistedCustomApiEndpoint = useMemo(
    () => ({
      ...(getGlobalConfig().customApiEndpoint ?? {}),
      ...readCustomApiStorage(),
    }),
    [],
  );
  const persistedProvider = persistedCustomApiEndpoint.provider ?? 'anthropic';
  const terminal = useTerminalNotification();
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus>(() => {
    if (mode === 'setup-token') return { state: 'ready_to_start' };
    if (forceLoginMethod === 'claudeai' || forceLoginMethod === 'console') {
      return { state: 'ready_to_start' };
    }
    return { state: 'idle' };
  });
  const [compatibleApiProvider, setCompatibleApiProvider] = useState<CompatibleApiProvider>(persistedProvider);
  const [pastedCode, setPastedCode] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);
  const [customBaseURL, setCustomBaseURL] = useState(
    persistedCustomApiEndpoint.baseURL ?? process.env.ANTHROPIC_BASE_URL ?? '',
  );
  const [customApiKey, setCustomApiKey] = useState(
    persistedCustomApiEndpoint.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
  );
  const [customModel, setCustomModel] = useState(persistedCustomApiEndpoint.model ?? process.env.ANTHROPIC_MODEL ?? '');
  const [oauthService] = useState(() => new OAuthService());
  const [loginWithClaudeAi, setLoginWithClaudeAi] = useState(
    () => mode === 'setup-token' || forceLoginMethod === 'claudeai',
  );
  const [showPastePrompt, setShowPastePrompt] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [isCustomInputPasting, setIsCustomInputPasting] = useState(false);
  const textInputColumns = useTerminalSize().columns - PASTE_HERE_MSG.length - 1;

  const startCompatibleApiConfig = useCallback((provider: CompatibleApiProvider) => {
    setCompatibleApiProvider(provider);
    setOAuthStatus({
      state: 'custom_config',
      provider,
      step: 'baseURL',
    });
  }, []);

  useEffect(() => {
    if (forceLoginMethod === 'claudeai') {
      logEvent('tengu_oauth_claudeai_forced', {});
    } else if (forceLoginMethod === 'console') {
      logEvent('tengu_oauth_console_forced', {});
    }
  }, [forceLoginMethod]);

  useEffect(() => {
    if (oauthStatus.state === 'about_to_retry') {
      const timer = setTimeout(setOAuthStatus, 1000, oauthStatus.nextState);
      return () => clearTimeout(timer);
    }
  }, [oauthStatus]);

  useKeybinding(
    'confirm:yes',
    () => {
      logEvent('tengu_oauth_success', { loginWithClaudeAi });
      onDone();
    },
    {
      context: 'Confirmation',
      isActive: oauthStatus.state === 'success' && mode !== 'setup-token',
    },
  );

  useKeybinding(
    'confirm:yes',
    () => {
      setOAuthStatus({ state: 'idle' });
    },
    {
      context: 'Confirmation',
      isActive: oauthStatus.state === 'platform_setup',
    },
  );

  useKeybinding(
    'confirm:yes',
    () => {
      if (oauthStatus.state === 'error' && oauthStatus.toRetry) {
        setPastedCode('');
        setOAuthStatus({
          state: 'about_to_retry',
          nextState: oauthStatus.toRetry,
        });
      }
    },
    {
      context: 'Confirmation',
      isActive: oauthStatus.state === 'error' && Boolean(oauthStatus.toRetry),
    },
  );

  useEffect(() => {
    if (pastedCode === 'c' && oauthStatus.state === 'waiting_for_login' && showPastePrompt && !urlCopied) {
      void setClipboard(oauthStatus.url).then(raw => {
        if (raw) process.stdout.write(raw);
        setUrlCopied(true);
        setTimeout(setUrlCopied, 2000, false);
      });
      setPastedCode('');
    }
  }, [oauthStatus, pastedCode, showPastePrompt, urlCopied]);

  const persistCustomEndpoint = useCallback(() => {
    const nextBaseURL = customBaseURL.trim();
    const nextApiKey = customApiKey.trim();
    const nextModel = customModel.trim();
    const normalizedKey = nextApiKey ? normalizeApiKeyForConfig(nextApiKey) : null;
    const nextPersistedEndpoint = nextModel
      ? addSavedModelForProvider(
          {
            ...persistedCustomApiEndpoint,
            provider: compatibleApiProvider,
            baseURL: nextBaseURL,
            apiKey: nextApiKey,
            model: nextModel,
          },
          compatibleApiProvider,
          nextModel,
        )
      : {
          ...persistedCustomApiEndpoint,
          provider: compatibleApiProvider,
          baseURL: nextBaseURL,
          apiKey: nextApiKey,
          model: nextModel,
        };
    const nextSavedModels = getSavedModelsForProvider(nextPersistedEndpoint, compatibleApiProvider);

    process.env.ANTHROPIC_BASE_URL = nextBaseURL;
    process.env.ANTHROPIC_API_KEY = nextApiKey;
    process.env.ANTHROPIC_MODEL = nextModel;

    saveGlobalConfig(current => ({
      ...current,
      customApiEndpoint: {
        provider: nextPersistedEndpoint.provider,
        baseURL: nextPersistedEndpoint.baseURL,
        apiKey: undefined,
        model: nextPersistedEndpoint.model,
        savedModels: nextSavedModels,
        savedModelsByProvider: nextPersistedEndpoint.savedModelsByProvider,
      },
      customApiKeyResponses: normalizedKey
        ? {
            approved: [...new Set([...(current.customApiKeyResponses?.approved ?? []), normalizedKey])],
            rejected: (current.customApiKeyResponses?.rejected ?? []).filter(key => key !== normalizedKey),
          }
        : current.customApiKeyResponses,
    }));

    writeCustomApiStorage(nextPersistedEndpoint);
  }, [compatibleApiProvider, customApiKey, customBaseURL, customModel, persistedCustomApiEndpoint.savedModels]);

  const handleSubmitCustomConfig = useCallback(
    (value: string) => {
      if (oauthStatus.state !== 'custom_config') return;

      if (oauthStatus.step === 'baseURL') {
        const nextValue = value.trim();
        if (!nextValue) {
          setOAuthStatus({
            state: 'error',
            message: 'Compatible endpoint URL is required',
            toRetry: {
              state: 'custom_config',
              provider: oauthStatus.provider,
              step: 'baseURL',
            },
          });
          return;
        }
        setCustomBaseURL(nextValue);
        setCursorOffset(0);
        setOAuthStatus({
          state: 'custom_config',
          provider: oauthStatus.provider,
          step: 'apiKey',
        });
        return;
      }

      if (oauthStatus.step === 'apiKey') {
        const nextValue = value.trim();
        if (!nextValue) {
          setOAuthStatus({
            state: 'error',
            message: 'API key is required',
            toRetry: {
              state: 'custom_config',
              provider: oauthStatus.provider,
              step: 'apiKey',
            },
          });
          return;
        }
        setCustomApiKey(nextValue);
        setCursorOffset(0);
        setOAuthStatus({
          state: 'custom_config',
          provider: oauthStatus.provider,
          step: 'model',
        });
        return;
      }

      const nextValue = value.trim();
      if (!nextValue) {
        setOAuthStatus({
          state: 'error',
          message: 'Default model is required',
          toRetry: {
            state: 'custom_config',
            provider: oauthStatus.provider,
            step: 'model',
          },
        });
        return;
      }

      setCustomModel(nextValue);
      persistCustomEndpoint();
      setOAuthStatus({ state: 'success' });
      void sendNotification(
        {
          message:
            oauthStatus.provider === 'openai'
              ? 'OpenAI-compatible endpoint saved'
              : 'Anthropic-compatible endpoint saved',
          notificationType: 'auth_success',
        },
        terminal,
      );
    },
    [oauthStatus, persistCustomEndpoint, terminal],
  );

  async function handleSubmitCode(value: string, url: string) {
    try {
      const [authorizationCode, state] = value.split('#');
      if (!authorizationCode || !state) {
        setOAuthStatus({
          state: 'error',
          message: 'Invalid code. Please make sure the full code was copied',
          toRetry: { state: 'waiting_for_login', url },
        });
        return;
      }

      logEvent('tengu_oauth_manual_entry', {});
      oauthService.handleManualAuthCodeInput({ authorizationCode, state });
    } catch (err: unknown) {
      logError(err);
      setOAuthStatus({
        state: 'error',
        message: (err as Error).message,
        toRetry: { state: 'waiting_for_login', url },
      });
    }
  }

  const startOAuth = useCallback(async () => {
    try {
      logEvent('tengu_oauth_flow_start', { loginWithClaudeAi });
      const result = await oauthService.startOAuthFlow(
        async url => {
          setOAuthStatus({ state: 'waiting_for_login', url });
          setTimeout(setShowPastePrompt, 3000, true);
        },
        {
          loginWithClaudeAi,
          inferenceOnly: mode === 'setup-token',
          expiresIn: mode === 'setup-token' ? 365 * 24 * 60 * 60 : undefined,
          orgUUID,
        },
      );

      if (mode === 'setup-token') {
        setOAuthStatus({ state: 'success', token: result.accessToken });
      } else {
        await installOAuthTokens(result);
        const orgResult = await validateForceLoginOrg();
        if (!orgResult.valid) {
          throw new Error((orgResult as { valid: false; message: string }).message);
        }
        setOAuthStatus({ state: 'success' });
        void sendNotification(
          {
            message: 'Claude Code login successful',
            notificationType: 'auth_success',
          },
          terminal,
        );
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      const sslHint = getSSLErrorHint(err);
      setOAuthStatus({
        state: 'error',
        message: sslHint ?? errorMessage,
        toRetry: { state: mode === 'setup-token' ? 'ready_to_start' : 'idle' },
      });
      logEvent('tengu_oauth_error', {
        error: errorMessage as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        ssl_error: sslHint !== null,
      });
    }
  }, [loginWithClaudeAi, mode, oauthService, orgUUID, terminal]);

  const pendingOAuthStartRef = useRef(false);
  useEffect(() => {
    if (oauthStatus.state === 'ready_to_start' && !pendingOAuthStartRef.current) {
      pendingOAuthStartRef.current = true;
      process.nextTick(() => {
        void startOAuth();
        pendingOAuthStartRef.current = false;
      });
    }
  }, [oauthStatus.state, startOAuth]);

  useEffect(() => {
    if (mode === 'setup-token' && oauthStatus.state === 'success') {
      const timer = setTimeout(() => {
        logEvent('tengu_oauth_success', { loginWithClaudeAi });
        onDone();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loginWithClaudeAi, mode, oauthStatus, onDone]);

  useEffect(() => () => oauthService.cleanup(), [oauthService]);

  return (
    <Box flexDirection="column" gap={1}>
      {oauthStatus.state === 'waiting_for_login' && showPastePrompt ? (
        <Box flexDirection="column" key="urlToCopy" gap={1} paddingBottom={1}>
          <Box paddingX={1}>
            <Text dimColor>Browser didn't open? Use the url below to sign in </Text>
            {urlCopied ? (
              <Text color="success">(Copied!)</Text>
            ) : (
              <Text dimColor>
                <KeyboardShortcutHint shortcut="c" action="copy" parens />
              </Text>
            )}
          </Box>
          <Link url={oauthStatus.url}>
            <Text dimColor>{oauthStatus.url}</Text>
          </Link>
        </Box>
      ) : null}

      {mode === 'setup-token' && oauthStatus.state === 'success' && oauthStatus.token ? (
        <Box key="tokenOutput" flexDirection="column" gap={1} paddingTop={1}>
          <Text color="success">✓ Long-lived authentication token created successfully!</Text>
          <Box flexDirection="column" gap={1}>
            <Text>Your OAuth token (valid for 1 year):</Text>
            <Text color="warning">{oauthStatus.token}</Text>
            <Text dimColor>Store this token securely. You won't be able to see it again.</Text>
            <Text dimColor>Use this token by setting: export CLAUDE_CODE_OAUTH_TOKEN=&lt;token&gt;</Text>
          </Box>
        </Box>
      ) : null}

      <Box paddingLeft={1} flexDirection="column" gap={1}>
        <OAuthStatusMessage
          oauthStatus={oauthStatus}
          mode={mode}
          startingMessage={startingMessage}
          forcedMethodMessage={forcedMethodMessage}
          showPastePrompt={showPastePrompt}
          pastedCode={pastedCode}
          setPastedCode={setPastedCode}
          cursorOffset={cursorOffset}
          setCursorOffset={setCursorOffset}
          textInputColumns={textInputColumns}
          handleSubmitCode={handleSubmitCode}
          setOAuthStatus={setOAuthStatus}
          setLoginWithClaudeAi={setLoginWithClaudeAi}
          customBaseURL={customBaseURL}
          customApiKey={customApiKey}
          customModel={customModel}
          setCustomBaseURL={setCustomBaseURL}
          setCustomApiKey={setCustomApiKey}
          setCustomModel={setCustomModel}
          isCustomInputPasting={isCustomInputPasting}
          setIsCustomInputPasting={setIsCustomInputPasting}
          handleSubmitCustomConfig={handleSubmitCustomConfig}
          startCompatibleApiConfig={startCompatibleApiConfig}
          compatibleApiProvider={compatibleApiProvider}
        />
      </Box>
    </Box>
  );
}

type OAuthStatusMessageProps = {
  oauthStatus: OAuthStatus;
  mode: 'login' | 'setup-token';
  startingMessage: string | undefined;
  forcedMethodMessage: string | null;
  showPastePrompt: boolean;
  pastedCode: string;
  setPastedCode: (value: string) => void;
  cursorOffset: number;
  setCursorOffset: (offset: number) => void;
  textInputColumns: number;
  handleSubmitCode: (value: string, url: string) => void;
  setOAuthStatus: (status: OAuthStatus) => void;
  setLoginWithClaudeAi: (value: boolean) => void;
  customBaseURL: string;
  customApiKey: string;
  customModel: string;
  setCustomBaseURL: (value: string) => void;
  setCustomApiKey: (value: string) => void;
  setCustomModel: (value: string) => void;
  isCustomInputPasting: boolean;
  setIsCustomInputPasting: (value: boolean) => void;
  handleSubmitCustomConfig: (value: string) => void;
  startCompatibleApiConfig: (provider: CompatibleApiProvider) => void;
  compatibleApiProvider: CompatibleApiProvider;
};

function OAuthStatusMessage({
  oauthStatus,
  mode,
  startingMessage,
  forcedMethodMessage,
  showPastePrompt,
  pastedCode,
  setPastedCode,
  cursorOffset,
  setCursorOffset,
  textInputColumns,
  handleSubmitCode,
  setOAuthStatus,
  setLoginWithClaudeAi,
  customBaseURL,
  customApiKey,
  customModel,
  setCustomBaseURL,
  setCustomApiKey,
  setCustomModel,
  isCustomInputPasting,
  setIsCustomInputPasting,
  handleSubmitCustomConfig,
  startCompatibleApiConfig,
  compatibleApiProvider,
}: OAuthStatusMessageProps): React.ReactNode {
  switch (oauthStatus.state) {
    case 'custom_config': {
      const isOpenAIProvider = oauthStatus.provider === 'openai';
      const label =
        oauthStatus.step === 'baseURL'
          ? isOpenAIProvider
            ? 'Enter the OpenAI Chat Completions compatible base URL:'
            : 'Enter the Anthropic Messages compatible base URL:'
          : oauthStatus.step === 'apiKey'
            ? isOpenAIProvider
              ? 'Input OpenAI API Key:'
              : 'Input Anthropic API Key:'
            : 'Enter the default model name:';
      const value =
        oauthStatus.step === 'baseURL' ? customBaseURL : oauthStatus.step === 'apiKey' ? customApiKey : customModel;
      const onChange =
        oauthStatus.step === 'baseURL'
          ? setCustomBaseURL
          : oauthStatus.step === 'apiKey'
            ? setCustomApiKey
            : setCustomModel;
      const placeholder =
        oauthStatus.step === 'baseURL'
          ? isOpenAIProvider
            ? 'https://your-openai-compatible-endpoint.example.com'
            : 'https://your-anthropic-compatible-endpoint.example.com'
          : oauthStatus.step === 'apiKey'
            ? 'sk-...'
            : isOpenAIProvider
              ? 'gpt-4o-mini'
              : 'claude-3-5-sonnet-latest';
      const mask = oauthStatus.step === 'apiKey' ? '*' : undefined;

      return (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text bold>Configure compatible endpoint</Text>
          <Text>
            {compatibleApiProvider === 'openai'
              ? 'Current selection: OpenAI Chat Completions compatible format'
              : 'Current selection: Anthropic Messages compatible format'}
          </Text>
          <Text>{label}</Text>
          <Box flexDirection="row">
            <TextInput
              value={value}
              onChange={onChange}
              onSubmit={handleSubmitCustomConfig}
              onIsPastingChange={setIsCustomInputPasting}
              cursorOffset={cursorOffset}
              onChangeCursorOffset={setCursorOffset}
              columns={oauthStatus.step === 'baseURL' ? Math.max(20, textInputColumns - 12) : textInputColumns}
              focus
              showCursor
              placeholder={placeholder}
              mask={mask}
              dimColor={oauthStatus.step === 'model' && value.length === 0}
            />
            {oauthStatus.step === 'baseURL' ? (
              <Text dimColor>{isOpenAIProvider ? '/v1/chat/completions' : '/v1/messages'}</Text>
            ) : null}
          </Box>
          <Text dimColor>
            {isCustomInputPasting
              ? 'Press Enter to save the current item and continue.'
              : 'Press Enter to save the current item and continue.'}
          </Text>
        </Box>
      );
    }

    case 'idle':
      return (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text bold>
            {startingMessage ||
              'Claude Code can be used with your Claude subscription or billed based on API usage through your Console account.'}
          </Text>
          <Text>Select login method:</Text>
          <Box>
            <Select
              options={[
                {
                  label: (
                    <Text>
                      Claude account with subscription · <Text dimColor>Pro, Max, Team, or Enterprise</Text>
                    </Text>
                  ),
                  value: 'claudeai',
                },
                {
                  label: (
                    <Text>
                      Anthropic Console account · <Text dimColor>API usage billing</Text>
                    </Text>
                  ),
                  value: 'console',
                },
                {
                  label: (
                    <Text>
                      OpenAI-compatible endpoint · <Text dimColor>Use Chat Completions through a compatible API</Text>
                    </Text>
                  ),
                  value: 'openai_compat',
                },
                {
                  label: (
                    <Text>
                      Anthropic-compatible endpoint · <Text dimColor>Use a custom `/v1/messages` compatible API</Text>
                    </Text>
                  ),
                  value: 'anthropic_compat',
                },
                {
                  label: (
                    <Text>
                      3rd-party platform · <Text dimColor>Amazon Bedrock, Microsoft Foundry, or Vertex AI</Text>
                    </Text>
                  ),
                  value: 'platform',
                },
              ]}
              onChange={value => {
                if (value === 'platform') {
                  logEvent('tengu_oauth_platform_selected', {});
                  setOAuthStatus({ state: 'platform_setup' });
                  return;
                }
                if (value === 'openai_compat') {
                  logEvent('tengu_oauth_openai_compat_selected', {});
                  startCompatibleApiConfig('openai');
                  return;
                }
                if (value === 'anthropic_compat') {
                  logEvent('tengu_oauth_anthropic_compat_selected', {});
                  startCompatibleApiConfig('anthropic');
                  return;
                }

                setOAuthStatus({ state: 'ready_to_start' });
                if (value === 'claudeai') {
                  logEvent('tengu_oauth_claudeai_selected', {});
                  setLoginWithClaudeAi(true);
                } else {
                  logEvent('tengu_oauth_console_selected', {});
                  setLoginWithClaudeAi(false);
                }
              }}
            />
          </Box>
        </Box>
      );

    case 'platform_setup':
      return (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text bold>Using 3rd-party platforms</Text>
          <Text>
            Claude Code supports Amazon Bedrock, Microsoft Foundry, and Vertex AI. Set the required environment
            variables, then restart Claude Code.
          </Text>
          <Text>If you are part of an enterprise organization, contact your administrator for setup instructions.</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Documentation:</Text>
            <Text>
              · Amazon Bedrock:{' '}
              <Link url="https://code.claude.com/docs/en/amazon-bedrock">
                https://code.claude.com/docs/en/amazon-bedrock
              </Link>
            </Text>
            <Text>
              · Microsoft Foundry:{' '}
              <Link url="https://code.claude.com/docs/en/microsoft-foundry">
                https://code.claude.com/docs/en/microsoft-foundry
              </Link>
            </Text>
            <Text>
              · Vertex AI:{' '}
              <Link url="https://code.claude.com/docs/en/google-vertex-ai">
                https://code.claude.com/docs/en/google-vertex-ai
              </Link>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              Press <Text bold>Enter</Text> to go back to login options.
            </Text>
          </Box>
        </Box>
      );

    case 'ready_to_start':
      return (
        <Box>
          <Spinner />
          <Text>Preparing login…</Text>
        </Box>
      );

    case 'waiting_for_login':
      return (
        <Box flexDirection="column" gap={1}>
          {forcedMethodMessage ? (
            <Box>
              <Text dimColor>{forcedMethodMessage}</Text>
            </Box>
          ) : null}
          {!showPastePrompt ? (
            <Box>
              <Spinner />
              <Text>Opening browser to sign in…</Text>
            </Box>
          ) : null}
          {showPastePrompt ? (
            <Box>
              <Text>{PASTE_HERE_MSG}</Text>
              <TextInput
                value={pastedCode}
                onChange={setPastedCode}
                onSubmit={value => handleSubmitCode(value, oauthStatus.url)}
                cursorOffset={cursorOffset}
                onChangeCursorOffset={setCursorOffset}
                columns={textInputColumns}
                mask="*"
              />
            </Box>
          ) : null}
        </Box>
      );

    case 'creating_api_key':
      return (
        <Box flexDirection="column" gap={1}>
          <Box>
            <Spinner />
            <Text>Creating API key for Claude Code…</Text>
          </Box>
        </Box>
      );

    case 'about_to_retry':
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="permission">Retrying…</Text>
        </Box>
      );

    case 'success':
      return (
        <Box flexDirection="column">
          {mode === 'setup-token' && oauthStatus.token ? null : (
            <>
              {getOauthAccountInfo()?.emailAddress ? (
                <Text dimColor>
                  Logged in as <Text>{getOauthAccountInfo()?.emailAddress}</Text>
                </Text>
              ) : null}
              <Text color="success">
                Login successful. Press <Text bold>Enter</Text> to continue…
              </Text>
            </>
          )}
        </Box>
      );

    case 'error':
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="error">OAuth error: {oauthStatus.message}</Text>
          {oauthStatus.toRetry ? (
            <Box marginTop={1}>
              <Text color="permission">
                Press <Text bold>Enter</Text> to retry.
              </Text>
            </Box>
          ) : null}
        </Box>
      );
  }
}
