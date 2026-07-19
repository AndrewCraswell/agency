param prefix string
param location string
param tags object

resource api 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-api-id'
  location: location
  tags: tags
}

resource worker 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-worker-id'
  location: location
  tags: tags
}

resource reconciler 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-reconciler-id'
  location: location
  tags: tags
}

resource migration 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-migration-id'
  location: location
  tags: tags
}

resource secretAdministrator 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-secret-admin-id'
  location: location
  tags: tags
}

output api object = {
  id: api.id
  name: api.name
  clientId: api.properties.clientId
  principalId: api.properties.principalId
}
output worker object = {
  id: worker.id
  name: worker.name
  clientId: worker.properties.clientId
  principalId: worker.properties.principalId
}
output reconciler object = {
  id: reconciler.id
  name: reconciler.name
  clientId: reconciler.properties.clientId
  principalId: reconciler.properties.principalId
}
output migration object = {
  id: migration.id
  name: migration.name
  clientId: migration.properties.clientId
  principalId: migration.properties.principalId
}
output secretAdministrator object = {
  id: secretAdministrator.id
  name: secretAdministrator.name
  clientId: secretAdministrator.properties.clientId
  principalId: secretAdministrator.properties.principalId
}