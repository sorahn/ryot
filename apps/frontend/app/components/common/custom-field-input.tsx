import {
	Button,
	Checkbox,
	Group,
	MultiSelect,
	NumberInput,
	Select,
	Stack,
	Text,
	Textarea,
	TextInput,
} from "@mantine/core";
import {
	type CustomFieldDetailsFragment,
	CustomFieldKind,
} from "@ryot/generated/graphql/backend/graphql";
import type { ReactNode } from "react";

export type CustomFieldValue = string | number | boolean | string[] | null;

export function CustomFieldInput(props: {
	field: CustomFieldDetailsFragment;
	value: CustomFieldValue;
	disabled?: boolean;
	onChange: (value: CustomFieldValue) => void;
}) {
	const common = {
		label: props.field.name,
		description: props.field.description,
		disabled: props.disabled,
	};
	let control: ReactNode;
	switch (props.field.kind) {
		case CustomFieldKind.Text:
			control = (
				<Textarea
					{...common}
					autosize
					minRows={2}
					maxLength={20000}
					value={typeof props.value === "string" ? props.value : ""}
					onChange={(event) => props.onChange(event.currentTarget.value)}
				/>
			);
			break;
		case CustomFieldKind.Number:
			control = (
				<NumberInput
					{...common}
					value={
						typeof props.value === "number" || typeof props.value === "string"
							? props.value
							: ""
					}
					onChange={(value) => props.onChange(value === "" ? null : value)}
				/>
			);
			break;
		case CustomFieldKind.Checkbox:
			control = (
				<Stack gap={4}>
					<Checkbox
						{...common}
						checked={props.value === true}
						onChange={(event) => props.onChange(event.currentTarget.checked)}
					/>
					<Text size="xs" c="dimmed">
						{props.value === null ? "Not set" : props.value ? "Yes" : "No"}
					</Text>
				</Stack>
			);
			break;
		case CustomFieldKind.Date:
			control = (
				<TextInput
					{...common}
					type="date"
					value={typeof props.value === "string" ? props.value : ""}
					onChange={(event) =>
						props.onChange(event.currentTarget.value || null)
					}
				/>
			);
			break;
		case CustomFieldKind.Select:
			control = (
				<Select
					{...common}
					clearable
					searchable
					data={props.field.options}
					value={typeof props.value === "string" ? props.value : null}
					onChange={props.onChange}
				/>
			);
			break;
		case CustomFieldKind.MultiSelect:
			control = (
				<MultiSelect
					{...common}
					searchable
					data={props.field.options}
					value={Array.isArray(props.value) ? props.value : []}
					onChange={props.onChange}
				/>
			);
			break;
	}
	return (
		<Stack gap={4}>
			{control}
			<Group justify="flex-end">
				<Button
					size="compact-xs"
					variant="subtle"
					disabled={props.disabled || props.value === null}
					onClick={() => props.onChange(null)}
				>
					Clear
				</Button>
			</Group>
		</Stack>
	);
}
