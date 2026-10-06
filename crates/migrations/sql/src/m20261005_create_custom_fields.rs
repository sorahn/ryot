use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.get_connection().execute_unprepared(
            r#"
            CREATE TABLE custom_field (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                description TEXT,
                kind TEXT NOT NULL CHECK (kind IN ('text', 'number', 'checkbox', 'date', 'select', 'multi_select')),
                media_lots TEXT[] NOT NULL DEFAULT '{}',
                options TEXT[] NOT NULL DEFAULT '{}',
                UNIQUE (user_id, name)
            );
            CREATE TABLE custom_field_value (
                field_id TEXT NOT NULL REFERENCES custom_field(id) ON DELETE CASCADE,
                metadata_id TEXT NOT NULL REFERENCES metadata(id) ON DELETE RESTRICT,
                value JSONB NOT NULL,
                PRIMARY KEY (field_id, metadata_id)
            );
            CREATE INDEX custom_field_value_metadata_idx ON custom_field_value(metadata_id);
            "#,
        ).await?;
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
