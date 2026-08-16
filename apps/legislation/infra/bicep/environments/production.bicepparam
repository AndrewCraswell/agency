using '../main.bicep'

param environmentName = 'prd'
param location = 'westus2'
param owner = 'legislation-team'
param costCenter = 'engineering'
param image = 'legprodacr.azurecr.io/legislation@sha256:0000000000000000000000000000000000000000000000000000000000000000'
param n8nImage = 'docker.io/n8nio/n8n@sha256:0000000000000000000000000000000000000000000000000000000000000000'
param enableN8n = true
param authMode = 'workos'
param workosIssuer = 'https://replace.invalid/production/issuer'
param workosAudience = 'https://replace.invalid/production/mcp'
param workosJwksUrl = 'https://replace.invalid/production/jwks'
