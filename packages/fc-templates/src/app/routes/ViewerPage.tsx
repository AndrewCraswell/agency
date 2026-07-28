import { getRouteApi, Link } from "@tanstack/react-router"
import { rawUrl } from "../api.ts"
import { AutoHeightFrame } from "../components/AutoHeightFrame.tsx"
import { ThemeToggle } from "../components/ThemeToggle.tsx"

const route = getRouteApi("/render/$templateId/$variationId")

/* Stand-in identities for the email viewer. A real send substitutes the shop and the customer. */
const FROM_ADDRESS = "support@store.com"
const TO_ADDRESS = "customer@gmail.com"

export function ViewerPage() {
  const preview = route.useLoaderData()
  const raw = rawUrl(preview.id, preview.variation.id)

  return (
    <div className="viewer">
      <header>
        <div className="lead">
          <Link className="back" to="/" aria-label="All templates" title="All templates">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M13 8H3m4-4-4 4 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div>
            <div className="group">{preview.group}</div>
            <p className="title">{preview.name}</p>
          </div>
        </div>
        <div className="actions">
          <a className="btn" href={raw} target="_blank" rel="noopener noreferrer">
            Open raw
          </a>
          <a className="btn" href={preview.adminUrl} target="_blank" rel="noopener noreferrer">
            Shopify admin
          </a>
          <ThemeToggle />
        </div>
      </header>

      {preview.variations.length > 1 ? (
        <div className="subbar">
          <span className="subbar__label">Variations</span>
          {preview.variations.map((variation) => (
            <Link
              key={variation.id}
              className="tab"
              to="/render/$templateId/$variationId"
              params={{ templateId: preview.id, variationId: variation.id }}
              aria-current={variation.id === preview.variation.id ? "page" : undefined}
            >
              {variation.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="stage">
        {preview.type === "email" ? (
          <div className="mail">
            <div className="mail__head">
              <p className="mail__subject">{preview.subject}</p>
              <dl className="mail__fields">
                <dt>From</dt>
                <dd>{FROM_ADDRESS}</dd>
                <dt>To</dt>
                <dd>{TO_ADDRESS}</dd>
              </dl>
            </div>
            <div className="mail__body">
              <AutoHeightFrame key={raw} className="mail__frame" src={raw} title={preview.name} />
            </div>
          </div>
        ) : (
          <iframe className="sheet" src={raw} title={preview.name} />
        )}
      </div>
    </div>
  )
}
