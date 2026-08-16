param location string
param namePrefix string
param tags object

resource mcp 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-mcp-id'
  location: location
  tags: tags
}

resource ingestion 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-ingest-id'
  location: location
  tags: tags
}

resource n8n 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-n8n-id'
  location: location
  tags: tags
}

output mcpId string = mcp.id
output mcpPrincipalId string = mcp.properties.principalId
output mcpClientId string = mcp.properties.clientId
output ingestionId string = ingestion.id
output ingestionPrincipalId string = ingestion.properties.principalId
output ingestionClientId string = ingestion.properties.clientId
output n8nId string = n8n.id
output n8nPrincipalId string = n8n.properties.principalId
output n8nClientId string = n8n.properties.clientId
