param location string
param namePrefix string
param tags object
param environmentId string
param registryServer string
param image string
param mcpIdentityId string
param mcpClientId string
param ingestionIdentityId string
param ingestionClientId string
param databaseUrlSecretUri string
param congressApiKeySecretUri string
param openStatesApiKeySecretUri string
param openRouterApiKeySecretUri string
param langfusePublicKeySecretUri string
param langfuseSecretKeySecretUri string
param langfuseBaseUrl string
param authMode string
param workosAudience string
param workosIssuer string
param workosJwksUrl string
param federalStartCongress string
param federalEndCongress string
param storageAccountName string
param enableN8n bool = false
param n8nIdentityId string
param n8nClientId string
param n8nDatabaseHost string
param n8nDatabasePort string
param n8nDatabaseName string
param n8nDatabaseUser string
param n8nDatabaseSslEnabled bool
param n8nDatabasePasswordSecretUri string
param n8nEncryptionSecretUri string
param n8nImage string = 'docker.io/n8nio/n8n:2.5.2'

resource mcp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-mcp'
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${mcpIdentityId}': {} } }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 3100, transport: 'auto', allowInsecure: false }
      registries: [{ server: registryServer, identity: mcpIdentityId }]
      secrets: [
        { name: 'database-url', keyVaultUrl: databaseUrlSecretUri, identity: mcpIdentityId }
        { name: 'openrouter-api-key', keyVaultUrl: openRouterApiKeySecretUri, identity: mcpIdentityId }
        { name: 'langfuse-public-key', keyVaultUrl: langfusePublicKeySecretUri, identity: mcpIdentityId }
        { name: 'langfuse-secret-key', keyVaultUrl: langfuseSecretKeySecretUri, identity: mcpIdentityId }
      ]
    }
    template: {
      containers: [{
        name: 'legislation'
        image: image
        env: [
          { name: 'NODE_ENV', value: 'production' }
          { name: 'LEGISLATION_HOST', value: '0.0.0.0' }
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'AZURE_STORAGE_ACCOUNT', value: storageAccountName }
          { name: 'AZURE_CLIENT_ID', value: mcpClientId }
          { name: 'OPENROUTER_API_KEY', secretRef: 'openrouter-api-key' }
          { name: 'FEDERAL_START_CONGRESS', value: federalStartCongress }
          { name: 'FEDERAL_END_CONGRESS', value: federalEndCongress }
          { name: 'LANGFUSE_PUBLIC_KEY', secretRef: 'langfuse-public-key' }
          { name: 'LANGFUSE_SECRET_KEY', secretRef: 'langfuse-secret-key' }
          { name: 'LANGFUSE_BASE_URL', value: langfuseBaseUrl }
          { name: 'AUTH_MODE', value: authMode }
          { name: 'WORKOS_AUDIENCE', value: workosAudience }
          { name: 'WORKOS_ISSUER', value: workosIssuer }
          { name: 'WORKOS_JWKS_URL', value: workosJwksUrl }
        ]
        probes: [
          { type: 'Liveness', httpGet: { path: '/health', port: 3100 }, initialDelaySeconds: 10, periodSeconds: 30 }
          { type: 'Readiness', httpGet: { path: '/ready', port: 3100 }, initialDelaySeconds: 5, periodSeconds: 10 }
        ]
        resources: { cpu: json('0.5'), memory: '1Gi' }
      }]
      scale: { minReplicas: 1, maxReplicas: 5 }
    }
  }
}

resource ingestion 'Microsoft.App/jobs@2024-03-01' = {
  name: '${namePrefix}-ingestion'
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${ingestionIdentityId}': {} } }
  properties: {
    environmentId: environmentId
    configuration: {
      replicaRetryLimit: 1
      replicaTimeout: 172800
      triggerType: 'Manual'
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      registries: [{ server: registryServer, identity: ingestionIdentityId }]
      secrets: [
        { name: 'database-url', keyVaultUrl: databaseUrlSecretUri, identity: ingestionIdentityId }
        { name: 'congress-api-key', keyVaultUrl: congressApiKeySecretUri, identity: ingestionIdentityId }
        { name: 'openstates-api-key', keyVaultUrl: openStatesApiKeySecretUri, identity: ingestionIdentityId }
        { name: 'openrouter-api-key', keyVaultUrl: openRouterApiKeySecretUri, identity: ingestionIdentityId }
      ]
    }
    template: {
      containers: [{
        name: 'legislation-ingestion'
        image: image
        command: ['node']
        args: ['dist/cli/main.js', '--help']
        env: [
          { name: 'NODE_ENV', value: 'production' }
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'AZURE_STORAGE_ACCOUNT', value: storageAccountName }
          { name: 'AZURE_CLIENT_ID', value: ingestionClientId }
          { name: 'CONGRESS_API_KEY', secretRef: 'congress-api-key' }
          { name: 'OPENSTATE_API_KEY', secretRef: 'openstates-api-key' }
          { name: 'OPENROUTER_API_KEY', secretRef: 'openrouter-api-key' }
        ]
        resources: { cpu: json('1.0'), memory: '2Gi' }
      }]
    }
  }
}

resource n8n 'Microsoft.App/containerApps@2024-03-01' = if (enableN8n) {
  name: '${namePrefix}-n8n'
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${n8nIdentityId}': {} } }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 5678, transport: 'auto', allowInsecure: false }
      registries: [{ server: registryServer, identity: n8nIdentityId }]
      secrets: [
        { name: 'n8n-database-password', keyVaultUrl: n8nDatabasePasswordSecretUri, identity: n8nIdentityId }
        { name: 'n8n-encryption-key', keyVaultUrl: n8nEncryptionSecretUri, identity: n8nIdentityId }
      ]
    }
    template: {
      containers: [{
        name: 'n8n'
        image: n8nImage
        env: [
          { name: 'DB_TYPE', value: 'postgresdb' }
          { name: 'DB_POSTGRESDB_DATABASE', value: n8nDatabaseName }
          { name: 'DB_POSTGRESDB_HOST', value: n8nDatabaseHost }
          { name: 'DB_POSTGRESDB_PORT', value: n8nDatabasePort }
          { name: 'DB_POSTGRESDB_USER', value: n8nDatabaseUser }
          { name: 'DB_POSTGRESDB_PASSWORD', secretRef: 'n8n-database-password' }
          { name: 'DB_POSTGRESDB_SSL_ENABLED', value: n8nDatabaseSslEnabled ? 'true' : 'false' }
          { name: 'N8N_ENCRYPTION_KEY', secretRef: 'n8n-encryption-key' }
          { name: 'AZURE_CLIENT_ID', value: n8nClientId }
          { name: 'AZURE_INGESTION_JOB_ID', value: ingestion.id }
          { name: 'AZURE_INGESTION_CLIENT_ID', value: ingestionClientId }
          { name: 'AZURE_STORAGE_ACCOUNT', value: storageAccountName }
          { name: 'LEGISLATION_IMAGE', value: image }
          { name: 'FEDERAL_START_CONGRESS', value: federalStartCongress }
          { name: 'FEDERAL_END_CONGRESS', value: federalEndCongress }
          { name: 'EXECUTIONS_MODE', value: 'regular' }
        ]
        resources: { cpu: json('0.5'), memory: '1Gi' }
      }]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

resource n8nBootstrap 'Microsoft.App/jobs@2024-03-01' = if (enableN8n) {
  name: '${namePrefix}-n8n-bootstrap'
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${n8nIdentityId}': {} } }
  properties: {
    environmentId: environmentId
    configuration: {
      replicaRetryLimit: 1
      replicaTimeout: 900
      triggerType: 'Manual'
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      registries: [{ server: registryServer, identity: n8nIdentityId }]
      secrets: [
        { name: 'n8n-database-password', keyVaultUrl: n8nDatabasePasswordSecretUri, identity: n8nIdentityId }
        { name: 'n8n-encryption-key', keyVaultUrl: n8nEncryptionSecretUri, identity: n8nIdentityId }
      ]
    }
    template: {
      containers: [{
        name: 'n8n-bootstrap'
        image: n8nImage
        command: ['/bin/sh']
        args: [
          '-c'
          'n8n import:workflow --separate --input=/opt/legislation/workflows --activeState=false && n8n unpublish:workflow --id=legislation-bootstrap-orchestration && n8n unpublish:workflow --id=legislation-congress-sync && n8n unpublish:workflow --id=legislation-congress-events-refresh && n8n unpublish:workflow --id=legislation-congress-votes-refresh && n8n unpublish:workflow --id=legislation-congress-amend-refresh && n8n unpublish:workflow --id=legislation-congress-report-refresh && n8n unpublish:workflow --id=legislation-coverage-report && n8n unpublish:workflow --id=legislation-document-processing && n8n unpublish:workflow --id=legislation-embedding-refresh && n8n unpublish:workflow --id=legislation-govinfo-bootstrap && n8n unpublish:workflow --id=legislation-openstates-refresh'
        ]
        env: [
          { name: 'DB_TYPE', value: 'postgresdb' }
          { name: 'DB_POSTGRESDB_DATABASE', value: n8nDatabaseName }
          { name: 'DB_POSTGRESDB_HOST', value: n8nDatabaseHost }
          { name: 'DB_POSTGRESDB_PORT', value: n8nDatabasePort }
          { name: 'DB_POSTGRESDB_USER', value: n8nDatabaseUser }
          { name: 'DB_POSTGRESDB_PASSWORD', secretRef: 'n8n-database-password' }
          { name: 'DB_POSTGRESDB_SSL_ENABLED', value: n8nDatabaseSslEnabled ? 'true' : 'false' }
          { name: 'N8N_ENCRYPTION_KEY', secretRef: 'n8n-encryption-key' }
        ]
        resources: { cpu: json('0.5'), memory: '1Gi' }
      }]
    }
  }
}

output mcpFqdn string = mcp.properties.configuration.ingress.fqdn
output mcpId string = mcp.id
output ingestionJobId string = ingestion.id
output n8nBootstrapJobId string = enableN8n ? n8nBootstrap.id : ''
output n8nFqdn string = enableN8n ? n8n!.properties.configuration.ingress.fqdn : ''
