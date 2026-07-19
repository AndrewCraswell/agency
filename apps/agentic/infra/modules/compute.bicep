param prefix string
param registryName string
param location string
param tags object
param containerAppsSubnetId string
param privateEndpointSubnetId string
param registryDnsZoneId string
param logAnalyticsName string
param logAnalyticsCustomerId string
param logAnalyticsId string
param applicationInsightsConnectionString string
param postgresHost string
param postgresDatabase string
param storageAccountUrl string
param artifactContainerName string
param keyVaultUrl string
param apiIdentity object
param workerIdentity object
param reconcilerIdentity object
param migrationIdentity object
param runtimeConfiguration object
param deployApplications bool = false
param enableRuntimeProcesses bool = false
param imageDigest string = ''
param registryPublicNetworkAccess string = 'Disabled'
param apiMinimumReplicas int = 1
param apiMaximumReplicas int = 3
param workerMinimumReplicas int = 1
param workerMaximumReplicas int = 2
param reconcilerCronExpression string = '*/5 * * * *'

var acrPullRole = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)
var imageReference = '${registry.properties.loginServer}/agentic@${imageDigest}'
var deployRuntimeProcesses = deployApplications && enableRuntimeProcesses
var postgresSettings = [
  {
    name: 'POSTGRES_PROVIDER'
    value: 'azure'
  }
  {
    name: 'POSTGRES_AUTH_MODE'
    value: 'azure-entra'
  }
  {
    name: 'POSTGRES_POOL_MAX'
    value: string(runtimeConfiguration.postgresPoolMax)
  }
  {
    name: 'POSTGRES_CONNECTION_TIMEOUT_MS'
    value: string(runtimeConfiguration.postgresConnectionTimeoutMs)
  }
  {
    name: 'POSTGRES_IDLE_TIMEOUT_MS'
    value: string(runtimeConfiguration.postgresIdleTimeoutMs)
  }
  {
    name: 'POSTGRES_STATEMENT_TIMEOUT_MS'
    value: string(runtimeConfiguration.postgresStatementTimeoutMs)
  }
  {
    name: 'POSTGRES_LOCK_TIMEOUT_MS'
    value: string(runtimeConfiguration.postgresLockTimeoutMs)
  }
  {
    name: 'POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS'
    value: string(runtimeConfiguration.postgresIdleTransactionTimeoutMs)
  }
]
var runtimeSelectionEnvironment = [
  {
    name: 'ORCHESTRATOR_PROVIDER'
    value: 'langgraph'
  }
  {
    name: 'AGENT_RUNTIME_PROVIDER'
    value: 'openhands'
  }
  {
    name: 'WORKSPACE_PROVIDER'
    value: 'daytona'
  }
]
var apiEnvironment = concat(postgresSettings, runtimeSelectionEnvironment, [
  {
    name: 'POSTGRES_API_URL'
    value: 'postgresql://${uriComponent(apiIdentity.name)}@${postgresHost}/${postgresDatabase}'
  }
  {
    name: 'SECRET_PROVIDER'
    value: 'azure-key-vault'
  }
  {
    name: 'AZURE_CLIENT_ID'
    value: apiIdentity.clientId
  }
  {
    name: 'AZURE_KEY_VAULT_URL'
    value: keyVaultUrl
  }
  {
    name: 'CONTROL_PLANE_HOST'
    value: '0.0.0.0'
  }
  {
    name: 'CONTROL_PLANE_PORT'
    value: '3000'
  }
  {
    name: 'CONTROL_PLANE_WEB_ORIGIN'
    value: runtimeConfiguration.webOrigin
  }
  {
    name: 'AGENT_REPOSITORY_OWNER'
    value: runtimeConfiguration.repositoryOwner
  }
  {
    name: 'AGENT_REPOSITORY_NAME'
    value: runtimeConfiguration.repositoryName
  }
  {
    name: 'LINEAR_TEAM_ID'
    value: runtimeConfiguration.linearTeamId
  }
  {
    name: 'GITHUB_WEBHOOK_ASSIGNMENT_LABEL'
    value: runtimeConfiguration.githubAssignmentLabel
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: applicationInsightsConnectionString
  }
])
var workerEnvironment = concat(postgresSettings, runtimeSelectionEnvironment, [
  {
    name: 'POSTGRES_API_URL'
    value: 'postgresql://${uriComponent(workerIdentity.name)}@${postgresHost}/${postgresDatabase}'
  }
  {
    name: 'SECRET_PROVIDER'
    value: 'azure-key-vault'
  }
  {
    name: 'ARTIFACT_STORE_PROVIDER'
    value: 'azure'
  }
  {
    name: 'AZURE_CLIENT_ID'
    value: workerIdentity.clientId
  }
  {
    name: 'AZURE_KEY_VAULT_URL'
    value: keyVaultUrl
  }
  {
    name: 'AZURE_STORAGE_ACCOUNT_URL'
    value: storageAccountUrl
  }
  {
    name: 'AZURE_ARTIFACT_CONTAINER'
    value: artifactContainerName
  }
  {
    name: 'AZURE_SECRET_CACHE_TTL_MS'
    value: string(runtimeConfiguration.secretCacheTtlMs)
  }
  {
    name: 'AGENT_REPOSITORY_OWNER'
    value: runtimeConfiguration.repositoryOwner
  }
  {
    name: 'AGENT_REPOSITORY_NAME'
    value: runtimeConfiguration.repositoryName
  }
  {
    name: 'LINEAR_TEAM_ID'
    value: runtimeConfiguration.linearTeamId
  }
  {
    name: 'SCRUM_MASTER_MODEL'
    value: runtimeConfiguration.scrumMasterModel
  }
  {
    name: 'DISPATCH_INTERVAL_MS'
    value: string(runtimeConfiguration.dispatchIntervalMs)
  }
  {
    name: 'SCRUM_MASTER_INTERVAL_MS'
    value: string(runtimeConfiguration.scrumMasterIntervalMs)
  }
  {
    name: 'MAX_CONCURRENT_RUNS'
    value: string(runtimeConfiguration.maximumConcurrentRuns)
  }
  {
    name: 'WORKER_HEALTH_PORT'
    value: '3001'
  }
  {
    name: 'LANGSMITH_TRACING'
    value: string(runtimeConfiguration.langsmithTracing)
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: applicationInsightsConnectionString
  }
], runtimeConfiguration.langsmithTracing ? [
  {
    name: 'LANGSMITH_WORKSPACE_ID'
    value: runtimeConfiguration.langsmithWorkspaceId
  }
  {
    name: 'LANGSMITH_PROJECT'
    value: runtimeConfiguration.langsmithProject
  }
] : [])
var reconcilerEnvironment = concat(postgresSettings, runtimeSelectionEnvironment, [
  {
    name: 'POSTGRES_API_URL'
    value: 'postgresql://${uriComponent(reconcilerIdentity.name)}@${postgresHost}/${postgresDatabase}'
  }
  {
    name: 'SECRET_PROVIDER'
    value: 'environment'
  }
  {
    name: 'AZURE_CLIENT_ID'
    value: reconcilerIdentity.clientId
  }
  {
    name: 'WEBHOOK_STALE_AFTER_MS'
    value: string(runtimeConfiguration.webhookStaleAfterMs)
  }
  {
    name: 'WEBHOOK_MAX_ATTEMPTS'
    value: string(runtimeConfiguration.webhookMaximumAttempts)
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: applicationInsightsConnectionString
  }
])
var migrationEnvironment = concat(postgresSettings, [
  {
    name: 'POSTGRES_API_URL'
    value: 'postgresql://${uriComponent(migrationIdentity.name)}@${postgresHost}/${postgresDatabase}'
  }
  {
    name: 'SECRET_PROVIDER'
    value: 'environment'
  }
  {
    name: 'AZURE_CLIENT_ID'
    value: migrationIdentity.clientId
  }
  {
    name: 'POSTGRES_RUNTIME_IDENTITIES_JSON'
    value: string([
      {
        access: 'api'
        name: apiIdentity.name
        objectId: apiIdentity.principalId
      }
      {
        access: 'worker'
        name: workerIdentity.name
        objectId: workerIdentity.principalId
      }
      {
        access: 'reconciler'
        name: reconcilerIdentity.name
        objectId: reconcilerIdentity.principalId
      }
    ])
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: applicationInsightsConnectionString
  }
])

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsName
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: false
    networkRuleBypassOptions: 'AzureServices'
    networkRuleSet: {
      defaultAction: 'Deny'
    }
    policies: {
      exportPolicy: {
        status: 'disabled'
      }
      quarantinePolicy: {
        status: 'disabled'
      }
      retentionPolicy: {
        days: 30
        status: 'enabled'
      }
      trustPolicy: {
        status: 'disabled'
        type: 'Notary'
      }
    }
    publicNetworkAccess: registryPublicNetworkAccess
    zoneRedundancy: 'Disabled'
  }
}

resource registryPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: '${prefix}-registry-pe'
  location: location
  tags: tags
  properties: {
    privateLinkServiceConnections: [
      {
        name: 'registry'
        properties: {
          groupIds: [
            'registry'
          ]
          privateLinkServiceId: registry.id
        }
      }
    ]
    subnet: {
      id: privateEndpointSubnetId
    }
  }
}

resource registryDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: registryPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'registry'
        properties: {
          privateDnsZoneId: registryDnsZoneId
        }
      }
    ]
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-cae'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    peerAuthentication: {
      mtls: {
        enabled: true
      }
    }
    peerTrafficConfiguration: {
      encryption: {
        enabled: true
      }
    }
    vnetConfiguration: {
      dockerBridgeCidr: '10.200.0.0/16'
      infrastructureSubnetId: containerAppsSubnetId
      internal: false
      platformReservedCidr: '10.201.0.0/16'
      platformReservedDnsIP: '10.201.0.10'
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    zoneRedundant: false
  }
}

resource acrPullAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for identity in [apiIdentity, workerIdentity, reconcilerIdentity, migrationIdentity]: {
  scope: registry
  name: guid(registry.id, identity.principalId, acrPullRole)
  properties: {
    principalId: identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRole
  }
}]

resource api 'Microsoft.App/containerApps@2024-03-01' = if (deployRuntimeProcesses) {
  name: '${prefix}-api'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${apiIdentity.id}': {}
    }
  }
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        allowInsecure: false
        external: true
        targetPort: 3000
        transport: 'auto'
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          identity: apiIdentity.id
          server: registry.properties.loginServer
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: imageReference
          args: [
            'src/controlPlane/api.ts'
          ]
          env: apiEnvironment
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              failureThreshold: 12
              initialDelaySeconds: 5
              periodSeconds: 5
              successThreshold: 1
              timeoutSeconds: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              failureThreshold: 3
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 3
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
                scheme: 'HTTP'
              }
              failureThreshold: 3
              periodSeconds: 30
              successThreshold: 1
              timeoutSeconds: 3
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: apiMinimumReplicas
        maxReplicas: apiMaximumReplicas
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: string(runtimeConfiguration.apiConcurrentRequests)
              }
            }
          }
        ]
      }
      terminationGracePeriodSeconds: 60
    }
  }
  dependsOn: [
    acrPullAssignments
  ]
}

resource worker 'Microsoft.App/containerApps@2024-03-01' = if (deployRuntimeProcesses) {
  name: '${prefix}-worker'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${workerIdentity.id}': {}
    }
  }
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          identity: workerIdentity.id
          server: registry.properties.loginServer
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: imageReference
          args: [
            'src/controlPlane/worker.ts'
          ]
          env: workerEnvironment
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/health'
                port: 3001
                scheme: 'HTTP'
              }
              failureThreshold: 18
              initialDelaySeconds: 5
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 3001
                scheme: 'HTTP'
              }
              failureThreshold: 3
              periodSeconds: 10
              successThreshold: 1
              timeoutSeconds: 3
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3001
                scheme: 'HTTP'
              }
              failureThreshold: 3
              periodSeconds: 30
              successThreshold: 1
              timeoutSeconds: 3
            }
          ]
          resources: {
            cpu: 1
            memory: '2Gi'
          }
        }
      ]
      scale: {
        minReplicas: workerMinimumReplicas
        maxReplicas: workerMaximumReplicas
        rules: [
          {
            name: 'cpu-utilization'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '70'
              }
            }
          }
        ]
      }
      terminationGracePeriodSeconds: 300
    }
  }
  dependsOn: [
    acrPullAssignments
  ]
}

resource reconciler 'Microsoft.App/jobs@2024-03-01' = if (deployRuntimeProcesses) {
  name: '${prefix}-reconciler'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${reconcilerIdentity.id}': {}
    }
  }
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Schedule'
      scheduleTriggerConfig: {
        cronExpression: reconcilerCronExpression
        parallelism: 1
        replicaCompletionCount: 1
      }
      replicaRetryLimit: 2
      replicaTimeout: 300
      registries: [
        {
          identity: reconcilerIdentity.id
          server: registry.properties.loginServer
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'reconciler'
          image: imageReference
          args: [
            'src/controlPlane/reconciler.ts'
          ]
          env: reconcilerEnvironment
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
    }
  }
  dependsOn: [
    acrPullAssignments
  ]
}

resource migration 'Microsoft.App/jobs@2024-03-01' = if (deployApplications) {
  name: '${prefix}-migration'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${migrationIdentity.id}': {}
    }
  }
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Manual'
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      replicaRetryLimit: 0
      replicaTimeout: 900
      registries: [
        {
          identity: migrationIdentity.id
          server: registry.properties.loginServer
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'migration'
          image: imageReference
          args: [
            'src/persistence/migrate.ts'
          ]
          env: migrationEnvironment
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
    }
  }
  dependsOn: [
    acrPullAssignments
  ]
}

resource registryDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: registry
  name: 'platform-logs'
  properties: {
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
    workspaceId: logAnalyticsId
  }
}

output registryId string = registry.id
output registryLoginServer string = registry.properties.loginServer
output containerAppsEnvironmentId string = environment.id
output deployedImageReference string = deployApplications ? imageReference : ''
output apiFqdn string = api.?properties.configuration.ingress.fqdn ?? ''
output migrationJobName string = deployApplications ? migration.name : ''
output reconcilerJobName string = deployRuntimeProcesses ? reconciler.name : ''
