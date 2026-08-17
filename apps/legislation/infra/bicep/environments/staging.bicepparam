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
param workosJwksUrl = 'https://replace.invalid/staging/jwks'
param policyDatabaseUrl = readEnvironmentVariable('DATABASE_URL')
param n8nDatabaseHost = readEnvironmentVariable('LEGISLATION_N8N_DATABASE_HOST')
param n8nDatabasePort = readEnvironmentVariable('LEGISLATION_N8N_DATABASE_PORT')
param n8nDatabaseName = readEnvironmentVariable('LEGISLATION_N8N_DATABASE_NAME')
param n8nDatabaseUser = readEnvironmentVariable('LEGISLATION_N8N_DATABASE_USER')
param n8nDatabasePassword = readEnvironmentVariable('LEGISLATION_N8N_DATABASE_PASSWORD')
param n8nEncryptionKey = readEnvironmentVariable('LEGISLATION_N8N_ENCRYPTION_KEY')
param congressApiKey = readEnvironmentVariable('CONGRESS_API_KEY')
param openStatesApiKey = readEnvironmentVariable('OPENSTATE_API_KEY')
param openRouterApiKey = readEnvironmentVariable('OPENROUTER_API_KEY')
param langfusePublicKey = readEnvironmentVariable('LANGFUSE_PUBLIC_KEY')
param langfuseSecretKey = readEnvironmentVariable('LANGFUSE_SECRET_KEY')
