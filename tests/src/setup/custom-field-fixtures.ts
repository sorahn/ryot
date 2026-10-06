import {
	CreateCustomMetadataDocument,
	CustomFieldKind,
	MediaLot,
	MetadataCustomFieldsDocument,
	SaveCustomFieldDocument,
	type SaveCustomFieldInput,
} from "@ryot/generated/graphql/backend/graphql";
import { getGraphqlClient, registerTestUser } from "src/utils";

const assets = {
	s3Images: [],
	s3Videos: [],
	remoteImages: [],
	remoteVideos: [],
};
const url = process.env.API_BASE_URL as string;

export async function createCustomFieldFixture(lot = MediaLot.Book) {
	const [key] = await registerTestUser(url);
	const client = getGraphqlClient(url);
	const headers = { Authorization: `Bearer ${key}` };
	const input = { lot, assets, title: `Custom fields ${crypto.randomUUID()}` };
	const { createCustomMetadata } = await client.request(
		CreateCustomMetadataDocument,
		{ input },
		headers,
	);
	const metadataId = createCustomMetadata.id;
	const saveField = async (input: Partial<SaveCustomFieldInput> = {}) => {
		const { saveCustomField } = await client.request(
			SaveCustomFieldDocument,
			{
				input: {
					name: "Personal note",
					kind: CustomFieldKind.Text,
					options: [],
					mediaLots: [],
					...input,
				},
			},
			headers,
		);
		return saveCustomField;
	};
	const values = async () =>
		(
			await client.request(
				MetadataCustomFieldsDocument,
				{ metadataId },
				headers,
			)
		).metadataCustomFields;
	return { client, headers, metadataId, input, saveField, values };
}
