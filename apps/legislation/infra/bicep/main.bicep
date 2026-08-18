targetScope = 'resourceGroup'

param environmentName string
param location string = resourceGroup().location
param owner string
param costCenter string
param image string
@secure()
param policyDatabaseUrl string
@secure()
param openRouterApiKey string
@secure()
param langfusePublicKey string
@secure()
param langfuseSecretKey string
param deployRuntime bool = true
param operationalAlertsEnabled bool = true
param alertActionGroupIds array = []
@allowed(['disabled', 'workos'])
param authMode string = 'disabled'
param workosIssuer string = ''
param workosJwksUrl string = ''
param langfuseBaseUrl string = 'https://cloud.langfuse.com'
param federalStartCongress string = '113'
param federalEndCongress string = '119'

var namePrefix = 'leg-${environmentName}'
var tags = {
  application: 'legislation'
  environment: environmentName
  owner: owner
  costCenter: costCenter
  managedBy: 'bicep'
}

module identity 'modules/identity.bicep' = {
  name: 'identity'
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
    principalIds: [identity.outputs.principalId]
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    namePrefix: namePrefix
    tags: tags
    principalIds: [identity.outputs.principalId]
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'key-vault'
  params: {
    location: location
    namePrefix: namePrefix
    tags: tags
    mcpPrincipalId: identity.outputs.principalId
    policyDatabaseUrl: policyDatabaseUrl
    openRouterApiKey: openRouterApiKey
    langfusePublicKey: langfusePublicKey
    langfuseSecretKey: langfuseSecretKey
  }
}

module runtime 'modules/runtimes.bicep' = if (deployRuntime) {
  name: 'runtime'
  params: {
    authMode: authMode
    databaseUrlSecretUri: keyVault.outputs.policyDatabaseSecretUri
    environmentId: monitoring.outputs.environmentId
    federalEndCongress: federalEndCongress
    federalStartCongress: federalStartCongress
    image: image
    langfuseBaseUrl: langfuseBaseUrl
    langfusePublicKeySecretUri: keyVault.outputs.langfusePublicKeySecretUri
    langfuseSecretKeySecretUri: keyVault.outputs.langfuseSecretKeySecretUri
    location: location
    mcpClientId: identity.outputs.clientId
    mcpIdentityId: identity.outputs.id
    namePrefix: namePrefix
    openRouterApiKeySecretUri: keyVault.outputs.openRouterApiKeySecretUri
    registryServer: registry.outputs.loginServer
    storageAccountName: storage.outputs.accountName
    tags: tags
    workosAudience: authMode == 'workos'
      ? 'https://${namePrefix}-mcp.${monitoring.outputs.environmentDefaultDomain}/mcp'
      : ''
    workosIssuer: workosIssuer
    workosJwksUrl: workosJwksUrl
  }
}

module alerts 'modules/alerts.bicep' = if (deployRuntime) {
  name: 'alerts'
  params: {
    actionGroupIds: alertActionGroupIds
    location: location
    mcpAppId: runtime!.outputs.id
    mcpAppName: '${namePrefix}-mcp'
    namePrefix: namePrefix
    operationalAlertsEnabled: operationalAlertsEnabled
    tags: tags
    workspaceId: monitoring.outputs.workspaceId
  }
}

output containerRegistry string = registry.outputs.loginServer
output keyVaultUri string = keyVault.outputs.uri
output mcpEndpoint string = deployRuntime ? 'https://${runtime!.outputs.fqdn}/mcp' : ''
output mcpIdentityId string = identity.outputs.id
output operationalAlertNames array = deployRuntime ? alerts!.outputs.alertNames : []
output storageEndpoint string = storage.outputs.blobEndpoint
