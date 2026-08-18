param actionGroupIds array = []
param location string
param mcpAppId string
param mcpAppName string
param namePrefix string
param operationalAlertsEnabled bool = true
param tags object
param workspaceId string

var metricActions = [for actionGroupId in actionGroupIds: { actionGroupId: actionGroupId }]
var queryActions = { actionGroups: actionGroupIds }

resource mcpFailures 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-mcp-failures'
  location: 'global'
  tags: tags
  properties: {
    actions: metricActions
    autoMitigate: true
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [{
        criterionType: 'StaticThresholdCriterion'
        dimensions: [{ name: 'statusCodeCategory', operator: 'Include', values: ['5xx'] }]
        metricName: 'Requests'
        metricNamespace: 'Microsoft.App/containerapps'
        name: 'sustained-mcp-5xx'
        operator: 'GreaterThan'
        skipMetricValidation: false
        threshold: 4
        timeAggregation: 'Total'
      }]
    }
    description: 'Page when the MCP runtime returns at least five server errors in 15 minutes.'
    enabled: operationalAlertsEnabled
    evaluationFrequency: 'PT5M'
    scopes: [mcpAppId]
    severity: 1
    windowSize: 'PT15M'
  }
}

resource infrastructureHealth 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-infrastructure-health'
  location: 'global'
  tags: tags
  properties: {
    actions: metricActions
    autoMitigate: true
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [{
        criterionType: 'StaticThresholdCriterion'
        dimensions: []
        metricName: 'Replicas'
        metricNamespace: 'Microsoft.App/containerapps'
        name: 'no-mcp-replicas'
        operator: 'LessThan'
        skipMetricValidation: false
        threshold: 1
        timeAggregation: 'Average'
      }]
    }
    description: 'Page when the MCP application has no ready replica for five minutes.'
    enabled: operationalAlertsEnabled
    evaluationFrequency: 'PT1M'
    scopes: [mcpAppId]
    severity: 1
    windowSize: 'PT5M'
  }
}

resource readinessFailure 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: '${namePrefix}-readiness-failure'
  location: location
  tags: tags
  kind: 'LogAlert'
  properties: {
    actions: queryActions
    autoMitigate: true
    criteria: {
      allOf: [{
        dimensions: []
        failingPeriods: { minFailingPeriodsToAlert: 1, numberOfEvaluationPeriods: 1 }
        operator: 'GreaterThan'
        query: format(
          '''
          ContainerAppConsoleLogs_CL
          | where ContainerAppName_s =~ '{0}'
          | extend payload = parse_json(Log_s)
          | where tostring(payload.message) == 'readiness check failed'
        ''',
          mcpAppName
        )
        threshold: 2
        timeAggregation: 'Count'
      }]
    }
    description: 'Page after three dependency-readiness failures in five minutes.'
    displayName: '${namePrefix} readiness failure'
    enabled: operationalAlertsEnabled
    evaluationFrequency: 'PT5M'
    scopes: [workspaceId]
    severity: 1
    skipQueryValidation: true
    windowSize: 'PT5M'
  }
}

output alertNames array = [mcpFailures.name, infrastructureHealth.name, readinessFailure.name]
