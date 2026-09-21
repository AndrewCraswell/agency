import { appendFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

const fullCommitSha = /^[0-9a-f]{40}$/u

function required(environment, name) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function enabled(environment, name) {
  return environment[name] === "true"
}

export function productionReleaseConfig(environment) {
  const commitSha = required(environment, "PRODUCTION_COMMIT_SHA").toLowerCase()
  const repository = required(environment, "GITHUB_REPOSITORY")
  if (!fullCommitSha.test(commitSha)) throw new Error("PRODUCTION_COMMIT_SHA must be a full Git commit SHA")
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new Error("GITHUB_REPOSITORY is invalid")
  }
  const deployWeb = enabled(environment, "DEPLOY_WEB")
  const deployMcp = enabled(environment, "DEPLOY_MCP")
  const migrateDatabase = enabled(environment, "MIGRATE_DATABASE")
  if (!deployWeb && !deployMcp && !migrateDatabase) {
    throw new Error("At least one production release operation must be selected")
  }
  return {
    commitSha,
    deployMcp,
    deployWeb,
    migrateDatabase,
    repository,
    token: required(environment, "GITHUB_TOKEN")
  }
}

async function githubJson(configuration, path, fetch_) {
  const response = await fetch_(new URL(path, "https://api.github.com"), {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${configuration.token}`,
      "user-agent": "legislation-production-release"
    },
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`GitHub staging evidence request failed with status ${response.status}`)
  return await response.json()
}

function hasSuccessfulStep(jobs, name) {
  return jobs.some((job) => job.steps?.some((step) => step.name === name && step.conclusion === "success"))
}

export async function findStagingAcceptance(configuration, fetch_ = fetch) {
  const runs = await githubJson(
    configuration,
    `/repos/${configuration.repository}/actions/workflows/legislation-staging-deployment.yml/runs?head_sha=${configuration.commitSha}&status=success&per_page=30`,
    fetch_
  )
  if (!Array.isArray(runs.workflow_runs)) throw new Error("GitHub returned invalid staging workflow evidence")
  for (const run of runs.workflow_runs) {
    const jobsResponse = await githubJson(
      configuration,
      `/repos/${configuration.repository}/actions/runs/${run.id}/jobs?per_page=100`,
      fetch_
    )
    if (!Array.isArray(jobsResponse.jobs)) throw new Error("GitHub returned invalid staging job evidence")
    const webAccepted =
      !configuration.deployWeb ||
      (hasSuccessfulStep(jobsResponse.jobs, "Deploy staging legislation-web") &&
        hasSuccessfulStep(jobsResponse.jobs, "Verify staging legislation-web in a browser"))
    const mcpAccepted =
      !configuration.deployMcp ||
      (hasSuccessfulStep(jobsResponse.jobs, "Deploy staging legislation-mcp") &&
        hasSuccessfulStep(jobsResponse.jobs, "Verify staging legislation-mcp") &&
        hasSuccessfulStep(jobsResponse.jobs, "Verify controlled staging Sentry canary"))
    if (webAccepted && mcpAccepted) {
      return { runId: run.id, url: run.html_url }
    }
  }
  throw new Error(`No successful staging acceptance run covers production commit ${configuration.commitSha}`)
}

async function main() {
  const configuration = productionReleaseConfig(process.env)
  const acceptance = await findStagingAcceptance(configuration)
  const evidence = {
    commitSha: configuration.commitSha,
    deployMcp: configuration.deployMcp,
    deployWeb: configuration.deployWeb,
    migrateDatabase: configuration.migrateDatabase,
    stagingRunId: acceptance.runId,
    stagingRunUrl: acceptance.url
  }
  process.stdout.write(`${JSON.stringify(evidence)}\n`)
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `staging_run_id=${acceptance.runId}\nstaging_run_url=${acceptance.url}\n`
    )
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Production release approval\n\n- Commit: \`${configuration.commitSha}\`\n- Deploy W: ${configuration.deployWeb}\n- Deploy M: ${configuration.deployMcp}\n- Run migration: ${configuration.migrateDatabase}\n- Staging acceptance: [run ${acceptance.runId}](${acceptance.url})\n`
    )
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
