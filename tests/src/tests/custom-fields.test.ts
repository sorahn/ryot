import {
	BackgroundJob,
	CreateCustomMetadataDocument,
	CustomFieldKind,
	DeleteCustomFieldDocument,
	DeployBackgroundJobDocument,
	DisassociateMetadataDocument,
	ExportCustomFieldsDocument,
	ImportCustomFieldsDocument,
	MediaLot,
	MergeMetadataDocument,
	MetadataCustomFieldsDocument,
	SaveCustomFieldDocument,
	SaveMetadataCustomFieldsDocument,
	UpdateCustomMetadataDocument,
	UserCustomFieldsDocument,
} from "@ryot/generated/graphql/backend/graphql";
import { createCustomFieldFixture as fixture } from "src/setup/custom-field-fixtures";
import { executeTestDatabaseSql } from "src/setup/security-database";
import { registerAdminUser } from "src/utils";
import { describe, expect, it } from "vitest";

const url = process.env.API_BASE_URL as string;

describe("Generic custom fields", () => {
	it.each(
		Object.values(MediaLot),
	)("supports annotations on %s without provider-specific code", async (lot) => {
		const f = await fixture(lot);
		const field = await f.saveField();
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: f.metadataId,
				values: [{ fieldId: field.id, value: "Personal annotation" }],
			},
			f.headers,
		);
		expect(await f.values()).toContainEqual({
			definition: field,
			value: "Personal annotation",
		});
	});

	it("keeps fields private and rejects anonymous and cross-user mutations", async () => {
		const owner = await fixture();
		const other = await fixture();
		const field = await owner.saveField();
		await owner.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: owner.metadataId,
				values: [{ fieldId: field.id, value: "Private" }],
			},
			owner.headers,
		);
		expect(
			(await other.client.request(UserCustomFieldsDocument, {}, other.headers))
				.userCustomFields,
		).toEqual([]);
		expect(
			(
				await other.client.request(
					MetadataCustomFieldsDocument,
					{ metadataId: owner.metadataId },
					other.headers,
				)
			).metadataCustomFields,
		).toEqual([]);
		for (const headers of [{}, other.headers]) {
			await expect(
				owner.client.request(
					SaveCustomFieldDocument,
					{ input: { ...field, name: "Stolen" } },
					headers,
				),
			).rejects.toThrow();
			await expect(
				owner.client.request(
					DeleteCustomFieldDocument,
					{ fieldId: field.id },
					headers,
				),
			).rejects.toThrow();
			await expect(
				owner.client.request(
					SaveMetadataCustomFieldsDocument,
					{
						metadataId: owner.metadataId,
						values: [{ fieldId: field.id, value: "Stolen" }],
					},
					headers,
				),
			).rejects.toThrow();
		}
		await expect(
			owner.client.request(UserCustomFieldsDocument),
		).rejects.toThrow();
		await expect(
			owner.client.request(ExportCustomFieldsDocument),
		).rejects.toThrow();
		expect((await owner.values())[0]?.value).toBe("Private");
	});

	it("distinguishes zero, false, empty text and unset values", async () => {
		const f = await fixture();
		const number = await f.saveField({
			name: "Count",
			kind: CustomFieldKind.Number,
		});
		const checkbox = await f.saveField({
			name: "Interested",
			kind: CustomFieldKind.Checkbox,
		});
		const text = await f.saveField();
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: f.metadataId,
				values: [
					{ fieldId: number.id, value: 0 },
					{ fieldId: checkbox.id, value: false },
					{ fieldId: text.id, value: "" },
				],
			},
			f.headers,
		);
		expect((await f.values()).map((item) => item.value).sort()).toEqual(
			[0, false, ""].sort(),
		);
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: f.metadataId,
				values: [{ fieldId: number.id, value: null }],
			},
			f.headers,
		);
		expect(
			(await f.values()).find((item) => item.definition.id === number.id)
				?.value,
		).toBeNull();
		expect(
			(await f.values()).find((item) => item.definition.id === checkbox.id)
				?.value,
		).toBe(false);
	});

	it("validates dates and choices and rolls back an invalid multi-field save", async () => {
		const f = await fixture();
		const date = await f.saveField({
			name: "Date",
			kind: CustomFieldKind.Date,
		});
		const select = await f.saveField({
			name: "Choice",
			kind: CustomFieldKind.Select,
			options: ["Low", "High"],
		});
		const multiple = await f.saveField({
			name: "Tags",
			kind: CustomFieldKind.MultiSelect,
			options: ["A", "B"],
		});
		for (const [fieldId, value] of [
			[date.id, "2026-02-30"],
			[select.id, "Unknown"],
			[multiple.id, ["A", "A"]],
			[multiple.id, ["Unknown"]],
		] as const) {
			await expect(
				f.client.request(
					SaveMetadataCustomFieldsDocument,
					{ metadataId: f.metadataId, values: [{ fieldId, value }] },
					f.headers,
				),
			).rejects.toThrow("Value does not match");
		}
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: f.metadataId,
				values: [
					{ fieldId: date.id, value: "2026-10-05" },
					{ fieldId: select.id, value: "High" },
					{ fieldId: multiple.id, value: ["A", "B"] },
				],
			},
			f.headers,
		);
		await expect(
			f.client.request(
				SaveMetadataCustomFieldsDocument,
				{
					metadataId: f.metadataId,
					values: [
						{
							fieldId: date.id,
							value: date.id < select.id ? "2026-10-06" : "2026-02-30",
						},
						{
							fieldId: select.id,
							value: date.id < select.id ? "Unknown" : "Low",
						},
					],
				},
				f.headers,
			),
		).rejects.toThrow();
		expect(
			(await f.values()).find((item) => item.definition.id === date.id)?.value,
		).toBe("2026-10-05");
		expect(
			(await f.values()).find((item) => item.definition.id === select.id)
				?.value,
		).toBe("High");
	});

	it("enforces media scope and protects values when definitions change", async () => {
		const f = await fixture(MediaLot.Movie);
		const field = await f.saveField({ mediaLots: [MediaLot.Book] });
		expect(await f.values()).toEqual([]);
		await expect(
			f.client.request(
				SaveMetadataCustomFieldsDocument,
				{
					metadataId: f.metadataId,
					values: [{ fieldId: field.id, value: "Wrong scope" }],
				},
				f.headers,
			),
		).rejects.toThrow("does not apply");
		const { saveCustomField: widened } = await f.client.request(
			SaveCustomFieldDocument,
			{ input: { ...field, mediaLots: [MediaLot.Book, MediaLot.Movie] } },
			f.headers,
		);
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: f.metadataId,
				values: [{ fieldId: widened.id, value: "Keep me" }],
			},
			f.headers,
		);
		await expect(
			f.client.request(
				SaveCustomFieldDocument,
				{ input: { ...widened, mediaLots: [MediaLot.Book] } },
				f.headers,
			),
		).rejects.toThrow("outside the new scope");
		await expect(
			f.client.request(
				SaveCustomFieldDocument,
				{ input: { ...widened, kind: CustomFieldKind.Number } },
				f.headers,
			),
		).rejects.toThrow("Existing values would become invalid");
		await f.client.request(
			UpdateCustomMetadataDocument,
			{
				input: {
					existingMetadataId: f.metadataId,
					update: { ...f.input, title: "Updated catalog title" },
				},
			},
			f.headers,
		);
		expect((await f.values())[0]?.value).toBe("Keep me");
	});

	it("round-trips definitions and values into another account and rejects partial imports", async () => {
		const source = await fixture();
		const target = await fixture();
		const field = await source.saveField();
		await source.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: source.metadataId,
				values: [{ fieldId: field.id, value: "Export me" }],
			},
			source.headers,
		);
		const { exportCustomFields: document } = await source.client.request(
			ExportCustomFieldsDocument,
			{},
			source.headers,
		);
		const invalid = structuredClone(document);
		invalid.values.push({
			...invalid.values[0],
			identifier: "missing-catalog-item",
		});
		await expect(
			target.client.request(
				ImportCustomFieldsDocument,
				{ document: invalid },
				target.headers,
			),
		).rejects.toThrow("catalog record first");
		expect(
			(
				await target.client.request(
					UserCustomFieldsDocument,
					{},
					target.headers,
				)
			).userCustomFields,
		).toEqual([]);
		await target.client.request(
			ImportCustomFieldsDocument,
			{ document },
			target.headers,
		);
		const result = (
			await target.client.request(
				MetadataCustomFieldsDocument,
				{ metadataId: source.metadataId },
				target.headers,
			)
		).metadataCustomFields;
		expect(result[0]?.value).toBe("Export me");
		expect(result[0]?.definition.id).not.toBe(field.id);
		await target.client.request(
			ImportCustomFieldsDocument,
			{ document },
			target.headers,
		);
		expect(
			(
				await target.client.request(
					UserCustomFieldsDocument,
					{},
					target.headers,
				)
			).userCustomFields,
		).toHaveLength(1);
		expect((await source.values())[0]?.value).toBe("Export me");
		await expect(
			source.client.request(ImportCustomFieldsDocument, { document }),
		).rejects.toThrow();
		await target.client.request(
			DeleteCustomFieldDocument,
			{ fieldId: result[0]?.definition.id as string },
			target.headers,
		);
		expect(
			(
				await target.client.request(
					MetadataCustomFieldsDocument,
					{ metadataId: source.metadataId },
					target.headers,
				)
			).metadataCustomFields,
		).toEqual([]);
		expect((await source.values())[0]?.value).toBe("Export me");
	});

	it("rejects duplicate names, malformed definitions and duplicate saves", async () => {
		const f = await fixture();
		const field = await f.saveField();
		await expect(f.saveField()).rejects.toThrow();
		await expect(f.saveField({ name: "  " })).rejects.toThrow("Field names");
		await expect(
			f.saveField({ name: "Choice", kind: CustomFieldKind.Select }),
		).rejects.toThrow("Choice fields require");
		await expect(
			f.saveField({
				name: "Choice",
				kind: CustomFieldKind.Select,
				options: ["Same", "Same"],
			}),
		).rejects.toThrow("must be unique");
		await expect(
			f.client.request(
				SaveMetadataCustomFieldsDocument,
				{
					metadataId: f.metadataId,
					values: [
						{ fieldId: field.id, value: "One" },
						{ fieldId: field.id, value: "Two" },
					],
				},
				f.headers,
			),
		).rejects.toThrow("Field IDs must be unique");
	});

	it("preserves annotations through disassociation and nightly cleanup", async () => {
		const f = await fixture();
		const control = await fixture();
		const field = await f.saveField();
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: f.metadataId,
				values: [{ fieldId: field.id, value: "Keep after untracking" }],
			},
			f.headers,
		);
		await f.client.request(
			DisassociateMetadataDocument,
			{ metadataId: f.metadataId },
			f.headers,
		);
		await control.client.request(
			DisassociateMetadataDocument,
			{ metadataId: control.metadataId },
			control.headers,
		);
		const literal = (id: string) => `'${id.replaceAll("'", "''")}'`;
		executeTestDatabaseSql(
			`DELETE FROM user_to_entity WHERE metadata_id IN (${literal(f.metadataId)}, ${literal(control.metadataId)})`,
		);
		const [admin] = await registerAdminUser(url);
		await f.client.request(
			DeployBackgroundJobDocument,
			{ jobName: BackgroundJob.PerformBackgroundTasks },
			{ Authorization: `Bearer ${admin}` },
		);
		await expect
			.poll(
				() =>
					executeTestDatabaseSql(
						`SELECT count(*) FROM metadata WHERE id = ${literal(control.metadataId)}`,
					),
				{ timeout: 45000 },
			)
			.toMatch(/\n\s*0\s*\n/);
		expect((await f.values())[0]?.value).toBe("Keep after untracking");
		await expect(
			f.client.request(
				MetadataCustomFieldsDocument,
				{ metadataId: control.metadataId },
				control.headers,
			),
		).rejects.toThrow("Media item not found");
	});

	it("moves annotations during item merges and rejects conflicting values", async () => {
		const f = await fixture();
		const field = await f.saveField();
		const { createCustomMetadata: target } = await f.client.request(
			CreateCustomMetadataDocument,
			{ input: { ...f.input, title: "Merge target" } },
			f.headers,
		);
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: f.metadataId,
				values: [{ fieldId: field.id, value: "Original" }],
			},
			f.headers,
		);
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{
				metadataId: target.id,
				values: [{ fieldId: field.id, value: "Conflict" }],
			},
			f.headers,
		);
		await expect(
			f.client.request(
				MergeMetadataDocument,
				{ mergeFrom: f.metadataId, mergeInto: target.id },
				f.headers,
			),
		).rejects.toThrow("conflicting values");
		expect((await f.values())[0]?.value).toBe("Original");
		await f.client.request(
			SaveMetadataCustomFieldsDocument,
			{ metadataId: target.id, values: [{ fieldId: field.id, value: null }] },
			f.headers,
		);
		await f.client.request(
			MergeMetadataDocument,
			{ mergeFrom: f.metadataId, mergeInto: target.id },
			f.headers,
		);
		expect(
			(
				await f.client.request(
					MetadataCustomFieldsDocument,
					{ metadataId: target.id },
					f.headers,
				)
			).metadataCustomFields[0]?.value,
		).toBe("Original");
		expect((await f.values())[0]?.value).toBeNull();
	});
});
