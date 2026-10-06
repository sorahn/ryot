import {
	Alert,
	Badge,
	Button,
	Container,
	FileButton,
	Group,
	Loader,
	Paper,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
	type CustomFieldDetailsFragment,
	DeleteCustomFieldDocument,
	ExportCustomFieldsDocument,
	ImportCustomFieldsDocument,
	SaveCustomFieldDocument,
	type SaveCustomFieldInput,
	UserCustomFieldsDocument,
} from "@ryot/generated/graphql/backend/graphql";
import { changeCase } from "@ryot/ts-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CustomFieldDefinitionForm } from "~/components/common/custom-field-definition-form";
import { customFieldError } from "~/components/common/custom-fields-panel";
import { useUserDetails } from "~/lib/shared/hooks";
import { clientGqlService } from "~/lib/shared/react-query";

export const meta = () => [{ title: "Custom fields | Ryot" }];

export default function Page() {
	const user = useUserDetails();
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState<CustomFieldDetailsFragment>();
	const [formVersion, setFormVersion] = useState(0);
	const query = useQuery({
		queryKey: ["customFields", user.id, "definitions"],
		placeholderData: undefined,
		queryFn: () =>
			clientGqlService
				.request(UserCustomFieldsDocument)
				.then((data) => data.userCustomFields),
	});
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: ["customFields", user.id] });
	const onError = (error: unknown) =>
		notifications.show({ color: "red", message: customFieldError(error) });
	const save = useMutation({
		mutationFn: (input: SaveCustomFieldInput) =>
			clientGqlService.request(SaveCustomFieldDocument, { input }),
		onSuccess: async () => {
			await refresh();
			setEditing(undefined);
			setFormVersion((value) => value + 1);
			notifications.show({ color: "green", message: "Field saved" });
		},
		onError,
	});
	const remove = useMutation({
		mutationFn: (fieldId: string) =>
			clientGqlService.request(DeleteCustomFieldDocument, { fieldId }),
		onSuccess: async () => {
			await refresh();
			setEditing(undefined);
			setFormVersion((value) => value + 1);
		},
		onError,
	});
	const download = useMutation({
		mutationFn: () => clientGqlService.request(ExportCustomFieldsDocument),
		onSuccess: (result) => {
			const url = URL.createObjectURL(
				new Blob([JSON.stringify(result.exportCustomFields, null, 2)], {
					type: "application/json",
				}),
			);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = "ryot-custom-fields.json";
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		},
		onError,
	});
	const upload = useMutation({
		mutationFn: async (file: File) =>
			clientGqlService.request(ImportCustomFieldsDocument, {
				document: JSON.parse(await file.text()),
			}),
		onSuccess: async () => {
			await refresh();
			notifications.show({ color: "green", message: "Custom fields imported" });
		},
		onError,
	});
	return (
		<Container size="lg">
			<Stack>
				<Title>Custom fields</Title>
				<Text c="dimmed">
					Define personal fields for any media type. Values belong to your
					account and survive metadata refreshes.
				</Text>
				<Group>
					<Button
						variant="light"
						loading={download.isPending}
						onClick={() => download.mutate()}
					>
						Export fields and values
					</Button>
					<FileButton
						accept="application/json"
						onChange={(file) => {
							if (file)
								modals.openConfirmModal({
									title: "Import custom fields",
									children: (
										<Text>
											This merges definitions and replaces matching values from
											this file. Import the media catalog first. The entire
											import is rejected if any record is missing or invalid.
										</Text>
									),
									labels: { confirm: "Import", cancel: "Cancel" },
									onConfirm: () => upload.mutate(file),
								});
						}}
					>
						{(props) => (
							<Button {...props} variant="light" loading={upload.isPending}>
								Import fields and values
							</Button>
						)}
					</FileButton>
				</Group>
				<SimpleGrid cols={{ base: 1, md: 2 }}>
					<Paper withBorder p="md">
						<Stack>
							<Group justify="space-between">
								<Title order={3}>{editing ? "Edit field" : "New field"}</Title>
								{editing ? (
									<Button
										variant="subtle"
										onClick={() => {
											setEditing(undefined);
											setFormVersion((value) => value + 1);
										}}
									>
										New field
									</Button>
								) : null}
							</Group>
							<CustomFieldDefinitionForm
								key={`${editing?.id || "new"}:${formVersion}`}
								field={editing}
								saving={save.isPending}
								onSave={(input) => save.mutate(input)}
							/>
						</Stack>
					</Paper>
					<Stack>
						{query.isPending ? (
							<Loader />
						) : query.isError ? (
							<Alert color="red">{customFieldError(query.error)}</Alert>
						) : query.data.length ? (
							query.data.map((field) => (
								<Paper key={field.id} withBorder p="md">
									<Stack gap="xs">
										<Group justify="space-between">
											<Text fw={600}>{field.name}</Text>
											<Badge>{changeCase(field.kind)}</Badge>
										</Group>
										<Text size="sm" c="dimmed">
											{field.mediaLots.length
												? field.mediaLots.map(changeCase).join(", ")
												: "All media types"}
										</Text>
										{field.description ? (
											<Text size="sm">{field.description}</Text>
										) : null}
										<Group>
											<Button
												size="xs"
												variant="light"
												disabled={save.isPending || remove.isPending}
												onClick={() => setEditing(field)}
											>
												Edit
											</Button>
											<Button
												size="xs"
												color="red"
												variant="subtle"
												disabled={save.isPending || remove.isPending}
												onClick={() =>
													modals.openConfirmModal({
														title: `Delete ${field.name}?`,
														children: (
															<Text>
																This deletes the field and all your values for
																it.
															</Text>
														),
														confirmProps: { color: "red" },
														labels: { confirm: "Delete", cancel: "Cancel" },
														onConfirm: () => remove.mutate(field.id),
													})
												}
											>
												Delete
											</Button>
										</Group>
									</Stack>
								</Paper>
							))
						) : (
							<Text>No custom fields defined yet.</Text>
						)}
					</Stack>
				</SimpleGrid>
			</Stack>
		</Container>
	);
}
