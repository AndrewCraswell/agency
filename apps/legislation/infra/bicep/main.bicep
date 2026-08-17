targetScope = 'resourceGroup'

param environmentName string
param location string = resourceGroup().location
param owner string
param costCenter string
param image string
@secure()
param policyDatabaseUrl string
param n8nDatabaseHost string
param n8nDatabasePort string
param n8nDatabaseName string
param n8nDatabaseUser string
@secure()
param n8nDatabasePassword string
param n8nDatabaseSslEnabled bool = true
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
param enableN8n bool = false
param deployRuntimes bool = true
@allowed(['disabled', 'workos'])
param authMode string = 'disabled'
param workosIssuer string = ''
param workosJwksUrl string = ''
param langfuseBaseUrl string = 'https://cloud.langfuse.com'
param federalStartCongress string = '113'
param federalEndCongress string = '119'
param n8nImage string = 'docker.io/n8nio/n8n:2.5.2'

var namePrefix = 'leg-${environmentName}'
var tags = {
  application: 'legislation'
  environment: environmentName
  owner: owner
  costCenter: costCenter
  managedBy: 'bicep'
}

module identities 'modules/identity.bicep' = {
  name: 'identities'
  params: { location: location, namePrefix: namePrefix, tags: tags }
}

module network 'modules/network.bicep' = {
  name: 'network'
  params: { location: location, namePrefix: namePrefix, tags: tags }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    infrastructureSubnetId: network.outputs.containerAppsSubnetId
    location: location
    namePrefix: namePrefix
    tags: tags
  }
}

module registry 'modules/registry.bicep' = {
  name: 'registry'
  params: {
    location: location
    namePrefix: namePrefix
    tags: tags
    principalIds: [
      identities.outputs.mcpPrincipalId
      identities.outputs.ingestionPrincipalId
      identities.outputs.n8nPrincipalId
    ]
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    namePrefix: namePrefix
    tags: tags
    principalIds: [identities.outputs.ingestionPrincipalId]
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'key-vault'
  params: {
    location: location
    namePrefix: namePrefix
    tags: tags
    mcpPrincipalId: identities.outputs.mcpPrincipalId
    ingestionPrincipalId: identities.outputs.ingestionPrincipalId
    n8nPrincipalId: identities.outputs.n8nPrincipalId
    policyDatabaseUrl: policyDatabaseUrl
    n8nDatabasePassword: n8nDatabasePassword
    n8nEncryptionKey: n8nEncryptionKey
    congressApiKey: congressApiKey
    openStatesApiKey: openStatesApiKey
    openRouterApiKey: openRouterApiKey
    langfusePublicKey: langfusePublicKey
    langfuseSecretKey: langfuseSecretKey
  }
}

module runtimes 'modules/runtimes.bicep' = if (deployRuntimes) {
  name: 'runtimes'
  params: {
    databaseUrlSecretUri: keyVault.outputs.policyDatabaseSecretUri
    congressApiKeySecretUri: keyVault.outputs.congressApiKeySecretUri
    openStatesApiKeySecretUri: keyVault.outputs.openStatesApiKeySecretUri
    enableN8n: enableN8n
    environmentId: monitoring.outputs.environmentId
    image: image
    ingestionIdentityId: identities.outputs.ingestionId
    ingestionClientId: identities.outputs.ingestionClientId
    location: location
    mcpIdentityId: identities.outputs.mcpId
    mcpClientId: identities.outputs.mcpClientId
    openRouterApiKeySecretUri: keyVault.outputs.openRouterApiKeySecretUri
    langfusePublicKeySecretUri: keyVault.outputs.langfusePublicKeySecretUri
    langfuseSecretKeySecretUri: keyVault.outputs.langfuseSecretKeySecretUri
    langfuseBaseUrl: langfuseBaseUrl
    authMode: authMode
    workosAudience: authMode == 'workos' ? 'https://${namePrefix}-mcp.${monitoring.outputs.environmentDefaultDomain}/mcp' : ''
    workosIssuer: workosIssuer
    workosJwksUrl: workosJwksUrl
    federalStartCongress: federalStartCongress
    federalEndCongress: federalEndCongress
    n8nIdentityId: identities.outputs.n8nId
    n8nClientId: identities.outputs.n8nClientId
    n8nImage: n8nImage
    n8nDatabaseHost: n8nDatabaseHost
    n8nDatabasePort: n8nDatabasePort
    n8nDatabaseName: n8nDatabaseName
    n8nDatabaseUser: n8nDatabaseUser
    n8nDatabaseSslEnabled: n8nDatabaseSslEnabled
    n8nDatabasePasswordSecretUri: keyVault.outputs.n8nDbCredentialUri
    n8nEncryptionSecretUri: keyVault.outputs.n8nEncryptionSecretUri
    namePrefix: namePrefix
    registryServer: registry.outputs.loginServer
    storageAccountName: storage.outputs.accountName
    tags: tags
  }
}

resource ingestionJob 'Microsoft.App/jobs@2024-03-01' existing = if (deployRuntimes) {
  name: '${namePrefix}-ingestion'
  dependsOn: [runtimes]
}

var jobsOperatorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b9a307c4-5aa3-4b52-ba60-2b17c136cd7b')
resource n8nJobOperator 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployRuntimes && enableN8n) {
  name: guid(ingestionJob.id, namePrefix, jobsOperatorRoleId)
  scope: ingestionJob
  properties: {
    principalId: identities.outputs.n8nPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: jobsOperatorRoleId
  }
}

output containerRegistry string = registry.outputs.loginServer
output ingestionJobId string = deployRuntimes ? runtimes!.outputs.ingestionJobId : ''
output keyVaultUri string = keyVault.outputs.uri
output mcpEndpoint string = deployRuntimes ? 'https://${runtimes!.outputs.mcpFqdn}/mcp' : ''
output mcpIdentityId string = identities.outputs.mcpId
output n8nBootstrapJobId string = deployRuntimes && enableN8n ? runtimes!.outputs.n8nBootstrapJobId : ''
output n8nEndpoint string = deployRuntimes && enableN8n ? 'https://${runtimes!.outputs.n8nFqdn}' : ''
output storageEndpoint string = storage.outputs.blobEndpoint
