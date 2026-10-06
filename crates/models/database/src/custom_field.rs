use async_graphql::SimpleObject;
use enum_models::{CustomFieldKind, MediaLot};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, SimpleObject)]
#[sea_orm(table_name = "custom_field")]
#[graphql(name = "CustomField")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[graphql(skip)]
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub kind: CustomFieldKind,
    pub media_lots: Vec<MediaLot>,
    pub options: Vec<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
