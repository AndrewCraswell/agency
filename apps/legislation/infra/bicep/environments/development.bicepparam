using '../main.bicep'

param environmentName = 'dev'
param location = 'westus2'
param owner = 'legislation-team'
param costCenter = 'engineering'
param image = 'legdevacr.azurecr.io/legislation:development'
param enableN8n = false
// Supply secure values listed in infra/bicep/README.md at deployment time.
