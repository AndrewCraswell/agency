param location string
param namePrefix string
param tags object
param mcpPrincipalId string
@secure()
param policyDatabaseUrl string
@secure()
param openRouterApiKey string
@secure()
param langfusePublicKey string
@secure()
param langfuseSecretKey string

var normalizedName = take(replace(namePrefix, '-', ''), 18)
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${normalizedName}-${take(uniqueString(resourceGroup().id), 5)}'
  location: location
  tags: tags
  properties: {
    enablePurgeProtection: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    publicNetworkAccess: 'Enabled'
    sku: { family: 'A', name: 'standard' }
    softDeleteRetentionInDays: 90
    tenantId: tenant().tenantId
  }
}

resource policyDatabaseSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'policy-database-url'
  properties: { value: policyDatabaseUrl }
}

resource openRouterApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'openrouter-api-key'
  properties: { value: openRouterApiKey }
}

resource langfusePublicKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'langfuse-public-key'
  properties: { value: langfusePublicKey }
}

resource langfuseSecretKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'langfuse-secret-key'
  properties: { value: langfuseSecretKey }
}

var secretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
resource policyDatabaseGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(policyDatabaseSecret.id, mcpPrincipalId, secretsUserRoleId)
  scope: policyDatabaseSecret
  properties: { principalId: mcpPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource openRouterGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openRouterApiKeySecret.id, mcpPrincipalId, secretsUserRoleId)
  scope: openRouterApiKeySecret
  properties: { principalId: mcpPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource langfusePublicGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(langfusePublicKeySecret.id, mcpPrincipalId, secretsUserRoleId)
  scope: langfusePublicKeySecret
  properties: { principalId: mcpPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource langfuseSecretGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(langfuseSecretKeySecret.id, mcpPrincipalId, secretsUserRoleId)
  scope: langfuseSecretKeySecret
  properties: { principalId: mcpPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}

output uri string = vault.properties.vaultUri
output policyDatabaseSecretUri string = policyDatabaseSecret.properties.secretUriWithVersion
output openRouterApiKeySecretUri string = openRouterApiKeySecret.properties.secretUriWithVersion
output langfusePublicKeySecretUri string = langfusePublicKeySecret.properties.secretUriWithVersion
output langfuseSecretKeySecretUri string = langfuseSecretKeySecret.properties.secretUriWithVersion
