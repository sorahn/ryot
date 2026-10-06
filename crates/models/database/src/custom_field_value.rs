use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "custom_field_value")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub field_id: String,
    #[sea_orm(primary_key, auto_increment = false)]
    pub metadata_id: String,
    #[sea_orm(column_type = "JsonBinary")]
    pub value: serde_json::Value,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
