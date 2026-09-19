targetScope = 'resourceGroup'

@description('Existing Container Apps managed environment name.')
param environmentName string

@description('Existing Azure Container Registry name.')
param registryName string

@description('Immutable scraper image including its sha256 digest.')
param image string

@description('Existing user-assigned identity with ACR pull, Blob contributor and Queue message processor roles.')
param identityName string

@description('Existing storage account containing state-sources and the dispatch queue.')
param storageAccountName string

param stateSourceContainer string = 'state-sources'
param dispatchQueueName string = 'openstates-scraper-dispatch'
param jobName string = 'leg-dev-openstates-scraper'

@description('Maximum simultaneous extraction executions for this queue. Keep canary queues at one.')
@minValue(1)
@maxValue(3)
param maxExecutions int = 3

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: registryName
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: identityName
}

resource scraper 'Microsoft.App/jobs@2025-01-01' = {
  name: jobName
  location: resourceGroup().location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Event'
      replicaTimeout: 1800
      replicaRetryLimit: 0
      registries: [{
        server: registry.properties.loginServer
        identity: identity.id
      }]
      eventTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
        scale: {
          pollingInterval: 30
          minExecutions: 0
          maxExecutions: maxExecutions
          rules: [{
            name: 'scraper-queue'
            type: 'azure-queue'
            identity: identity.id
            metadata: {
              accountName: storageAccountName
              cloud: 'AzurePublicCloud'
              queueLength: '1'
              queueName: dispatchQueueName
            }
          }]
        }
      }
    }
    template: {
      containers: [{
        name: 'openstates-scraper'
        image: image
        // Pin the production queue entry point in infrastructure instead of
        // inheriting an image default that may be a build-time smoke command.
        command: ['python']
        args: ['/opt/openstates/adapter/openstates_cloud_worker.py']
        env: [
          { name: 'AZURE_STORAGE_ACCOUNT', value: storageAccountName }
          { name: 'AZURE_STATE_SOURCE_CONTAINER', value: stateSourceContainer }
          { name: 'OPENSTATES_SCRAPER_QUEUE', value: dispatchQueueName }
          { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
        ]
        resources: { cpu: json('1.0'), memory: '2Gi' }
      }]
    }
  }
}

output jobId string = scraper.id
output image string = image
output queueIdentity string = identity.id
