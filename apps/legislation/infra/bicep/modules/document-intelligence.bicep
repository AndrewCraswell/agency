param location string
param namePrefix string
param principalIds array
param tags object

var cognitiveServicesUserRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'a97b65f3-24c7-4388-baec-2e87135dc908'
)

resource account 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${namePrefix}-document-intelligence'
  location: location
  tags: tags
  kind: 'FormRecognizer'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: '${namePrefix}-document-intelligence'
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource userAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in principalIds: {
  name: guid(account.id, principalId, cognitiveServicesUserRoleId)
  scope: account
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: cognitiveServicesUserRoleId
  }
}]

output endpoint string = account.properties.endpoint
output id string = account.id
