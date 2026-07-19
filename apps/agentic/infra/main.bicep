targetScope = 'resourceGroup'

@allowed([
  'development'
  'staging'
  'production'
])
param environmentName string

param location string = resourceGroup().location
param tenantId string = tenant().tenantId

@minLength(1)
param linearTeamId string

@minLength(1)
param webOrigin string

param repositoryOwner string = 'AndrewCraswell'
param repositoryName string = 'agency'
param githubAssignmentLabel string = 'agency-agent'
param scrumMasterModel string = 'openai/gpt-5.6'
param imageDigest string = ''
param enableRuntimeProcesses bool = false

@allowed([
  'Disabled'
  'Enabled'
])
param registryPublicNetworkAccess string = 'Disabled'

param apiMinimumReplicas int = 1
param apiMaximumReplicas int = 3
param workerMinimumReplicas int = 1
param workerMaximumReplicas int = 2
param apiConcurrentRequests int = 50
param postgresSkuName string = 'Standard_D2ds_v5'
param postgresStorageSizeGB int = 128
param backupRetentionDays int = 14
param monitoringRetentionDays int = 30
param dispatchIntervalMs int = 5000
param scrumMasterIntervalMs int = 1800000
param maximumConcurrentRuns int = 10
param secretCacheTtlMs int = 300000
param webhookStaleAfterMs int = 300000
param webhookMaximumAttempts int = 5
param reconcilerCronExpression string = '*/5 * * * *'
param langsmithTracing bool = false
param langsmithWorkspaceId string = ''
param langsmithProject string = ''
param postgresPoolMax int = 10
param postgresConnectionTimeoutMs int = 10000
param postgresIdleTimeoutMs int = 30000
param postgresStatementTimeoutMs int = 60000
param postgresLockTimeoutMs int = 10000
param postgresIdleTransactionTimeoutMs int = 60000

var workloadName = 'agentic'
var prefix = '${workloadName}-${environmentName}'
var uniqueSuffix = uniqueString(subscription().subscriptionId, resourceGroup().id, environmentName)
var registryName = take(toLower('${workloadName}${environmentName}${uniqueSuffix}'), 50)
var storageAccountName = take(toLower('${workloadName}${environmentName}${uniqueSuffix}'), 24)
var keyVaultName = take(toLower('${workloadName}-${take(environmentName, 4)}-${uniqueSuffix}'), 24)
var deployApplications = startsWith(imageDigest, 'sha256:') && length(imageDigest) == 71
var deploymentModes = {
  'true-false-false': 'infrastructure-only'
  'true-false-true': 'infrastructure-only'
  'false-false-false': 'invalid-image-digest'
  'false-false-true': 'invalid-image-digest'
  'false-true-false': 'migration-ready'
  'false-true-true': 'application'
}
var deploymentModeKey = '${empty(imageDigest)}-${deployApplications}-${enableRuntimeProcesses}'
var tags = {
  environment: environmentName
  managedBy: 'bicep'
  workload: workloadName
}
var runtimeConfiguration = {
  apiConcurrentRequests: apiConcurrentRequests
  dispatchIntervalMs: dispatchIntervalMs
  githubAssignmentLabel: githubAssignmentLabel
  langsmithProject: langsmithProject
  langsmithTracing: langsmithTracing
  langsmithWorkspaceId: langsmithWorkspaceId
  linearTeamId: linearTeamId
  maximumConcurrentRuns: maximumConcurrentRuns
  postgresConnectionTimeoutMs: postgresConnectionTimeoutMs
  postgresIdleTimeoutMs: postgresIdleTimeoutMs
  postgresIdleTransactionTimeoutMs: postgresIdleTransactionTimeoutMs
  postgresLockTimeoutMs: postgresLockTimeoutMs
  postgresPoolMax: postgresPoolMax
  postgresStatementTimeoutMs: postgresStatementTimeoutMs
  repositoryName: repositoryName
  repositoryOwner: repositoryOwner
  scrumMasterIntervalMs: scrumMasterIntervalMs
  scrumMasterModel: scrumMasterModel
  secretCacheTtlMs: secretCacheTtlMs
  webOrigin: webOrigin
  webhookMaximumAttempts: webhookMaximumAttempts
  webhookStaleAfterMs: webhookStaleAfterMs
}

module network './modules/network.bicep' = {
  name: 'network'
  params: {
    prefix: prefix
    location: location
    tags: tags
  }
}

module identities './modules/identities.bicep' = {
  name: 'identities'
  params: {
    prefix: prefix
    location: location
    tags: tags
  }
}

module monitoring './modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    prefix: prefix
    location: location
    tags: tags
    retentionDays: monitoringRetentionDays
  }
}

module data './modules/data.bicep' = {
  name: 'data'
  params: {
    prefix: prefix
    storageAccountName: storageAccountName
    keyVaultName: keyVaultName
    location: location
    tags: tags
    tenantId: tenantId
    postgresSubnetId: network.outputs.postgresSubnetId
    postgresDnsZoneId: network.outputs.postgresDnsZoneId
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    blobDnsZoneId: network.outputs.blobDnsZoneId
    vaultDnsZoneId: network.outputs.vaultDnsZoneId
    logAnalyticsId: monitoring.outputs.logAnalyticsId
    migrationIdentity: identities.outputs.migration
    workerPrincipalId: identities.outputs.worker.principalId
    keyVaultReaderPrincipalIds: [
      identities.outputs.api.principalId
      identities.outputs.worker.principalId
    ]
    keyVaultOfficerPrincipalId: identities.outputs.secretAdministrator.principalId
    postgresSkuName: postgresSkuName
    postgresStorageSizeGB: postgresStorageSizeGB
    backupRetentionDays: backupRetentionDays
  }
}

module compute './modules/compute.bicep' = {
  name: 'compute'
  params: {
    prefix: prefix
    registryName: registryName
    location: location
    tags: tags
    containerAppsSubnetId: network.outputs.containerAppsSubnetId
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    registryDnsZoneId: network.outputs.registryDnsZoneId
    logAnalyticsName: '${prefix}-logs'
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsId: monitoring.outputs.logAnalyticsId
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    postgresHost: data.outputs.postgresHost
    postgresDatabase: data.outputs.postgresDatabase
    storageAccountUrl: data.outputs.storageAccountUrl
    artifactContainerName: data.outputs.artifactContainerName
    keyVaultUrl: data.outputs.keyVaultUrl
    apiIdentity: identities.outputs.api
    workerIdentity: identities.outputs.worker
    reconcilerIdentity: identities.outputs.reconciler
    migrationIdentity: identities.outputs.migration
    runtimeConfiguration: runtimeConfiguration
    deployApplications: deployApplications
    enableRuntimeProcesses: enableRuntimeProcesses
    imageDigest: imageDigest
    registryPublicNetworkAccess: registryPublicNetworkAccess
    apiMinimumReplicas: apiMinimumReplicas
    apiMaximumReplicas: apiMaximumReplicas
    workerMinimumReplicas: workerMinimumReplicas
    workerMaximumReplicas: workerMaximumReplicas
    reconcilerCronExpression: reconcilerCronExpression
  }
}

output deploymentMode string = deploymentModes[deploymentModeKey]
output registryLoginServer string = compute.outputs.registryLoginServer
output containerAppsEnvironmentId string = compute.outputs.containerAppsEnvironmentId
output deployedImageReference string = compute.outputs.deployedImageReference
output apiUrl string = empty(compute.outputs.apiFqdn) ? '' : 'https://${compute.outputs.apiFqdn}'
output keyVaultName string = keyVaultName
output storageAccountName string = storageAccountName
output migrationJobName string = compute.outputs.migrationJobName
output reconcilerJobName string = compute.outputs.reconcilerJobName
