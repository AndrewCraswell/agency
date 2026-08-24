import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url))

function applicationFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
}

describe("Railway deployment contract", () => {
  it("builds legislation from the workspace and emits a pruned non-root runtime", () => {
    const dockerfile = applicationFile("Dockerfile")
    const runtime = dockerfile.slice(dockerfile.indexOf(" AS runtime"))

    expect(dockerfile).toContain("FROM node:${NODE_VERSION}-bookworm-slim AS build")
    expect(dockerfile).toContain("COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./")
    expect(dockerfile).toContain("COPY packages ./packages")
    expect(dockerfile).toContain("COPY apps/legislation ./apps/legislation")
    expect(dockerfile).toContain("COPY apps/legislation/pnpm-workspace.railway.yaml ./pnpm-workspace.yaml")
    expect(dockerfile).toContain(
      "pnpm install --frozen-lockfile --trust-lockfile --update-checksums --filter legislation..."
    )
    expect(dockerfile).toContain("pnpm --filter legislation build")
    expect(dockerfile).not.toContain("pnpm --filter ./...")
    expect(dockerfile).toContain("pnpm --filter legislation deploy --prod --force /opt/legislation")
    expect(runtime).toContain("COPY --from=build")
    expect(runtime).toContain("ENV LEGISLATION_HOST=0.0.0.0")
    expect(runtime).toContain("USER 10001")
    expect(runtime).toContain('CMD ["node", "dist/cli/main.js", "serve"]')

    const railwayWorkspace = applicationFile("pnpm-workspace.railway.yaml")
    expect(railwayWorkspace).toContain('  - "apps/legislation"')
    expect(railwayWorkspace).toContain('  - "packages/oxlint-config"')
    expect(railwayWorkspace).toContain('  - "packages/typescript-config"')
    expect(railwayWorkspace).not.toContain('"apps/*"')
    expect(railwayWorkspace).not.toContain("packageExtensions")
    expect(railwayWorkspace).toContain("nodeLinker: isolated")
    expect(railwayWorkspace).toContain("injectWorkspacePackages: true")
    expect(runtime).not.toMatch(/db:migrate|migrateDatabase/)
  })

  it("keeps the full repository as Railway's build context", () => {
    const railway = JSON.parse(applicationFile("railway.json"))
    const packageManifest = JSON.parse(applicationFile("package.json"))
    const dockerIgnore = applicationFile("Dockerfile.dockerignore")

    expect(railway).toMatchObject({
      build: {
        builder: "DOCKERFILE",
        dockerfilePath: "apps/legislation/Dockerfile"
      },
      deploy: {
        healthcheckPath: "/ready",
        restartPolicyType: "ON_FAILURE"
      }
    })
    expect(railway.build).not.toHaveProperty("rootDirectory")
    expect(packageManifest.scripts["docker:build"]).toBe("docker build --file Dockerfile --tag legislation:local ../..")
    expect(packageManifest.scripts).not.toHaveProperty("container:prepare")
    expect(dockerIgnore).toContain("**/.env")
    expect(dockerIgnore).toContain("**/node_modules")
    expect(dockerIgnore).toContain("!packages/**")
    expect(readFileSync(`${repositoryRoot}pnpm-workspace.yaml`, "utf8")).toContain('"apps/*"')
    expect(applicationFile("README.md")).toContain("Config File Path to `/apps/legislation/railway.json`")
    expect(applicationFile("docs/development.md")).toContain(
      "explicitly set Config File Path to `/apps/legislation/railway.json`"
    )
  })

  it("smokes public health and readiness plus a bearer-authenticated API page", () => {
    const smoke = applicationFile("scripts/smoke-deployment.mjs")

    expect(smoke).toContain('new URL("/health", root)')
    expect(smoke).toContain('new URL("/ready", root)')
    expect(smoke).toContain('new URL("/api/jurisdictions?limit=1", root)')
    expect(smoke).toContain("LEGISLATION_SMOKE_TOKEN is required")
    expect(smoke).toContain("authorization: `Bearer ${token}`")
    expect(smoke).toContain('api.headers.get("x-correlation-id")')
    expect(smoke).toContain("apiBody.meta?.correlationId !== apiCorrelationId")
    expect(smoke).toContain('typeof apiItem.canonicalUrl === "string"')
    expect(smoke).toContain("apiItem.sources.length === 0")
    expect(smoke).not.toMatch(/console\.(?:debug|info|log)\([^\n]*token/)
    expect(smoke).not.toMatch(/JSON\.stringify\([^\n]*token/)
  })
})
