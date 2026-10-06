import {
	Button,
	MultiSelect,
	Select,
	Stack,
	Textarea,
	TextInput,
} from "@mantine/core";
import {
	type CustomFieldDetailsFragment,
	CustomFieldKind,
	MediaLot,
	type SaveCustomFieldInput,
} from "@ryot/generated/graphql/backend/graphql";
import { changeCase } from "@ryot/ts-utils";
import { useState } from "react";

export function CustomFieldDefinitionForm(props: {
	field?: CustomFieldDetailsFragment;
	saving: boolean;
	onSave: (input: SaveCustomFieldInput) => void;
}) {
	const [name, setName] = useState(props.field?.name || "");
	const [description, setDescription] = useState(
		props.field?.description || "",
	);
	const [kind, setKind] = useState(props.field?.kind || CustomFieldKind.Text);
	const [lots, setLots] = useState<MediaLot[]>(props.field?.mediaLots || []);
	const [options, setOptions] = useState(props.field?.options.join("\n") || "");
	const isChoice =
		kind === CustomFieldKind.Select || kind === CustomFieldKind.MultiSelect;
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				props.onSave({
					kind,
					name: name.trim(),
					id: props.field?.id,
					mediaLots: lots,
					description: description.trim() || null,
					options: isChoice
						? options
								.split("\n")
								.map((item) => item.trim())
								.filter(Boolean)
						: [],
				});
			}}
		>
			<Stack>
				<TextInput
					required
					label="Name"
					maxLength={120}
					value={name}
					disabled={props.saving}
					onChange={(event) => setName(event.currentTarget.value)}
				/>
				<Textarea
					label="Description"
					maxLength={2000}
					value={description}
					disabled={props.saving}
					onChange={(event) => setDescription(event.currentTarget.value)}
				/>
				<Select
					required
					label="Field type"
					value={kind}
					disabled={props.saving}
					allowDeselect={false}
					data={Object.values(CustomFieldKind).map((value) => ({
						value,
						label:
							value === CustomFieldKind.MultiSelect
								? "Multiple choices"
								: value === CustomFieldKind.Select
									? "Single choice"
									: changeCase(value),
					}))}
					onChange={(value) => {
						if (value) setKind(value as CustomFieldKind);
					}}
				/>
				<MultiSelect
					label="Media types"
					description="Leave empty to use this field for every media type."
					placeholder="All media types"
					value={lots}
					disabled={props.saving}
					data={Object.values(MediaLot).map((value) => ({
						value,
						label: changeCase(value),
					}))}
					onChange={(value) => setLots(value as MediaLot[])}
				/>
				{isChoice ? (
					<Textarea
						required
						label="Choices"
						description="One choice per line. Each choice must be unique."
						autosize
						minRows={3}
						value={options}
						disabled={props.saving}
						onChange={(event) => setOptions(event.currentTarget.value)}
					/>
				) : null}
				<Button type="submit" loading={props.saving}>
					{props.field ? "Save field" : "Create field"}
				</Button>
			</Stack>
		</form>
	);
}
