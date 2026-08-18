using '../main.bicep'

param environmentName = 'dev'
param location = 'westus2'
param owner = 'legislation-team'
param costCenter = 'engineering'
param image = 'legdevacr.azurecr.io/legislation:development'
param authMode = 'workos'
param workosIssuer = 'https://scientific-courage-54-staging.authkit.app'
param workosJwksUrl = 'https://scientific-courage-54-staging.authkit.app/oauth2/jwks'
param policyDatabaseUrl = readEnvironmentVariable('DATABASE_URL')
param openRouterApiKey = readEnvironmentVariable('OPENROUTER_API_KEY')
param langfusePublicKey = readEnvironmentVariable('LANGFUSE_PUBLIC_KEY')
param langfuseSecretKey = readEnvironmentVariable('LANGFUSE_SECRET_KEY')
