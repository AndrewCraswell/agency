param location string
param namePrefix string
param tags object
param mcpPrincipalId string
param ingestionPrincipalId string
param n8nPrincipalId string
@secure()
param policyDatabaseUrl string
@secure()
param n8nDatabasePassword string
@secure()
param n8nEncryptionKey string
@secure()
param congressApiKey string
@secure()
param openStatesApiKey string
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

resource n8nDatabasePasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'n8n-database-password'
  properties: { value: n8nDatabasePassword }
}

resource congressApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'congress-api-key'
  properties: { value: congressApiKey }
}

resource openStatesApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'openstates-api-key'
  properties: { value: openStatesApiKey }
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
resource mcpDatabaseGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(policyDatabaseSecret.id, mcpPrincipalId, secretsUserRoleId)
  scope: policyDatabaseSecret
  properties: { principalId: mcpPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource mcpOpenRouterGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openRouterApiKeySecret.id, mcpPrincipalId, secretsUserRoleId)
  scope: openRouterApiKeySecret
  properties: { principalId: mcpPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource mcpLangfusePublicGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(langfusePublicKeySecret.id, mcpPrincipalId, secretsUserRoleId)
  scope: langfusePublicKeySecret
  properties: { principalId: mcpPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource mcpLangfuseSecretGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(langfuseSecretKeySecret.id, mcpPrincipalId, secretsUserRoleId)
  scope: langfuseSecretKeySecret
  properties: { principalId: mcpPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource ingestionDatabaseGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(policyDatabaseSecret.id, ingestionPrincipalId, secretsUserRoleId)
  scope: policyDatabaseSecret
  properties: { principalId: ingestionPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource ingestionCongressGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(congressApiKeySecret.id, ingestionPrincipalId, secretsUserRoleId)
  scope: congressApiKeySecret
  properties: { principalId: ingestionPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource ingestionOpenStatesGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openStatesApiKeySecret.id, ingestionPrincipalId, secretsUserRoleId)
  scope: openStatesApiKeySecret
  properties: { principalId: ingestionPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource ingestionOpenRouterGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openRouterApiKeySecret.id, ingestionPrincipalId, secretsUserRoleId)
  scope: openRouterApiKeySecret
  properties: { principalId: ingestionPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource n8nDatabaseGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(n8nDatabasePasswordSecret.id, n8nPrincipalId, secretsUserRoleId)
  scope: n8nDatabasePasswordSecret
  properties: { principalId: n8nPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}
resource n8nEncryptionGrant 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(n8nEncryptionSecret.id, n8nPrincipalId, secretsUserRoleId)
  scope: n8nEncryptionSecret
  properties: { principalId: n8nPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRoleId }
}

resource n8nEncryptionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'n8n-encryption-key'
  properties: { value: n8nEncryptionKey }
}

output id string = vault.id
output name string = vault.name
output uri string = vault.properties.vaultUri
output policyDatabaseSecretUri string = policyDatabaseSecret.properties.secretUriWithVersion
output n8nDbCredentialUri string = n8nDatabasePasswordSecret.properties.secretUriWithVersion
output n8nEncryptionSecretUri string = n8nEncryptionSecret.properties.secretUriWithVersion
output congressApiKeySecretUri string = congressApiKeySecret.properties.secretUriWithVersion
output openStatesApiKeySecretUri string = openStatesApiKeySecret.properties.secretUriWithVersion
output openRouterApiKeySecretUri string = openRouterApiKeySecret.properties.secretUriWithVersion
output langfusePublicKeySecretUri string = langfusePublicKeySecret.properties.secretUriWithVersion
output langfuseSecretKeySecretUri string = langfuseSecretKeySecret.properties.secretUriWithVersion
