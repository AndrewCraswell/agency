import { getRouteApi, Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import type { TemplateSummary } from "../../preview/contract.ts"
import { ThemeToggle } from "../components/ThemeToggle.tsx"

const route = getRouteApi("/")

const TYPE_LABELS: Record<TemplateSummary["type"], string> = {
  printout: "Printout",
  email: "Email"
}

type Section = {
  name: string
  entries: TemplateSummary[]
}

/** Groups in registry order, so the index reads the same way the registry does. */
function toSections(list: TemplateSummary[]): Section[] {
  const sections: Section[] = []
  for (const template of list) {
    let section = sections.find((candidate) => candidate.name === template.group)
    if (!section) {
      section = { name: template.group, entries: [] }
      sections.push(section)
    }
    section.entries.push(template)
  }
  return sections
}

export function IndexPage() {
  const templates = route.useLoaderData()
  const [query, setQuery] = useState("")
  const filterRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const input = filterRef.current
      if (event.key === "/" && input && document.activeElement !== input) {
        event.preventDefault()
        input.focus()
        input.select()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const needle = query.trim().toLowerCase()
  const matches = needle ? templates.filter((template) => template.search.includes(needle)) : templates
  const sections = toSections(matches)

  return (
    <div className="index">
      <div className="topbar">
        <div className="wrap topbar__inner">
          <div>
            <h1>Fencing Club templates</h1>
            <p className="lede">
              Local Liquid renders from the checked-in variables. Reload a preview to pick up edits.
            </p>
          </div>
          <div className="tools">
            <input
              ref={filterRef}
              className="search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  setQuery("")
                }
              }}
              placeholder="Filter templates&hellip;"
              aria-label="Filter templates"
              autoComplete="off"
            />
            <output className="result-count">
              {needle ? `${matches.length} of ${templates.length} templates` : `${templates.length} templates`}
            </output>
            <ThemeToggle />
          </div>
        </div>
      </div>
      <main className="wrap">
        {sections.map((section) => (
          <section className="section" key={section.name}>
            <h2>
              {section.name} <span className="count">{section.entries.length}</span>
            </h2>
            <ul className="grid">
              {section.entries.map((template) => (
                <li className="card" key={template.id}>
                  <Link
                    className="card__link"
                    to="/render/$templateId/$variationId"
                    params={{ templateId: template.id, variationId: template.variations[0].id }}
                  >
                    <span className={`card__kind card__kind--${template.type}`}>{TYPE_LABELS[template.type]}</span>
                    <span className="card__title">{template.name}</span>
                    {template.variations.length > 1 ? (
                      <span className="card__note">{template.variations.length} variations</span>
                    ) : null}
                    <span className="card__id">{template.id}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {matches.length === 0 ? <p className="empty">No templates match that filter.</p> : null}
      </main>
    </div>
  )
}
