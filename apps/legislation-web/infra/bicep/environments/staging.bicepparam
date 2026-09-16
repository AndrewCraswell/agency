using '../main.bicep'

param environmentName = 'stg'
param location = 'westus2'
param owner = 'legislation-team'
param costCenter = 'engineering'
param image = 'legstgacr.azurecr.io/legislation@sha256:0000000000000000000000000000000000000000000000000000000000000000'
param authMode = 'workos'
param workosIssuer = 'https://replace.invalid/staging/issuer'
param workosJwksUrl = 'https://replace.invalid/staging/jwks'
param policyDatabaseUrl = readEnvironmentVariable('DATABASE_URL')
param openRouterApiKey = readEnvironmentVariable('OPENROUTER_API_KEY')
param langfusePublicKey = readEnvironmentVariable('LANGFUSE_PUBLIC_KEY')
param langfuseSecretKey = readEnvironmentVariable('LANGFUSE_SECRET_KEY')
