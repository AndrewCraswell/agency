import { getNextLegislationReadiness } from "../src/server/next/runtime"

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
  state: "available" | "unavailable"
}>

async function getApiConnection(): Promise<ApiConnection> {
  const readiness = getNextLegislationReadiness()

  try {
    return (await readiness.check())
      ? { label: "Available", state: "available" }
      : { label: "Unavailable", state: "unavailable" }
  } catch {
    return { label: "Unavailable", state: "unavailable" }
  }
}
