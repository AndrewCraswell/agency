import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: HomePage })

const coverageAreas = [
  { label: "Legislation", status: "Canonical" },
  { label: "Votes", status: "Member positions" },
  { label: "Documents", status: "Searchable" },
  { label: "Amendments", status: "Connected" },
  { label: "Events", status: "Scheduled" },
  { label: "Materials", status: "Source-linked" }
] as const

function HomePage() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top">
          <span aria-hidden="true" className="wordmark-mark">
            LI
          </span>
          <span>Legislative Intelligence</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#coverage">Coverage</a>
          <a href="#platform">Platform</a>
          <a href="#roadmap">Roadmap</a>
        </nav>
        <span className="build-label">Product foundation</span>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Public policy, connected</p>
            <h1>Follow the record from proposal to decision.</h1>
            <p className="hero-summary">
              One research surface for bills, amendments, votes, meetings, official documents, and the people and
              organizations behind them.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#platform">
                Explore the platform
              </a>
              <a className="secondary-action" href="#roadmap">
                Review the build plan
              </a>
            </div>
          </div>

          <div aria-label="Example legislative research path" className="research-card">
            <div className="research-card-header">
              <span>Research workspace</span>
              <span className="status-pill">Foundation</span>
            </div>
            <p className="research-question">Which energy bills changed after committee review?</p>
            <div className="research-result">
              <span className="result-rank">01</span>
              <div>
                <strong>Bill and document discovery</strong>
                <p>Hybrid retrieval maps every passage back to its bill, version, source, and related activity.</p>
              </div>
            </div>
            <div className="research-result">
              <span className="result-rank">02</span>
              <div>
                <strong>Version evidence</strong>
                <p>Ordered diffs distinguish added, removed, and unchanged legislative language.</p>
              </div>
            </div>
            <div className="research-result">
              <span className="result-rank">03</span>
              <div>
                <strong>Decision trail</strong>
                <p>Actions, roll calls, meetings, and official identities remain connected to the record.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="coverage-strip" id="coverage">
          <p>Canonical coverage across the legislative record</p>
          <div>
            {coverageAreas.map(({ label, status }) => (
              <span className="coverage-item" key={label}>
                <strong>{label}</strong>
                <span>{status}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="platform-section" id="platform">
          <div className="section-heading">
            <p className="eyebrow">A shared intelligence layer</p>
            <h2>One source of truth for people and machines.</h2>
            <p>
              The web application, public HTTP API, and MCP tools will use the same canonical services. Results stay
              consistent without duplicating query logic.
            </p>
          </div>

          <div className="capability-grid">
            <article>
              <span className="capability-number">01</span>
              <h3>Discover</h3>
              <p>Search legislation and source documents with precise filters or natural language.</p>
            </article>
            <article>
              <span className="capability-number">02</span>
              <h3>Understand</h3>
              <p>Trace amendments, version changes, meetings, votes, sponsors, and official relationships.</p>
            </article>
            <article>
              <span className="capability-number">03</span>
              <h3>Monitor</h3>
              <p>Subscribe to bills, officials, organizations, or saved searches and receive auditable updates.</p>
            </article>
          </div>
        </section>

        <section className="roadmap-section" id="roadmap">
          <div className="section-heading compact">
            <p className="eyebrow">Product foundation</p>
            <h2>The record becomes a connected research experience.</h2>
          </div>
          <div className="operation-columns">
            <RoadmapList
              heading="Research surfaces"
              items={["Bill and amendment discovery", "Vote and timeline review", "Document search and comparison"]}
            />
            <RoadmapList
              heading="Application workflows"
              items={["Saved research and subscriptions", "Official and committee activity", "Source-grounded answers"]}
            />
          </div>
        </section>
      </main>

      <footer>
        <span>Legislative Intelligence</span>
        <span>Official sources remain attached to every canonical record.</span>
      </footer>
    </div>
  )
}

type RoadmapListProps = Readonly<{
  heading: string
  items: readonly string[]
}>

function RoadmapList({ heading, items }: RoadmapListProps) {
  return (
    <div className="operation-list">
      <h3>{heading}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={item}>
            <span className="method-label">{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
