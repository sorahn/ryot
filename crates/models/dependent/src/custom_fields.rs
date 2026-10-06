use async_graphql::{InputObject, SimpleObject};
use database_models::custom_field;
use enum_models::{CustomFieldKind, MediaLot};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, InputObject, Serialize, Deserialize)]
pub struct SaveCustomFieldInput {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub kind: CustomFieldKind,
    pub media_lots: Vec<MediaLot>,
    pub options: Vec<String>,
}

#[derive(SimpleObject)]
pub struct MetadataCustomField {
    pub definition: custom_field::Model,
    pub value: Option<serde_json::Value>,
}

#[derive(InputObject)]
pub struct CustomFieldValueInput {
    pub field_id: String,
    pub value: Option<serde_json::Value>,
}
