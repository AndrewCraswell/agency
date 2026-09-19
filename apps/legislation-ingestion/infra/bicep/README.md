# Open States scraper runtime

The self-hosted Open States scraper is an extraction-only Azure Container Apps event job. Trigger.dev enqueues a strict
frozen-batch request; the job reads one Azure Queue message, runs the pinned GPL scraper distribution without database
credentials, archives immutable evidence to `state-sources`, deletes the message and finally writes a settlement marker.
Trigger promotes only a matching settled archive.

The existing worker identity requires `AcrPull` on the registry, `Storage Blob Data Contributor` on the storage account,
`Storage Queue Data Reader` for the scaler and `Storage Queue Data Message Processor` for the worker. Trigger's
production service principal requires `Storage Queue Data Contributor`. Keep these role assignments separate from
application secrets and never put a database URL in the scraper job.

Deploy using an immutable image digest:

```powershell
az deployment group create --resource-group legislation-dev --template-file infra/bicep/openstates-scraper.bicep `
  --parameters environmentName=leg-dev-cae registryName=acrr2jsh7uot4legdev `
  identityName=leg-dev-openstates-scraper-id storageAccountName=str2jsh7uot474legdev `
  image=acrr2jsh7uot4legdev.azurecr.io/openstates-scraper@sha256:<digest>
```

The job starts at zero executions and scales to `maxExecutions` (default three, allowed one to three).
Per-jurisdiction/domain database ownership remains the authoritative non-overlap control; queue scaling is only a
capacity limit for this queue. Separate jobs do not establish a shared global publisher limit.

For an isolated candidate, reuse this template with a distinct `jobName` and `dispatchQueueName`, plus
`maxExecutions=1`. Create the queue first and inspect a deployment what-if before applying. Verify the existing job's
image and queue remain unchanged after deployment. The candidate must use the same pinned build, retained-source
validation and canonical-promotion boundaries; a successful extraction is not permission to activate regular syncing.

Hosted bill and meeting tasks share one queue resolver. Without `OPENSTATES_SCRAPER_QUEUE_ROUTES`, they use
`OPENSTATES_SCRAPER_QUEUE`. To isolate a candidate while retaining existing states, set an explicit JSON routing table,
for example `{"nc":"openstates-scraper-dispatch","ak":"openstates-scraper-dispatch","wa":"openstates-scraper-canary"}`.
When the table exists, every dispatched jurisdiction must have a route; missing or malformed routes fail before dispatch
instead of falling back to a potentially incompatible worker. Queue selection does not replace build-fingerprint
validation or the separate activation gate. Deploy task code before configuring this table.
