param location string
param namePrefix string
param tags object
param principalIds array

var normalizedName = take(replace(namePrefix, '-', ''), 8)
resource account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${take(uniqueString(resourceGroup().id), 12)}${normalizedName}'
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: account
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 7 }
    containerDeleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

resource containers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for name in [
  'state-sources'
  'federal-sources'
  'normalized-documents'
  'reports'
]: {
  parent: blobService
  name: name
  properties: { publicAccess: 'None' }
}]

var blobContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
resource blobAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in principalIds: {
  name: guid(account.id, principalId, blobContributorRoleId)
  scope: account
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobContributorRoleId
  }
}]

output accountId string = account.id
output accountName string = account.name
output blobEndpoint string = account.properties.primaryEndpoints.blob
