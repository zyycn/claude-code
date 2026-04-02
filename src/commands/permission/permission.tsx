import * as React from "react";
import { Select } from "../../components/CustomSelect/index.js";
import { Dialog } from "../../components/design-system/Dialog.js";
import { Box, Text } from "../../ink.js";
import type { LocalJSXCommandCall } from "../../types/command.js";
import {
	permissionModeTitle,
	type PermissionMode,
} from "../../utils/permissions/PermissionMode.js";
import { isBypassPermissionsModeDisabled } from "../../utils/permissions/permissionSetup.js";
import {
	applyPermissionCommandSelection,
	getPermissionCommandCancelMessage,
	getPermissionCommandOptions,
	getPermissionSelectionLabel,
	type PermissionCommandSelection,
} from "./utils.js";

type PermissionPickerProps = {
	currentMode: PermissionMode;
	isFullAccessAvailable: boolean;
	onSelect: (value: PermissionCommandSelection) => void;
	onCancel: () => void;
};

function PermissionPicker({
	currentMode,
	isFullAccessAvailable,
	onSelect,
	onCancel,
}: PermissionPickerProps): React.ReactNode {
	const options = getPermissionCommandOptions(
		currentMode,
		isFullAccessAvailable,
	);

	return (
		<Dialog title="Permission Mode" onCancel={onCancel}>
			<Box flexDirection="column" gap={1}>
				<Text>Current mode: {permissionModeTitle(currentMode)}</Text>
				<Text dimColor>
					Choose how much access Claudex has in this session.
				</Text>
				<Select
					options={options}
					inlineDescriptions
					visibleOptionCount={options.length}
					onChange={onSelect}
					onCancel={onCancel}
				/>
			</Box>
		</Dialog>
	);
}

export const call: LocalJSXCommandCall = async (onDone, context) => {
	const currentMode = context.getAppState().toolPermissionContext.mode;
	const isFullAccessAvailable = !isBypassPermissionsModeDisabled();

	return (
		<PermissionPicker
			currentMode={currentMode}
			isFullAccessAvailable={isFullAccessAvailable}
			onSelect={(value) => {
				context.setAppState((prev) => ({
					...prev,
					toolPermissionContext: applyPermissionCommandSelection(
						prev.toolPermissionContext,
						value,
					),
				}));

				onDone(
					`Permission mode set to ${getPermissionSelectionLabel(value)}`,
					{
						display: "system",
					},
				);
			}}
			onCancel={() =>
				onDone(getPermissionCommandCancelMessage(currentMode), {
					display: "system",
				})
			}
		/>
	);
};
