import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

type RootPackage = {
  name?: string
  version?: string
  bin?: Record<string, string>
}

const rootPackage = readRootPackage()

export function getMacroDefines(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const packageName =
    env.CLAUDE_CODE_PACKAGE_NAME?.trim() ||
    rootPackage.name ||
    'claude-js'
  const packageBin =
    env.CLAUDE_CODE_PACKAGE_BIN?.trim() ||
    env.CLAUDE_CODE_BIN_NAME?.trim() ||
    getDefaultBinName(rootPackage) ||
    'claude-js'

  return {
    'MACRO.VERSION': JSON.stringify(
      getDefaultVersion(env, packageName),
    ),
    'MACRO.BUILD_TIME': JSON.stringify(new Date().toISOString()),
    'MACRO.FEEDBACK_CHANNEL': JSON.stringify(''),
    'MACRO.ISSUES_EXPLAINER': JSON.stringify(''),
    'MACRO.NATIVE_PACKAGE_URL': JSON.stringify(
      env.CLAUDE_CODE_NATIVE_PACKAGE_URL?.trim() || '',
    ),
    'MACRO.PACKAGE_URL': JSON.stringify(packageName),
    'MACRO.PACKAGE_BIN': JSON.stringify(packageBin),
    'MACRO.VERSION_CHANGELOG': JSON.stringify(''),
  }
}

function readRootPackage(): RootPackage {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as RootPackage
}

function getDefaultBinName(pkg: RootPackage): string | undefined {
  const bins = pkg.bin ?? {}
  return Object.keys(bins)[0]
}

function getDefaultVersion(
  env: NodeJS.ProcessEnv,
  packageName: string,
): string {
  const explicitVersion = env.CLAUDE_CODE_VERSION?.trim()
  if (explicitVersion) {
    return explicitVersion
  }

  const baseVersion = rootPackage.version || '0.0.0'
  if (!isOfficialPackage(packageName)) {
    const shortSha = getGitShortSha()
    if (shortSha) {
      return buildForkVersion(baseVersion, shortSha)
    }
  }

  return baseVersion
}

function isOfficialPackage(packageName: string): boolean {
  return packageName.startsWith('@anthropic')
}

function buildForkVersion(rawVersion: string, shortSha: string): string {
  const normalizedBase = String(rawVersion).trim().replace(/^v/, '')
  return normalizedBase.includes('-')
    ? `${normalizedBase}.fork.${shortSha}`
    : `${normalizedBase}-fork.${shortSha}`
}

function getGitShortSha(): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim()
  } catch {
    return undefined
  }
}
