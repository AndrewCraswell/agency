using '../main.bicep'

param environmentName = 'stg'
param location = 'westus2'
param owner = 'legislation-team'
param costCenter = 'engineering'
param image = 'legstgacr.azurecr.io/legislation@sha256:0000000000000000000000000000000000000000000000000000000000000000'
param n8nImage = 'docker.io/n8nio/n8n@sha256:0000000000000000000000000000000000000000000000000000000000000000'
param enableN8n = true
param authMode = 'workos'
param workosIssuer = 'https://replace.invalid/staging/issuer'
param workosAudience = 'https://replace.invalid/staging/mcp'
param workosJwksUrl = 'https://replace.invalid/staging/jwks'
