import type { ToolPermissionContext } from '../../Tool.js'
import type { OptionWithDescription } from '../../components/CustomSelect/index.js'
import { permissionModeTitle, type PermissionMode } from '../../utils/permissions/PermissionMode.js'
import { transitionPermissionMode } from '../../utils/permissions/permissionSetup.js'

export type PermissionCommandSelection = 'default' | 'full-access'

export function getPermissionCommandOptions(
  currentMode: PermissionMode,
  isFullAccessAvailable: boolean,
): OptionWithDescription<PermissionCommandSelection>[] {
  const isDefaultCurrent = currentMode === 'default'
  const isFullAccessCurrent = currentMode === 'bypassPermissions'

  return [
    {
      label: isDefaultCurrent ? 'Default (current)' : 'Default',
      description:
        'Claudex can read and edit files in the current workspace, and run commands. Approval is required to access the internet or edit other files.',
      value: 'default',
    },
    {
      label: isFullAccessCurrent ? 'Full Access (current)' : 'Full Access',
      description: isFullAccessAvailable
        ? 'Claudex can edit files outside this workspace and access the internet without asking for approval. Exercise caution when using.'
        : 'Full Access is disabled by settings or policy.',
      value: 'full-access',
      disabled: !isFullAccessAvailable,
    },
  ]
}

export function applyPermissionCommandSelection(
  toolPermissionContext: ToolPermissionContext,
  selection: PermissionCommandSelection,
): ToolPermissionContext {
  const targetMode: PermissionMode =
    selection === 'full-access' ? 'bypassPermissions' : 'default'

  const baseContext =
    selection === 'full-access'
      ? {
          ...toolPermissionContext,
          isBypassPermissionsModeAvailable: true,
        }
      : toolPermissionContext

  const nextContext = transitionPermissionMode(
    toolPermissionContext.mode,
    targetMode,
    baseContext,
  )

  return {
    ...nextContext,
    mode: targetMode,
    isBypassPermissionsModeAvailable:
      baseContext.isBypassPermissionsModeAvailable,
  }
}

export function getPermissionSelectionLabel(
  selection: PermissionCommandSelection,
): string {
  return selection === 'full-access' ? 'Full Access' : 'Default'
}

export function getPermissionCommandCancelMessage(
  currentMode: PermissionMode,
): string {
  return `Kept permission mode: ${permissionModeTitle(currentMode)}`
}
