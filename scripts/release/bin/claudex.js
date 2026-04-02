#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, '..')
const entrypoint = join(packageRoot, 'dist', 'cli.js')
const packageName = getPackageName()

const result = spawnSync(process.execPath, [entrypoint, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    CLAUDE_CODE_BIN_NAME: 'claudex',
    CLAUDE_CODE_PACKAGE_NAME: packageName,
    CLAUDE_CODE_FORCE_FULL_LOGO:
      process.env.CLAUDE_CODE_FORCE_FULL_LOGO ?? '1',
  },
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)

function getPackageName() {
  try {
    const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
    if (typeof pkg?.name === 'string' && pkg.name.trim()) {
      return pkg.name.trim()
    }
  } catch {}
  return '@zyycn/claudex'
}
