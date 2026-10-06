use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use anyhow::{Result, bail, ensure};
use database_models::{custom_field, custom_field_value, metadata};
use dependent_models::{CustomFieldValueInput, MetadataCustomField, SaveCustomFieldInput};
use nanoid::nanoid;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter,
    QueryOrder, QuerySelect, TransactionTrait, sea_query::OnConflict,
};
use supporting_service::SupportingService;

use crate::custom_field_validation::{validate_definition, validate_value};

pub async fn user_custom_fields(
    ss: &Arc<SupportingService>,
    user_id: &str,
) -> Result<Vec<custom_field::Model>> {
    Ok(custom_field::Entity::find()
        .filter(custom_field::Column::UserId.eq(user_id))
        .order_by_asc(custom_field::Column::Name)
        .all(&ss.db)
        .await?)
}

pub async fn metadata_custom_fields(
    ss: &Arc<SupportingService>,
    user_id: &str,
    metadata_id: &str,
) -> Result<Vec<MetadataCustomField>> {
    let item = metadata::Entity::find_by_id(metadata_id)
        .one(&ss.db)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Media item not found"))?;
    let definitions: Vec<_> = user_custom_fields(ss, user_id)
        .await?
        .into_iter()
        .filter(|f| f.media_lots.is_empty() || f.media_lots.contains(&item.lot))
        .collect();
    let mut values: HashMap<_, _> = custom_field_value::Entity::find()
        .filter(custom_field_value::Column::MetadataId.eq(metadata_id))
        .filter(custom_field_value::Column::FieldId.is_in(definitions.iter().map(|d| d.id.clone())))
        .all(&ss.db)
        .await?
        .into_iter()
        .map(|v| (v.field_id, v.value))
        .collect();
    Ok(definitions
        .into_iter()
        .map(|definition| MetadataCustomField {
            value: values.remove(&definition.id),
            definition,
        })
        .collect())
}

pub async fn save_custom_field(
    ss: &Arc<SupportingService>,
    user_id: &str,
    mut input: SaveCustomFieldInput,
) -> Result<custom_field::Model> {
    input.name = input.name.trim().to_owned();
    input.description = input
        .description
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty());
    input.options = input
        .options
        .into_iter()
        .map(|v| v.trim().to_owned())
        .collect();
    validate_definition(&input)?;
    let txn = ss.db.begin().await?;
    let id = if let Some(id) = input.id {
        let old = owned_field(&txn, user_id, &id).await?;
        let values = custom_field_value::Entity::find()
            .filter(custom_field_value::Column::FieldId.eq(&id))
            .all(&txn)
            .await?;
        for value in &values {
            validate_value(input.kind, &input.options, &value.value)
                .map_err(|_| anyhow::anyhow!("Existing values would become invalid; clear or edit them before changing this field"))?;
        }
        if input.media_lots != old.media_lots && !input.media_lots.is_empty() {
            let items = metadata::Entity::find()
                .filter(metadata::Column::Id.is_in(values.iter().map(|v| v.metadata_id.clone())))
                .all(&txn)
                .await?;
            ensure!(
                items.iter().all(|v| input.media_lots.contains(&v.lot)),
                "Existing values use media types outside the new scope"
            );
        }
        id
    } else {
        nanoid!()
    };
    let model = custom_field::ActiveModel {
        id: Set(id),
        name: Set(input.name),
        kind: Set(input.kind),
        options: Set(input.options),
        user_id: Set(user_id.to_owned()),
        media_lots: Set(input.media_lots),
        description: Set(input.description),
    };
    let field = custom_field::Entity::insert(model)
        .on_conflict(
            OnConflict::column(custom_field::Column::Id)
                .update_columns([
                    custom_field::Column::Name,
                    custom_field::Column::Kind,
                    custom_field::Column::Options,
                    custom_field::Column::MediaLots,
                    custom_field::Column::Description,
                ])
                .to_owned(),
        )
        .exec_with_returning(&txn)
        .await?;
    txn.commit().await?;
    Ok(field)
}

pub async fn owned_field<C: ConnectionTrait>(
    db: &C,
    user_id: &str,
    field_id: &str,
) -> Result<custom_field::Model> {
    custom_field::Entity::find_by_id(field_id)
        .filter(custom_field::Column::UserId.eq(user_id))
        .lock_exclusive()
        .one(db)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Custom field not found or access denied"))
}

pub async fn delete_custom_field(
    ss: &Arc<SupportingService>,
    user_id: &str,
    field_id: &str,
) -> Result<bool> {
    let txn = ss.db.begin().await?;
    let field = owned_field(&txn, user_id, field_id).await?;
    let active: custom_field::ActiveModel = field.into();
    active.delete(&txn).await?;
    txn.commit().await?;
    Ok(true)
}

pub async fn save_metadata_custom_fields(
    ss: &Arc<SupportingService>,
    user_id: &str,
    metadata_id: &str,
    mut values: Vec<CustomFieldValueInput>,
) -> Result<bool> {
    ensure!(values.len() <= 1000, "Save at most 1000 values per request");
    ensure!(
        values
            .iter()
            .map(|v| &v.field_id)
            .collect::<HashSet<_>>()
            .len()
            == values.len(),
        "Field IDs must be unique"
    );
    values.sort_by(|a, b| a.field_id.cmp(&b.field_id));
    let txn = ss.db.begin().await?;
    let item = metadata::Entity::find_by_id(metadata_id)
        .one(&txn)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Media item not found"))?;
    for input in values {
        let field = owned_field(&txn, user_id, &input.field_id).await?;
        if !field.media_lots.is_empty() && !field.media_lots.contains(&item.lot) {
            bail!("Custom field does not apply to this media type");
        }
        match input.value.filter(|v| !v.is_null()) {
            None => {
                custom_field_value::Entity::delete_by_id((field.id, metadata_id.to_owned()))
                    .exec(&txn)
                    .await?;
            }
            Some(value) => {
                validate_value(field.kind, &field.options, &value)?;
                custom_field_value::Entity::insert(custom_field_value::ActiveModel {
                    value: Set(value),
                    field_id: Set(field.id),
                    metadata_id: Set(metadata_id.to_owned()),
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
        }
    }
    txn.commit().await?;
    Ok(true)
}
