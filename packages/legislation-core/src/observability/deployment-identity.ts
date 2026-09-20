const fullGitCommitSha = /^[0-9a-f]{40}$/iu

export function deploymentCommitSha(
  environment: Readonly<Record<string, string | undefined>>,
  variableName = "RAILWAY_GIT_COMMIT_SHA"
): string | undefined {
  const value = environment[variableName]?.trim()
  if (!value) return undefined
  if (!fullGitCommitSha.test(value)) {
    throw new Error(`${variableName} must be a full 40-character Git commit SHA`)
  }
  return value.toLowerCase()
}

export function deploymentSentryRelease(
  environment: Readonly<Record<string, string | undefined>>,
  variableName = "RAILWAY_GIT_COMMIT_SHA"
): string | undefined {
  return deploymentCommitSha(environment, variableName) ?? (environment.SENTRY_RELEASE?.trim() || undefined)
}
