param location string
param namePrefix string
param tags object

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: '${namePrefix}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.42.0.0/16'] }
  }
}

resource containerAppsSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: virtualNetwork
  name: 'container-apps'
  properties: {
    addressPrefix: '10.42.0.0/23'
    delegations: [{
      name: 'container-apps'
      properties: { serviceName: 'Microsoft.App/environments' }
    }]
  }
}

resource postgresSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: virtualNetwork
  name: 'postgres'
  properties: {
    addressPrefix: '10.42.2.0/24'
    delegations: [{
      name: 'postgres-flexible-server'
      properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' }
    }]
    privateEndpointNetworkPolicies: 'Disabled'
  }
}

resource postgresPrivateDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource postgresPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: postgresPrivateDns
  name: '${namePrefix}-postgres-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: virtualNetwork.id }
  }
}

output containerAppsSubnetId string = containerAppsSubnet.id
output postgresPrivateDnsZoneId string = postgresPrivateDns.id
output postgresSubnetId string = postgresSubnet.id
output virtualNetworkId string = virtualNetwork.id
