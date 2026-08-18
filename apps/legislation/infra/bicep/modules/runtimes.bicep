param location string
param namePrefix string
param tags object
param environmentId string
param registryServer string
param image string
param mcpIdentityId string
param mcpClientId string
param databaseUrlSecretUri string
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

output fqdn string = mcp.properties.configuration.ingress.fqdn
output id string = mcp.id
