import {
	Alert,
	Anchor,
	Button,
	Loader,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	CustomFieldKind,
	MetadataCustomFieldsDocument,
	type MetadataCustomFieldsQuery,
	SaveMetadataCustomFieldsDocument,
} from "@ryot/generated/graphql/backend/graphql";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientError } from "graphql-request";
import { useState } from "react";
import { Link } from "react-router";
import { useUserDetails } from "~/lib/shared/hooks";
import { clientGqlService } from "~/lib/shared/react-query";
import { CustomFieldInput, type CustomFieldValue } from "./custom-field-input";

export function customFieldError(error: unknown) {
	return error instanceof ClientError
		? error.response.errors?.[0]?.message || "Could not update custom fields"
		: error instanceof Error
			? error.message
			: "Could not update custom fields";
}

export function CustomFieldsPanel(props: { metadataId: string }) {
	const user = useUserDetails();
	const query = useQuery({
		queryKey: ["customFields", user.id, "metadata", props.metadataId],
		placeholderData: undefined,
		refetchOnWindowFocus: false,
		queryFn: () =>
			clientGqlService
				.request(MetadataCustomFieldsDocument, { metadataId: props.metadataId })
				.then((data) => data.metadataCustomFields),
	});
	if (query.isPending) return <Loader />;
	if (query.isError)
		return <Alert color="red">{customFieldError(query.error)}</Alert>;
	return (
		<Stack p="sm">
			<Title order={3}>Custom fields</Title>
			<Text size="sm" c="dimmed">
				Your personal annotations.{" "}
				<Anchor component={Link} to="/settings/custom-fields">
					Manage fields
				</Anchor>
			</Text>
			{query.data.length ? (
				<CustomFieldsForm
					key={`${user.id}:${props.metadataId}:${JSON.stringify(query.data)}`}
					userId={user.id}
					metadataId={props.metadataId}
					fields={query.data}
				/>
			) : (
				<Text>
					No fields apply to this item yet. Add fields in settings and choose
					which media types they apply to.
				</Text>
			)}
		</Stack>
	);
}

function CustomFieldsForm(props: {
	userId: string;
	metadataId: string;
	fields: MetadataCustomFieldsQuery["metadataCustomFields"];
}) {
	const queryClient = useQueryClient();
	const initial = Object.fromEntries(
		props.fields.map((item) => [item.definition.id, item.value ?? null]),
	) as Record<string, CustomFieldValue>;
	const [values, setValues] = useState(initial);
	const mutation = useMutation({
		mutationFn: () =>
			clientGqlService.request(SaveMetadataCustomFieldsDocument, {
				metadataId: props.metadataId,
				values: props.fields.map((item) => {
					let value = values[item.definition.id];
					if (
						item.definition.kind === CustomFieldKind.Number &&
						typeof value === "string"
					) {
						const number = Number(value);
						if (!Number.isFinite(number))
							throw new Error(
								`${item.definition.name} must be a finite number`,
							);
						value = number;
					}
					return { fieldId: item.definition.id, value };
				}),
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["customFields", props.userId, "metadata", props.metadataId],
			});
			notifications.show({ color: "green", message: "Custom fields saved" });
		},
		onError: (error) =>
			notifications.show({ color: "red", message: customFieldError(error) }),
	});
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				mutation.mutate();
			}}
		>
			<Stack>
				{props.fields.map((item) => (
					<CustomFieldInput
						key={item.definition.id}
						field={item.definition}
						disabled={mutation.isPending}
						value={values[item.definition.id] ?? null}
						onChange={(value) =>
							setValues((old) => ({ ...old, [item.definition.id]: value }))
						}
					/>
				))}
				<Button
					type="submit"
					loading={mutation.isPending}
					disabled={JSON.stringify(values) === JSON.stringify(initial)}
				>
					Save fields
				</Button>
			</Stack>
		</form>
	);
}
