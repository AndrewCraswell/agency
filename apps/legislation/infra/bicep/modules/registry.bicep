param location string
param namePrefix string
param tags object
param principalIds array

var normalizedName = take(replace(namePrefix, '-', ''), 30)

resource registry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: 'acr${take(uniqueString(resourceGroup().id), 10)}${normalizedName}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

var acrPullRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
resource pullAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in principalIds: {
  name: guid(registry.id, principalId, acrPullRoleId)
  scope: registry
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleId
  }
}]

output id string = registry.id
output loginServer string = registry.properties.loginServer
output name string = registry.name
