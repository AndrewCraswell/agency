"use client"

import { useClipboard } from "@mantine/hooks"
import { ArrowUpRight, Check, Circle, Copy, Minus } from "lucide-react"
import { useState } from "react"
import { Button } from "../../../components/ui/button"
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip"
import type { StagedReference } from "../../conversations/chatRequest"
import { researchToolLabels } from "../../conversations/researchTools"
import { HomepageMentions } from "./HomepageMentions"
import * as styles from "./HomepageConnections.css"
import * as landing from "./HomepageLanding.css"

const endpoint = "https://legislation-mcp-production.up.railway.app/mcp"
const httpServer = { type: "http", url: endpoint }
const clients = [
  {
    id: "vscode",
    name: "VS Code",
    location: ".vscode/mcp.json",
    code: JSON.stringify({ servers: { rostra: httpServer } }, null, 2),
    docs: "https://code.visualstudio.com/docs/copilot/customization/mcp-servers"
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    location: ".mcp.json",
    code: JSON.stringify({ mcpServers: { rostra: { ...httpServer, tools: ["*"] } } }, null, 2),
    docs: "https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers"
  },
  {
    id: "cursor",
    name: "Cursor",
    location: ".cursor/mcp.json",
    code: JSON.stringify({ mcpServers: { rostra: { url: endpoint } } }, null, 2),
    docs: "https://cursor.com/docs/context/mcp"
  },
  {
    id: "claude-code",
    name: "Claude Code",
    location: "Terminal",
    code: `claude mcp add --transport http rostra ${endpoint}`,
    docs: "https://code.claude.com/docs/en/mcp"
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    location: "Custom connector URL",
    code: endpoint,
    docs: "https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp"
  }
]
const categories = ["Bills", "Amendments", "Votes", "Committees", "People", "Meetings", "Documents", "Rules", "Funding"]
const sources = [
  {
    name: "Open States",
    href: "https://openstates.org",
    description: "50 states, DC and Puerto Rico",
    categories: ["Bills", "Votes", "Committees", "People", "Meetings", "Documents"],
    status: "Varies by legislature"
  },
  {
    name: "Congress.gov",
    href: "https://www.congress.gov",
    description: "Federal legislation and congressional records",
    categories: ["Bills", "Amendments", "Votes", "Committees", "People", "Meetings", "Documents"],
    status: "Congressional records"
  },
  {
    name: "GovInfo.gov",
    href: "https://www.govinfo.gov",
    description: "Federal publications and committee directories",
    categories: ["Committees", "Documents", "Rules"],
    status: "Published collections"
  },
  {
    name: "Regulations.gov",
    href: "https://www.regulations.gov",
    description: "Federal rulemaking documents and comments",
    categories: ["Documents", "Rules"],
    status: "Selected dockets"
  },
  {
    name: "FEC.gov",
    href: "https://www.fec.gov",
    description: "Campaign and committee finance filings",
    categories: ["Documents", "Funding"],
    status: "Planned"
  }
]

function McpConnection() {
  const [selected, setSelected] = useState(() => clients.find((client) => client.id === "vscode"))
  const clipboard = useClipboard({ timeout: 2000 })
  if (!selected) {
    return null
  }
  return (
    <section id="connect" aria-labelledby="connect-title" className={styles.section}>
      <div className={styles.sectionTop}>
        <header className={styles.heading}>
          <p className={landing.eyebrow}>MCP</p>
          <h2 id="connect-title" className={landing.sectionTitle}>
            Connect your own client
          </h2>
          <p className={styles.description}>
            Access Rostra&apos;s read-only research tools from your preferred client. Your client handles sign-in and
            access to the records.
          </p>
        </header>
        <div className={styles.server}>
          <span className={styles.caption}>Server</span>
          <span>legislation 0.1.0</span>
        </div>
      </div>
      <div className={styles.split}>
        <div className={styles.clientColumn}>
          <RadioGroup
            className={styles.clients}
            value={selected.id}
            orientation="horizontal"
            aria-label="MCP client"
            onValueChange={(id) => {
              const client = clients.find((item) => item.id === id)
              if (client) {
                setSelected(client)
                clipboard.reset()
              }
            }}
          >
            {clients.map((client) => (
              <label key={client.id} className={styles.client}>
                <RadioGroupItem value={client.id} className="sr-only" />
                {client.name}
              </label>
            ))}
          </RadioGroup>
          <div className={styles.codePanel}>
            <div className={styles.codeHeader}>
              <span>{selected.location}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Copy MCP configuration"
                    className={styles.copyButton}
                    onClick={() => clipboard.copy(selected.code)}
                  >
                    {clipboard.copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy configuration</TooltipContent>
              </Tooltip>
            </div>
            <pre className={styles.code} aria-label={`${selected.name} configuration`}>
              <code>{selected.code}</code>
            </pre>
          </div>
          <div className={styles.configFooter}>
            <a className={styles.link} href={selected.docs} target="_blank" rel="noopener noreferrer">
              {selected.name} setup
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <output aria-live="polite">{clipboard.copied ? "Configuration copied" : ""}</output>
          </div>
          {clipboard.error && (
            <p role="alert" className={styles.error}>
              Could not copy. Check clipboard permissions and try again.
            </p>
          )}
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Transport</dt>
            <dd>Streamable HTTP, stateless</dd>
          </div>
          <div>
            <dt>Authentication</dt>
            <dd>OAuth discovery from the resource metadata. An authorized account is required.</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>Read-only tools. Legal text access depends on your organization&apos;s permissions.</dd>
          </div>
          <div>
            <dt>Request limits</dt>
            <dd>Up to 100 results per page. Tool calls have a 30-second deadline.</dd>
          </div>
        </dl>
      </div>
      <div className={styles.tools}>
        <h3 className={styles.caption}>Research tools used in chat</h3>
        <ul className={styles.toolList}>
          {Object.entries(researchToolLabels).map(([name, label]) => (
            <li key={name}>
              <code title={label} className={styles.tool}>
                {name}
              </code>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function CoverageMark({ isSupported, isPlanned }: Readonly<{ isSupported: boolean; isPlanned: boolean }>) {
  if (!isSupported) {
    return (
      <>
        <Minus size={12} className={styles.minus} aria-hidden="true" />
        <span className="sr-only">Not supplied</span>
      </>
    )
  }
  if (isPlanned) {
    return (
      <>
        <Circle size={13} className={styles.minus} aria-hidden="true" />
        <span className="sr-only">Planned</span>
      </>
    )
  }
  return (
    <>
      <Check size={13} className={styles.check} aria-hidden="true" />
      <span className="sr-only">Supported</span>
    </>
  )
}

function Coverage() {
  return (
    <section id="coverage" aria-labelledby="coverage-title" className={styles.section}>
      <header className={styles.heading}>
        <p className={landing.eyebrow}>Coverage</p>
        <h2 id="coverage-title" className={landing.sectionTitle}>
          What the sources cover
        </h2>
        <p className={styles.description}>
          State legislation, congressional records and federal rulemaking. Availability varies by source, jurisdiction
          and session.
        </p>
      </header>
      <Table
        className={styles.coverageTable}
        containerProps={{ tabIndex: 0, role: "region", "aria-label": "Source coverage", className: styles.tableRegion }}
      >
        <caption className="sr-only">
          Source contributions. A check indicates supported record types, not complete or current coverage. A circle
          indicates planned coverage.
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className={styles.sourceHead}>
              Source
            </TableHead>
            {categories.map((category) => (
              <TableHead key={category} scope="col" className={styles.categoryHead}>
                {category}
              </TableHead>
            ))}
            <TableHead scope="col" className={styles.statusHead}>
              Scope
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.name}>
              <TableCell className={styles.sourceCell}>
                <a href={source.href} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                  {source.name}
                  <ArrowUpRight size={12} aria-hidden="true" />
                </a>
                <span className={styles.sourceDescription}>{source.description}</span>
              </TableCell>
              {categories.map((category) => (
                <TableCell className={styles.coverageCell} key={category}>
                  <CoverageMark
                    isSupported={source.categories.includes(category)}
                    isPlanned={source.status === "Planned"}
                  />
                </TableCell>
              ))}
              <TableCell className={styles.statusCell}>{source.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <dl className={styles.summary}>
        <div>
          <dt>Jurisdictions</dt>
          <dd>50 states, DC and Puerto Rico</dd>
        </div>
        <div>
          <dt>Federal</dt>
          <dd>Congress and agency rulemaking</dd>
        </div>
        <div>
          <dt>Source records</dt>
          <dd>Versions, passages and provenance</dd>
        </div>
        <div>
          <dt>Availability</dt>
          <dd>Varies by source and session</dd>
        </div>
      </dl>
    </section>
  )
}

export function HomepageConnections({
  isAvailable,
  onMention
}: Readonly<{
  isAvailable: boolean
  onMention: (references: StagedReference[]) => void
}>) {
  return (
    <>
      <div className={styles.band}>
        <div className={styles.content}>
          <section aria-labelledby="mentions-title" className={styles.section}>
            <header className={styles.heading}>
              <p className={landing.eyebrow}>Mentions</p>
              <h2 id="mentions-title" className={landing.sectionTitle}>
                Point at a representative or a committee
              </h2>
              <p className={styles.description}>
                Give your question a specific person or committee to refer to, with their record attached.
              </p>
            </header>
            <div className={styles.split}>
              {isAvailable ? (
                <HomepageMentions onSelect={onMention} />
              ) : (
                <p className={styles.unavailable}>
                  People and committee search is unavailable while research is disconnected.
                </p>
              )}
              <dl className={styles.facts}>
                <div>
                  <dt>One record, not a name</dt>
                  <dd>People who share a surname stay distinct. Every selection identifies a specific record.</dd>
                </div>
                <div>
                  <dt>People and committees</dt>
                  <dd>Find representatives, standing committees and subcommittees in the published directory.</dd>
                </div>
                <div>
                  <dt>Nothing is notified</dt>
                  <dd>A mention adds context to your question. Nobody is emailed, invited or granted access.</dd>
                </div>
              </dl>
            </div>
          </section>
          <McpConnection />
          <Coverage />
        </div>
      </div>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>Rostra is a research tool, not legal advice.</p>
          <p>&copy; {new Date().getFullYear()} Rostra</p>
        </div>
      </footer>
    </>
  )
}
