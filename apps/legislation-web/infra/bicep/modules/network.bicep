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

output containerAppsSubnetId string = containerAppsSubnet.id
output virtualNetworkId string = virtualNetwork.id
