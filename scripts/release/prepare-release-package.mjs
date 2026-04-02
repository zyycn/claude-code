import { execFileSync } from 'node:child_process'
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rootDir = join(here, '..', '..')
const releaseDir = join(rootDir, 'dist', 'npm')
const wrapperSource = join(rootDir, 'scripts', 'release', 'bin', 'claudex.js')
const releaseBin = join(releaseDir, 'bin', 'claudex.js')
const rootPackage = JSON.parse(
  await readFile(join(rootDir, 'package.json'), 'utf8'),
)

const packageName = process.env.NPM_PACKAGE_NAME || '@zyycn/claudex'
const binName = process.env.NPM_BIN_NAME || 'claudex'
const repositoryUrl =
  process.env.PUBLISH_REPOSITORY_URL || normalizeRepositoryUrl(rootPackage.repository?.url)
const homepage = repositoryUrl ? repositoryUrl.replace(/^git\+/, '').replace(/\.git$/, '') : undefined
const version = buildReleaseVersion(rootPackage.version, getGitShortSha())

await rm(join(rootDir, 'dist'), { recursive: true, force: true })

runBuild({
  ...process.env,
  CLAUDE_CODE_PACKAGE_NAME: packageName,
  CLAUDE_CODE_PACKAGE_BIN: binName,
  CLAUDE_CODE_VERSION: version,
  CLAUDE_CODE_BUILD_OUTDIR: join(releaseDir, 'dist'),
})

await mkdir(join(releaseDir, 'bin'), { recursive: true })
await copyFile(wrapperSource, releaseBin)
await chmod(releaseBin, 0o755)
await copyIfPresent(join(rootDir, 'README.md'), join(releaseDir, 'README.md'))

const licenseSource = join(rootDir, 'LICENSE.md')
if (existsSync(licenseSource)) {
  await copyFile(licenseSource, join(releaseDir, 'LICENSE.md'))
} else {
  await writeFile(join(releaseDir, 'LICENSE.md'), renderFallbackLicense())
}

const publishPackage = {
  name: packageName,
  version,
  description:
    'Claudex CLI distribution built from a Claude Code fork.',
  type: 'module',
  bin: {
    [binName]: './bin/claudex.js',
  },
  files: ['bin', 'dist', 'README.md', 'LICENSE.md'],
  engines: {
    node: process.env.NPM_NODE_ENGINE || '>=20.0.0',
  },
  repository: repositoryUrl
    ? {
        type: 'git',
        url: repositoryUrl,
      }
    : undefined,
  homepage,
  bugs: homepage
    ? {
        url: `${homepage}/issues`,
      }
    : undefined,
  keywords: ['claude-code', 'claudex', 'cli', 'terminal'],
  publishConfig: {
    access: 'public',
    provenance: true,
  },
}

await writeFile(
  join(releaseDir, 'package.json'),
  `${JSON.stringify(stripUndefined(publishPackage), null, 2)}\n`,
)

await cleanupRootDistArtifacts()

console.log(`Prepared ${packageName}@${version} in ${releaseDir}`)

function normalizeRepositoryUrl(value) {
  return value ? String(value).trim() : undefined
}

function buildReleaseVersion(rawVersion, shortSha) {
  const normalizedBase = String(rawVersion).trim().replace(/^v/, '')
  return normalizedBase.includes('-')
    ? `${normalizedBase}.fork.${shortSha}`
    : `${normalizedBase}-fork.${shortSha}`
}

function getGitShortSha() {
  return execFromRoot('git', ['rev-parse', '--short=7', 'HEAD'])
}

function execFromRoot(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    ...options,
  }).trim()
}

function resolveBunExecutable() {
  const configured = process.env.BUN_EXE?.trim()
  if (configured) return configured
  return null
}

function runBuild(env) {
  const bunExecutable = resolveBunExecutable()
  if (bunExecutable) {
    execFromRoot(bunExecutable, ['run', 'build.ts'], { env })
    return
  }

  execFromRoot(
    'npm',
    ['exec', '--yes', 'bun@1.3.11', '--', 'run', 'build.ts'],
    { env },
  )
}

function stripUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  )
}

function renderFallbackLicense() {
  return `This package is published from a fork of Anthropic Claude Code.\n\nRefer to the upstream license and usage terms before redistribution:\n- https://github.com/anthropics/claude-code/blob/main/LICENSE.md\n- https://www.anthropic.com/legal/commercial-terms\n`
}

async function copyIfPresent(from, to) {
  if (existsSync(from)) {
    await copyFile(from, to)
  }
}

async function cleanupRootDistArtifacts() {
  const distRoot = join(rootDir, 'dist')
  for (const entry of await readdir(distRoot)) {
    if (entry === 'npm') continue
    await rm(join(distRoot, entry), { recursive: true, force: true })
  }
}
