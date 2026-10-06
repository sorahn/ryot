use async_graphql::Enum;
use sea_orm::{DeriveActiveEnum, EnumIter};
use sea_orm_migration::prelude::StringLen;
use serde::{Deserialize, Serialize};

#[derive(
    Eq, Enum, Copy, Debug, Clone, EnumIter, PartialEq, Serialize, Deserialize, DeriveActiveEnum,
)]
#[sea_orm(
    rs_type = "String",
    rename_all = "snake_case",
    db_type = "String(StringLen::None)"
)]
#[serde(rename_all = "snake_case")]
pub enum CustomFieldKind {
    Text,
    Number,
    Checkbox,
    Date,
    Select,
    MultiSelect,
}
