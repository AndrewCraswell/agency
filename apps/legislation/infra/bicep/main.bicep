targetScope = 'resourceGroup'

param environmentName string
param location string = resourceGroup().location
param owner string
param costCenter string
param image string
@secure()
param postgresAdministratorPassword string
@secure()
param n8nEncryptionKey string
@secure()
param congressApiKey string
@secure()
param openRouterApiKey string
@secure()
param langfusePublicKey string
@secure()
param langfuseSecretKey string
param enableN8n bool = false
@allowed(['disabled', 'workos'])
param authMode string = 'disabled'
param workosIssuer string = ''
param workosAudience string = ''
param workosJwksUrl string = ''
param authRequiredScopes string = 'legislation:read'
param langfuseBaseUrl string = 'https://cloud.langfuse.com'
param federalStartCongress string = '113'
param federalEndCongress string = '119'
param openStatesArchiveUrl string = ''
param openStatesJurisdiction string = ''
param openStatesJurisdictionName string = ''
param openStatesStream string = ''
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
    principalIds: [identities.outputs.mcpPrincipalId, identities.outputs.ingestionPrincipalId]
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
    policyDatabaseUrl: 'postgresql://legislationadmin:${uriComponent(postgresAdministratorPassword)}@${postgres.outputs.fqdn}:5432/policy?sslmode=require'
    n8nDatabasePassword: postgresAdministratorPassword
    n8nEncryptionKey: n8nEncryptionKey
    congressApiKey: congressApiKey
    openRouterApiKey: openRouterApiKey
    langfusePublicKey: langfusePublicKey
    langfuseSecretKey: langfuseSecretKey
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    administratorPassword: postgresAdministratorPassword
    delegatedSubnetResourceId: network.outputs.postgresSubnetId
    location: location
    namePrefix: namePrefix
    privateDnsZoneArmResourceId: network.outputs.postgresPrivateDnsZoneId
    tags: tags
  }
}

module runtimes 'modules/runtimes.bicep' = {
  name: 'runtimes'
  params: {
    databaseUrlSecretUri: keyVault.outputs.policyDatabaseSecretUri
    congressApiKeySecretUri: keyVault.outputs.congressApiKeySecretUri
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
    authRequiredScopes: authRequiredScopes
    workosAudience: workosAudience
    workosIssuer: workosIssuer
    workosJwksUrl: workosJwksUrl
    federalStartCongress: federalStartCongress
    federalEndCongress: federalEndCongress
    openStatesArchiveUrl: openStatesArchiveUrl
    openStatesJurisdiction: openStatesJurisdiction
    openStatesJurisdictionName: openStatesJurisdictionName
    openStatesStream: openStatesStream
    n8nIdentityId: identities.outputs.n8nId
    n8nClientId: identities.outputs.n8nClientId
    n8nImage: n8nImage
    n8nDatabaseHost: postgres.outputs.fqdn
    n8nDatabasePasswordSecretUri: keyVault.outputs.n8nDbCredentialUri
    n8nEncryptionSecretUri: keyVault.outputs.n8nEncryptionSecretUri
    namePrefix: namePrefix
    registryServer: registry.outputs.loginServer
    storageAccountName: storage.outputs.accountName
    tags: tags
  }
}

resource ingestionJob 'Microsoft.App/jobs@2024-03-01' existing = {
  name: '${namePrefix}-ingestion'
  dependsOn: [runtimes]
}

var jobsOperatorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b9a307c4-5aa3-4b52-ba60-2b17c136cd7b')
resource n8nJobOperator 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableN8n) {
  name: guid(ingestionJob.id, namePrefix, jobsOperatorRoleId)
  scope: ingestionJob
  properties: {
    principalId: identities.outputs.n8nPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: jobsOperatorRoleId
  }
}

output containerRegistry string = registry.outputs.loginServer
output ingestionJobId string = runtimes.outputs.ingestionJobId
output keyVaultUri string = keyVault.outputs.uri
output mcpEndpoint string = 'https://${runtimes.outputs.mcpFqdn}/mcp'
output mcpIdentityId string = identities.outputs.mcpId
output postgresFqdn string = postgres.outputs.fqdn
output storageEndpoint string = storage.outputs.blobEndpoint
