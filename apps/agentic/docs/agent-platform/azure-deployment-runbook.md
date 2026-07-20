# Azure Deployment and Acceptance Runbook

Status: Procedure defined; not yet executed against an Azure subscription

Use this runbook to collect the live evidence required by Phases 6 and 7. A warning-free Bicep compile proves only that
the template is syntactically and type valid. It does not prove Azure policy acceptance, quota, identity propagation,
private DNS, image startup, migrations, recovery, or application behavior.

## 1. Prerequisites

- Azure CLI with Bicep and the Container Apps extension installed.
- An existing resource group and a deployment principal allowed to create resources and role assignments.
- PostgreSQL, Container Apps, private endpoint, Premium ACR, managed identity, and regional CPU quota.
- An approved private network path for staging and production image publication. Development intentionally enables ACR
  public access; staging and production do not.
- A secret-bootstrap workload attached to the generated `agentic-<environment>-secret-admin-id` identity. Do not pass
  secret values through Bicep parameters, source files, command-line arguments, logs, or deployment outputs.
- An explicit Linear team ID and web origin for the target environment. There is no team-ID fallback.

## 2. Source validation

From the repository root:

```powershell
pnpm verify
az bicep build --file apps/agentic/infra/main.bicep --stdout | Out-Null
```

Do not continue when either command fails. The current workstation may reject `pnpm` before execution when lockfile
tarball URLs do not match the active supply-chain feed metadata; resolve that policy failure rather than bypassing it.

## 3. Deployment inputs

Set non-secret values explicitly:

```powershell
$ResourceGroup = '<resource-group>'
$Environment = 'staging'
$TemplateFile = 'apps/agentic/infra/main.bicep'
$ParametersFile = "apps/agentic/infra/environments/$Environment.parameters.json"
$LinearTeamId = '<linear-team-id>'
$WebOrigin = 'https://<dashboard-origin>'
```

Parameter files contain sizing and environment selection only. Keep subscription-specific identifiers and all secret
values outside the repository.

## 4. Validate and preview infrastructure

```powershell
az deployment group validate `
  --resource-group $ResourceGroup `
  --template-file $TemplateFile `
  --parameters "@$ParametersFile" `
  --parameters linearTeamId=$LinearTeamId webOrigin=$WebOrigin

az deployment group what-if `
  --resource-group $ResourceGroup `
  --template-file $TemplateFile `
  --parameters "@$ParametersFile" `
  --parameters linearTeamId=$LinearTeamId webOrigin=$WebOrigin
```

Review deletes, role assignments, network ranges, generated names, service tiers, and policy warnings. Retain the full
validation and what-if output with the candidate SHA.

## 5. Provision infrastructure only

Omitting `imageDigest` is intentional. It provisions data, identity, network, monitoring, registry, and the Container
Apps environment without creating a runtime or migration job.

```powershell
$InfrastructureDeployment = "agentic-$Environment-infrastructure"
$Infrastructure = az deployment group create `
  --name $InfrastructureDeployment `
  --resource-group $ResourceGroup `
  --template-file $TemplateFile `
  --parameters "@$ParametersFile" `
  --parameters linearTeamId=$LinearTeamId webOrigin=$WebOrigin `
  | ConvertFrom-Json

if ($Infrastructure.properties.outputs.deploymentMode.value -ne 'infrastructure-only') {
  throw 'Expected an infrastructure-only deployment.'
}

$RegistryLoginServer = $Infrastructure.properties.outputs.registryLoginServer.value
$RegistryName = ($RegistryLoginServer -split '\.')[0]
```

## 6. Publish an immutable image

Use an approved builder that can reach the target ACR. The following ACR build is appropriate only where target network
policy permits it:

```powershell
$CommitSha = (git rev-parse HEAD).Trim()
az acr build `
  --registry $RegistryName `
  --image "agentic:$CommitSha" `
  --file apps/agentic/Dockerfile `
  .

$ImageDigest = az acr repository show `
  --name $RegistryName `
  --image "agentic:$CommitSha" `
  --query digest `
  --output tsv

if ($ImageDigest -notmatch '^sha256:[0-9a-f]{64}$') {
  throw 'ACR did not return an immutable SHA-256 digest.'
}
```

Retain the source SHA, image digest, build log, SBOM, and vulnerability/secret scan evidence. Do not promote a mutable
tag.

## 7. Create and run migration

Deploying a valid digest with runtime processes disabled creates only the manual migration job. This is the default and
prevents the API, worker, and reconciler from racing the first schema migration.

```powershell
$MigrationDeployment = "agentic-$Environment-migration"
$Migration = az deployment group create `
  --name $MigrationDeployment `
  --resource-group $ResourceGroup `
  --template-file $TemplateFile `
  --parameters "@$ParametersFile" `
  --parameters linearTeamId=$LinearTeamId webOrigin=$WebOrigin imageDigest=$ImageDigest enableRuntimeProcesses=false `
  | ConvertFrom-Json

if ($Migration.properties.outputs.deploymentMode.value -ne 'migration-ready') {
  throw 'Expected a migration-ready deployment.'
}

$MigrationJob = $Migration.properties.outputs.migrationJobName.value
$MigrationExecution = az containerapp job start `
  --name $MigrationJob `
  --resource-group $ResourceGroup `
  --query name `
  --output tsv

az containerapp job execution show `
  --name $MigrationJob `
  --resource-group $ResourceGroup `
  --job-execution-name $MigrationExecution
```

Require a successful terminal execution. Retain migration logs showing the Drizzle and LangGraph schemas plus runtime
role bootstrap. Do not promote after a failed, missing, or still-running execution.

## 8. Populate runtime secrets

Through the approved secret-bootstrap workload, create enabled Key Vault versions for:

- `linear-api-key`
- `github-webhook-secret`
- `daytona-api-key`
- `nango-api-key`
- `nango-webhook-signing-key`
- `openrouter-api-key`
- `workspace-secret-key`
- `langsmith-api-key` only when LangSmith tracing is enabled

Record secret names, version identifiers, owners, and rotation dates without recording values. Verify the API and worker
identities can read only their required secrets and that unauthorized identities are denied.

## 9. Promote runtime processes

Repeat `validate` and `what-if` with the digest and `enableRuntimeProcesses=true`, then deploy:

```powershell
$ApplicationDeployment = "agentic-$Environment-application"
$Application = az deployment group create `
  --name $ApplicationDeployment `
  --resource-group $ResourceGroup `
  --template-file $TemplateFile `
  --parameters "@$ParametersFile" `
  --parameters linearTeamId=$LinearTeamId webOrigin=$WebOrigin imageDigest=$ImageDigest enableRuntimeProcesses=true `
  | ConvertFrom-Json

if ($Application.properties.outputs.deploymentMode.value -ne 'application') {
  throw 'Expected an application deployment.'
}

$ApiUrl = $Application.properties.outputs.apiUrl.value
Invoke-RestMethod "$ApiUrl/api/health"
```

Before production traffic, place an approved gateway or authentication boundary in front of non-webhook API routes.
Container Apps ingress is app-wide and does not by itself expose only `/api/webhooks/github`.

## 10. Acceptance and rollback evidence

Run and retain evidence for:

1. A signed synthetic webhook that is durably acknowledged without starting paid agent work.
2. One dependency-ready Linear assignment through exact-SHA review to merge or bounded abandonment.
3. API and worker restart recovery, stale webhook reconciliation, and retained Daytona workspace repair.
4. Ten concurrent fixture workflows while the global workspace cap remains ten.
5. PostgreSQL restore, Blob recovery, secret rotation, and denied cross-role access.
6. Dashboard, alert, cost, latency, queue-depth, and correlation-ID readback.

To stop runtime processes while preserving data and the migration job, redeploy the same digest with
`enableRuntimeProcesses=false`. To roll back application code, deploy a previously retained compatible digest only after
checking its schema compatibility. Database migrations are forward-fix unless a separately tested reversal exists.
