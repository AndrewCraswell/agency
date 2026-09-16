param location string
param namePrefix string
param tags object

resource mcp 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-mcp-id'
  location: location
  tags: tags
}

output id string = mcp.id
output principalId string = mcp.properties.principalId
output clientId string = mcp.properties.clientId
