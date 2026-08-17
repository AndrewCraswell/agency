param actionGroupIds array = []
param ingestionJobName string
param location string
param mcpAppId string
param mcpAppName string
param namePrefix string
param operationalAlertsEnabled bool = true
param scheduledSyncAlertsEnabled bool = false
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
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          dimensions: [
            {
              name: 'Status Code Category'
              operator: 'Include'
              values: ['5xx']
            }
          ]
          metricName: 'Requests'
          metricNamespace: 'Microsoft.App/containerapps'
          name: 'sustained-mcp-5xx'
          operator: 'GreaterThan'
          skipMetricValidation: false
          threshold: 4
          timeAggregation: 'Total'
        }
      ]
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
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          dimensions: []
          metricName: 'Replicas'
          metricNamespace: 'Microsoft.App/containerapps'
          name: 'no-mcp-replicas'
          operator: 'LessThan'
          skipMetricValidation: false
          threshold: 1
          timeAggregation: 'Average'
        }
      ]
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
      allOf: [
        {
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
        }
      ]
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

resource scheduledSyncFailure 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: '${namePrefix}-scheduled-sync-failure'
  location: location
  tags: tags
  kind: 'LogAlert'
  properties: {
    actions: queryActions
    autoMitigate: true
    criteria: {
      allOf: [
        {
          dimensions: []
          failingPeriods: { minFailingPeriodsToAlert: 1, numberOfEvaluationPeriods: 1 }
          operator: 'GreaterThan'
          query: format(
            '''
            ContainerAppConsoleLogs_CL
            | where ContainerJobName_s =~ '{0}'
            | extend payload = parse_json(Log_s)
            | where tostring(payload.message) == 'command failed'
                or tostring(payload.status) in ('failed', 'partial')
          ''',
            ingestionJobName
          )
          threshold: 0
          timeAggregation: 'Count'
        }
      ]
    }
    description: 'Page when a scheduled ingestion execution fails or returns a partial result.'
    displayName: '${namePrefix} scheduled sync failure'
    enabled: operationalAlertsEnabled && scheduledSyncAlertsEnabled
    evaluationFrequency: 'PT5M'
    scopes: [workspaceId]
    severity: 1
    skipQueryValidation: true
    windowSize: 'PT15M'
  }
}

resource stalledCheckpoint 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: '${namePrefix}-stalled-checkpoint'
  location: location
  tags: tags
  kind: 'LogAlert'
  properties: {
    actions: queryActions
    autoMitigate: true
    criteria: {
      allOf: [
        {
          dimensions: []
          failingPeriods: { minFailingPeriodsToAlert: 1, numberOfEvaluationPeriods: 1 }
          operator: 'GreaterThan'
          query: format(
            '''
            ContainerAppConsoleLogs_CL
            | where ContainerJobName_s =~ '{0}'
            | extend payload = parse_json(Log_s)
            | where tostring(payload.message) == 'operational readiness snapshot'
            | top 1 by TimeGenerated desc
            | where tobool(payload.congressCheckpointObserved)
                and todouble(payload.congressCheckpointAgeHours) > 12
          ''',
            ingestionJobName
          )
          threshold: 0
          timeAggregation: 'Count'
        }
      ]
    }
    description: 'Page when the observed Congress bills checkpoint is more than 12 hours old.'
    displayName: '${namePrefix} stalled checkpoint'
    enabled: operationalAlertsEnabled && scheduledSyncAlertsEnabled
    evaluationFrequency: 'PT15M'
    scopes: [workspaceId]
    severity: 1
    skipQueryValidation: true
    windowSize: 'P2D'
  }
}

resource documentFailureRate 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: '${namePrefix}-document-failure-rate'
  location: location
  tags: tags
  kind: 'LogAlert'
  properties: {
    actions: queryActions
    autoMitigate: true
    criteria: {
      allOf: [
        {
          dimensions: []
          failingPeriods: { minFailingPeriodsToAlert: 1, numberOfEvaluationPeriods: 1 }
          operator: 'GreaterThan'
          query: format(
            '''
            ContainerAppConsoleLogs_CL
            | where ContainerJobName_s =~ '{0}'
            | extend payload = parse_json(Log_s)
            | where tostring(payload.message) == 'operational readiness snapshot'
            | top 1 by TimeGenerated desc
            | where todouble(payload.documentFailureRate) > 0.05
          ''',
            ingestionJobName
          )
          threshold: 0
          timeAggregation: 'Count'
        }
      ]
    }
    description: 'Create a ticket when the latest corpus snapshot has a document extraction failure rate above 5 percent.'
    displayName: '${namePrefix} document failure rate'
    enabled: operationalAlertsEnabled
    evaluationFrequency: 'PT1H'
    scopes: [workspaceId]
    severity: 2
    skipQueryValidation: true
    windowSize: 'P2D'
  }
}

resource embeddingBacklog 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: '${namePrefix}-embedding-backlog'
  location: location
  tags: tags
  kind: 'LogAlert'
  properties: {
    actions: queryActions
    autoMitigate: true
    criteria: {
      allOf: [
        {
          dimensions: []
          failingPeriods: { minFailingPeriodsToAlert: 1, numberOfEvaluationPeriods: 1 }
          operator: 'GreaterThan'
          query: format(
            '''
            ContainerAppConsoleLogs_CL
            | where ContainerJobName_s =~ '{0}'
            | extend payload = parse_json(Log_s)
            | where tostring(payload.message) == 'operational readiness snapshot'
            | top 1 by TimeGenerated desc
            | where tolong(payload.embeddingBacklog) > 0
                and todouble(payload.embeddingBacklogAgeHours) > 24
          ''',
            ingestionJobName
          )
          threshold: 0
          timeAggregation: 'Count'
        }
      ]
    }
    description: 'Create a ticket when missing embeddings have remained in the corpus for more than one day.'
    displayName: '${namePrefix} embedding backlog'
    enabled: operationalAlertsEnabled
    evaluationFrequency: 'PT1H'
    scopes: [workspaceId]
    severity: 2
    skipQueryValidation: true
    windowSize: 'P2D'
  }
}

output alertNames array = [
  mcpFailures.name
  infrastructureHealth.name
  readinessFailure.name
  scheduledSyncFailure.name
  stalledCheckpoint.name
  documentFailureRate.name
  embeddingBacklog.name
]
