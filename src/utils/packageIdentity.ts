export function isOfficialAnthropicPackage(
  packageUrl = MACRO.PACKAGE_URL,
): boolean {
  return typeof packageUrl === 'string' && packageUrl.startsWith('@anthropic')
}

export function supportsManagedAutoInstall(
  packageUrl = MACRO.PACKAGE_URL,
): boolean {
  return isOfficialAnthropicPackage(packageUrl)
}
