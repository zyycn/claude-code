function getMacroPackageBin(): string | undefined {
  return typeof MACRO !== 'undefined' && typeof MACRO.PACKAGE_BIN === 'string'
    ? MACRO.PACKAGE_BIN
    : undefined
}

export function getCliBin(): string {
  return process.env.CLAUDE_CODE_BIN_NAME?.trim() || getMacroPackageBin() || 'claudex'
}

export function getCliDisplayName(cliBin = getCliBin()): string {
  return cliBin === 'claude'
    ? 'Claude Code'
    : `${cliBin.charAt(0).toUpperCase()}${cliBin.slice(1)} Code`
}
