use async_graphql::{Context, Object, Result};
use database_models::{custom_field, integration, notification_platform};
use dependent_models::{
    CachedResponse, CustomFieldValueInput, MetadataCustomField, SaveCustomFieldInput,
    UserMetadataRecommendationsResponse,
};
use media_models::{
    CreateOrUpdateUserIntegrationInput, CreateUserNotificationPlatformInput,
    UpdateUserNotificationPlatformInput,
};
use traits::GraphqlDependencyInjector;
use user_service::{
    custom_field_operations, custom_field_portability, integration_operations,
    notification_operations, recommendation_operations,
};

#[derive(Default)]
pub struct UserServicesQueryResolver;

impl GraphqlDependencyInjector for UserServicesQueryResolver {}

#[Object]
impl UserServicesQueryResolver {
    async fn user_custom_fields(&self, gql_ctx: &Context<'_>) -> Result<Vec<custom_field::Model>> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(custom_field_operations::user_custom_fields(service, &user_id).await?)
    }

    async fn metadata_custom_fields(
        &self,
        gql_ctx: &Context<'_>,
        metadata_id: String,
    ) -> Result<Vec<MetadataCustomField>> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(
            custom_field_operations::metadata_custom_fields(service, &user_id, &metadata_id)
                .await?,
        )
    }

    async fn export_custom_fields(&self, gql_ctx: &Context<'_>) -> Result<serde_json::Value> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(custom_field_portability::export_custom_fields(service, &user_id).await?)
    }

    /// Get metadata recommendations for the currently logged in user.
    async fn user_metadata_recommendations(
        &self,
        gql_ctx: &Context<'_>,
    ) -> Result<CachedResponse<UserMetadataRecommendationsResponse>> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(recommendation_operations::user_metadata_recommendations(service, &user_id).await?)
    }

    /// Get all the integrations for the currently logged in user.
    async fn user_integrations(&self, gql_ctx: &Context<'_>) -> Result<Vec<integration::Model>> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(integration_operations::user_integrations(service, &user_id).await?)
    }

    /// Get all the notification platforms for the currently logged in user.
    async fn user_notification_platforms(
        &self,
        gql_ctx: &Context<'_>,
    ) -> Result<Vec<notification_platform::Model>> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(notification_operations::user_notification_platforms(service, &user_id).await?)
    }
}

#[derive(Default)]
pub struct UserServicesMutationResolver;

impl GraphqlDependencyInjector for UserServicesMutationResolver {
    fn is_mutation(&self) -> bool {
        true
    }
}

#[Object]
impl UserServicesMutationResolver {
    async fn save_custom_field(
        &self,
        gql_ctx: &Context<'_>,
        input: SaveCustomFieldInput,
    ) -> Result<custom_field::Model> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(custom_field_operations::save_custom_field(service, &user_id, input).await?)
    }

    async fn delete_custom_field(&self, gql_ctx: &Context<'_>, field_id: String) -> Result<bool> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(custom_field_operations::delete_custom_field(service, &user_id, &field_id).await?)
    }

    async fn save_metadata_custom_fields(
        &self,
        gql_ctx: &Context<'_>,
        metadata_id: String,
        values: Vec<CustomFieldValueInput>,
    ) -> Result<bool> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(custom_field_operations::save_metadata_custom_fields(
            service,
            &user_id,
            &metadata_id,
            values,
        )
        .await?)
    }

    async fn import_custom_fields(
        &self,
        gql_ctx: &Context<'_>,
        document: serde_json::Value,
    ) -> Result<bool> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(custom_field_portability::import_custom_fields(service, &user_id, document).await?)
    }

    /// Create or update an integration for the currently logged in user.
    async fn create_or_update_user_integration(
        &self,
        gql_ctx: &Context<'_>,
        input: CreateOrUpdateUserIntegrationInput,
    ) -> Result<bool> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(
            integration_operations::create_or_update_user_integration(service, user_id, input)
                .await?,
        )
    }

    /// Delete an integration for the currently logged in user.
    async fn delete_user_integration(
        &self,
        gql_ctx: &Context<'_>,
        integration_id: String,
    ) -> Result<bool> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(
            integration_operations::delete_user_integration(service, user_id, integration_id)
                .await?,
        )
    }

    /// Add a notification platform for the currently logged in user.
    async fn create_user_notification_platform(
        &self,
        gql_ctx: &Context<'_>,
        input: CreateUserNotificationPlatformInput,
    ) -> Result<String> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(
            notification_operations::create_user_notification_platform(service, user_id, input)
                .await?,
        )
    }

    /// Edit a notification platform for the currently logged in user.
    async fn update_user_notification_platform(
        &self,
        gql_ctx: &Context<'_>,
        input: UpdateUserNotificationPlatformInput,
    ) -> Result<bool> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(
            notification_operations::update_user_notification_platform(service, user_id, input)
                .await?,
        )
    }

    /// Delete a notification platform for the currently logged in user.
    async fn delete_user_notification_platform(
        &self,
        gql_ctx: &Context<'_>,
        notification_id: String,
    ) -> Result<bool> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(notification_operations::delete_user_notification_platform(
            service,
            user_id,
            notification_id,
        )
        .await?)
    }

    /// Test all notification platforms for the currently logged in user.
    async fn test_user_notification_platforms(&self, gql_ctx: &Context<'_>) -> Result<bool> {
        let (service, user_id) = self.dependency_and_user(gql_ctx).await?;
        Ok(notification_operations::test_user_notification_platforms(service, &user_id).await?)
    }
}
