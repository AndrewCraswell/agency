param location string
param namePrefix string
param tags object
@secure()
param administratorPassword string
param delegatedSubnetResourceId string
param privateDnsZoneArmResourceId string

var normalizedName = take(toLower(namePrefix), 45)
resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: '${normalizedName}-pg'
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    administratorLogin: 'legislationadmin'
    administratorLoginPassword: administratorPassword
    authConfig: { activeDirectoryAuth: 'Disabled', passwordAuth: 'Enabled' }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
    createMode: 'Create'
    highAvailability: { mode: 'Disabled' }
    network: {
      delegatedSubnetResourceId: delegatedSubnetResourceId
      privateDnsZoneArmResourceId: privateDnsZoneArmResourceId
      publicNetworkAccess: 'Disabled'
    }
    storage: { storageSizeGB: 32 }
    version: '16'
  }
}

resource azureExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: server
  name: 'azure.extensions'
  properties: { source: 'user-override', value: 'VECTOR' }
}

resource policyDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: server
  name: 'policy'
}

resource n8nDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: server
  name: 'n8n'
}

output fqdn string = server.properties.fullyQualifiedDomainName
output id string = server.id
output name string = server.name
