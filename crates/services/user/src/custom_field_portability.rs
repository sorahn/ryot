use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use anyhow::{Result, ensure};
use database_models::{custom_field, custom_field_value, metadata};
use dependent_models::SaveCustomFieldInput;
use enum_models::{MediaLot, MediaSource};
use nanoid::nanoid;
use sea_orm::{
    AccessMode, ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, IsolationLevel,
    QueryFilter, QueryOrder, QuerySelect, TransactionTrait, sea_query::OnConflict,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use supporting_service::SupportingService;

use crate::custom_field_validation::{validate_definition, validate_value};

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct CustomFieldsExport {
    format_version: u32,
    definitions: Vec<SaveCustomFieldInput>,
    values: Vec<ExportedValue>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ExportedValue {
    field_id: String,
    lot: MediaLot,
    source: MediaSource,
    identifier: String,
    value: Value,
}

pub async fn export_custom_fields(ss: &Arc<SupportingService>, user_id: &str) -> Result<Value> {
    let txn = ss
        .db
        .begin_with_config(
            Some(IsolationLevel::RepeatableRead),
            Some(AccessMode::ReadOnly),
        )
        .await?;
    let definitions = custom_field::Entity::find()
        .filter(custom_field::Column::UserId.eq(user_id))
        .order_by_asc(custom_field::Column::Name)
        .all(&txn)
        .await?;
    let values = custom_field_value::Entity::find()
        .filter(custom_field_value::Column::FieldId.is_in(definitions.iter().map(|f| f.id.clone())))
        .all(&txn)
        .await?;
    let items: HashMap<_, _> = metadata::Entity::find()
        .filter(metadata::Column::Id.is_in(values.iter().map(|v| v.metadata_id.clone())))
        .all(&txn)
        .await?
        .into_iter()
        .map(|m| (m.id.clone(), m))
        .collect();
    let values = values
        .into_iter()
        .filter_map(|v| {
            items.get(&v.metadata_id).map(|m| ExportedValue {
                lot: m.lot,
                source: m.source,
                value: v.value,
                field_id: v.field_id,
                identifier: m.identifier.clone(),
            })
        })
        .collect();
    let definitions = definitions
        .into_iter()
        .map(|f| SaveCustomFieldInput {
            kind: f.kind,
            name: f.name,
            id: Some(f.id),
            options: f.options,
            media_lots: f.media_lots,
            description: f.description,
        })
        .collect();
    let result = serde_json::to_value(CustomFieldsExport {
        values,
        definitions,
        format_version: 1,
    })?;
    txn.commit().await?;
    Ok(result)
}

pub async fn import_custom_fields(
    ss: &Arc<SupportingService>,
    user_id: &str,
    document: Value,
) -> Result<bool> {
    let mut document: CustomFieldsExport = serde_json::from_value(document)?;
    ensure!(
        document.format_version == 1,
        "Unsupported custom-fields export version"
    );
    ensure!(
        document.definitions.len() <= 1000 && document.values.len() <= 50000,
        "Import at most 1000 definitions and 50000 values per file"
    );
    let mut ids = HashSet::new();
    let mut names = HashSet::new();
    for definition in &document.definitions {
        validate_definition(definition)?;
        ensure!(
            definition.name == definition.name.trim(),
            "Field names must not contain surrounding whitespace"
        );
        let id = definition
            .id
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Exported field is missing its ID"))?;
        ensure!(
            ids.insert(id.clone()) && names.insert(definition.name.clone()),
            "Exported field IDs and names must be unique"
        );
    }
    let txn = ss.db.begin().await?;
    let mut existing: HashMap<_, _> = custom_field::Entity::find()
        .filter(custom_field::Column::UserId.eq(user_id))
        .order_by_asc(custom_field::Column::Id)
        .lock_exclusive()
        .all(&txn)
        .await?
        .into_iter()
        .map(|f| (f.name.clone(), f))
        .collect();
    document.definitions.sort_by(|a, b| a.name.cmp(&b.name));
    let mut fields = HashMap::new();
    for input in document.definitions {
        let original_id = input.id.unwrap();
        let field = existing.remove(&input.name);
        let field = match field {
            Some(field) => {
                ensure!(
                    field.kind == input.kind
                        && field.options == input.options
                        && field.media_lots == input.media_lots,
                    "Existing field '{}' has a different definition; rename it or edit the import before retrying",
                    input.name
                );
                field
            }
            None => {
                custom_field::ActiveModel {
                    id: Set(nanoid!()),
                    name: Set(input.name),
                    kind: Set(input.kind),
                    options: Set(input.options),
                    user_id: Set(user_id.to_owned()),
                    media_lots: Set(input.media_lots),
                    description: Set(input.description),
                }
                .insert(&txn)
                .await?
            }
        };
        fields.insert(original_id, field);
    }
    let mut written = HashSet::new();
    for value in document.values {
        let field = fields
            .get(&value.field_id)
            .ok_or_else(|| anyhow::anyhow!("Value references an unknown field"))?;
        let item = metadata::Entity::find()
            .filter(metadata::Column::Lot.eq(value.lot))
            .filter(metadata::Column::Source.eq(value.source))
            .filter(metadata::Column::Identifier.eq(&value.identifier))
            .one(&txn)
            .await?
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Media '{}' is missing; import its catalog record first",
                    value.identifier
                )
            })?;
        ensure!(
            field.media_lots.is_empty() || field.media_lots.contains(&item.lot),
            "Imported value is outside the field's media scope"
        );
        validate_value(field.kind, &field.options, &value.value)?;
        ensure!(
            written.insert((field.id.clone(), item.id.clone())),
            "Duplicate values for a field and media item"
        );
        custom_field_value::Entity::insert(custom_field_value::ActiveModel {
            field_id: Set(field.id.clone()),
            metadata_id: Set(item.id),
            value: Set(value.value),
        })
        .on_conflict(
            OnConflict::columns([
                custom_field_value::Column::FieldId,
                custom_field_value::Column::MetadataId,
            ])
            .update_column(custom_field_value::Column::Value)
            .to_owned(),
        )
        .exec(&txn)
        .await?;
    }
    txn.commit().await?;
    Ok(true)
}
