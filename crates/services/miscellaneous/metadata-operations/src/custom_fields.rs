use anyhow::{Result, ensure};
use database_models::{custom_field, custom_field_value, metadata};
use sea_orm::{
    ActiveValue::Set, ColumnTrait, DatabaseTransaction, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, sea_query::OnConflict,
};

pub async fn merge_values(
    txn: &DatabaseTransaction,
    user_id: &str,
    from: &str,
    into: &str,
) -> Result<()> {
    ensure!(from != into, "Cannot merge a media item into itself");
    let target = metadata::Entity::find_by_id(into)
        .one(txn)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Target media item not found"))?;
    let fields = custom_field::Entity::find()
        .filter(custom_field::Column::UserId.eq(user_id))
        .order_by_asc(custom_field::Column::Id)
        .lock_exclusive()
        .all(txn)
        .await?;
    for field in fields {
        let Some(value) =
            custom_field_value::Entity::find_by_id((field.id.clone(), from.to_owned()))
                .one(txn)
                .await?
        else {
            continue;
        };
        ensure!(
            field.media_lots.is_empty() || field.media_lots.contains(&target.lot),
            "Custom field '{}' does not apply to the target media type",
            field.name
        );
        let old = custom_field_value::Entity::find_by_id((field.id.clone(), into.to_owned()))
            .one(txn)
            .await?;
        ensure!(
            old.is_none_or(|v| v.value == value.value),
            "Custom field '{}' has conflicting values; resolve them before merging",
            field.name
        );
        custom_field_value::Entity::insert(custom_field_value::ActiveModel {
            field_id: Set(field.id.clone()),
            metadata_id: Set(into.to_owned()),
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
        .exec(txn)
        .await?;
        custom_field_value::Entity::delete_by_id((field.id, from.to_owned()))
            .exec(txn)
            .await?;
    }
    Ok(())
}
