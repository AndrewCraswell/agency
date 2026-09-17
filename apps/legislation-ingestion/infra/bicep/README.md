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

The job starts at zero executions and scales to at most three. Per-jurisdiction/domain database ownership remains the
authoritative non-overlap control; queue scaling is only a global capacity limit.
