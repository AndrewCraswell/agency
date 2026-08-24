import { createLegislationApiClientFromEnvironment } from "../src/api/legislation-api.server"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const apiConnection = await getApiConnection()

  return (
    <main className="page-shell">
      <header className="site-header">
        <span className="wordmark">Legislative Intelligence</span>
        <span>Application foundation</span>
      </header>
      <section aria-labelledby="page-title" className="content-panel">
        <p className="eyebrow">Next.js application shell</p>
        <h1 id="page-title">The legislative research workspace is ready for its first feature.</h1>
        <p>
          This application is intentionally limited to its route, authentication, and API boundaries. Product workflows
          will be added only as their canonical API contracts become ready.
        </p>
        <dl className="api-status">
          <div>
            <dt>Canonical API</dt>
            <dd data-state={apiConnection.state}>{apiConnection.label}</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}

type ApiConnection = Readonly<{
  label: string
  state: "available" | "invalid" | "unavailable" | "unconfigured"
}>

async function getApiConnection(): Promise<ApiConnection> {
  let apiClient: ReturnType<typeof createLegislationApiClientFromEnvironment>
  try {
    apiClient = createLegislationApiClientFromEnvironment()
  } catch {
    return { label: "Configuration invalid", state: "invalid" }
  }

  if (apiClient === undefined) {
    return { label: "Not configured", state: "unconfigured" }
  }

  try {
    await apiClient.getReadiness()
    return { label: "Available", state: "available" }
  } catch {
    return { label: "Unavailable", state: "unavailable" }
  }
}
