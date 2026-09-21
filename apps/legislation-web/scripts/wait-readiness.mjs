import { pathToFileURL } from "node:url"

const fullCommitSha = /^[0-9a-f]{40}$/u

export function readinessConfig(environment) {
  const base = URL.parse(environment.LEGISLATION_READINESS_BASE_URL ?? "")
  if (
    !base ||
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("LEGISLATION_READINESS_BASE_URL must be a credential-free HTTPS origin")
  }
  const commitSha = (
    environment.LEGISLATION_DEPLOYMENT_COMMIT_SHA?.trim() ||
    environment.GITHUB_SHA?.trim() ||
    ""
  ).toLowerCase()
  if (!fullCommitSha.test(commitSha)) {
    throw new Error("LEGISLATION_DEPLOYMENT_COMMIT_SHA or GITHUB_SHA must be a full Git commit SHA")
  }
  return { base, commitSha }
}

export async function waitForReadiness(
  configuration,
  { fetch: fetch_ = fetch, attempts = 30, delayMs = 10_000, delay = setTimeout } = {}
) {
  let lastStatus = "no response"
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch_(new URL("/ready", configuration.base), {
        redirect: "error",
        signal: AbortSignal.timeout(30_000)
      })
      const body = await response.json()
      lastStatus = `${response.status} ${String(body.status)} ${String(body.commitSha)}`
      if (
        response.ok &&
        body.status === "ready" &&
        typeof body.commitSha === "string" &&
        body.commitSha.toLowerCase() === configuration.commitSha
      ) {
        return
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error)
    }
    if (attempt < attempts) {
      await new Promise((resolve) => delay(resolve, delayMs))
    }
  }
  throw new Error(`Readiness did not match the deployed commit: ${lastStatus}`)
}

async function main() {
  const configuration = readinessConfig(process.env)
  await waitForReadiness(configuration)
  process.stdout.write(`${JSON.stringify({ commitSha: configuration.commitSha, status: "ready" })}\n`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
