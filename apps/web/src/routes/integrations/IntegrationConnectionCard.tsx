import {
  Badge,
  Body1,
  Body1Strong,
  Button,
  Card,
  Field,
  Input,
  Select,
  makeStyles,
  mergeClasses,
  tokens
} from "@fluentui/react-components"
import {
  CheckmarkCircleRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  DismissCircleRegular,
  SearchRegular,
  WarningRegular
} from "@fluentui/react-icons"
import { useDeferredValue, useId, useState } from "react"
import type { IntegrationConnection } from "@/services/api"
import { IntegrationConnectionActions } from "./IntegrationConnectionActions"

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, borderRadius: tokens.borderRadiusMedium },
  disconnected: { opacity: 0.72 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: tokens.spacingHorizontalL,
    flexWrap: "wrap"
  },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: tokens.spacingHorizontalL,
    margin: `${tokens.spacingVerticalL} 0`,
    padding: `${tokens.spacingVerticalM} 0`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  summaryItem: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  term: { color: tokens.colorNeutralForeground3 },
  value: { margin: 0 },
  scope: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  resources: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  resourceTools: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1fr) minmax(150px, 220px)",
    gap: tokens.spacingHorizontalM,
    "@media (max-width: 620px)": { gridTemplateColumns: "1fr" }
  },
  resourceList: { display: "flex", flexDirection: "column", gap: 0, margin: 0, padding: 0, listStyleType: "none" },
  resourceRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  empty: { color: tokens.colorNeutralForeground3 },
  error: { color: tokens.colorPaletteRedForeground1 }
})

function providerName(provider: IntegrationConnection["provider"]): string {
  return provider === "github" ? "GitHub" : "Linear"
}

function formatDate(value: string | null): string {
  return value === null
    ? "Not yet"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function statusBadge(connection: IntegrationConnection) {
  if (connection.status === "connected") {
    return (
      <Badge appearance="tint" color="success" icon={<CheckmarkCircleRegular />}>
        Connected
      </Badge>
    )
  }
  if (connection.status === "degraded") {
    return (
      <Badge appearance="tint" color="warning" icon={<WarningRegular />}>
        Needs attention
      </Badge>
    )
  }
  return (
    <Badge appearance="tint" color="danger" icon={<DismissCircleRegular />}>
      Disconnected
    </Badge>
  )
}

type Props = {
  connection: IntegrationConnection
  busy: boolean
  onDisconnect: (connection: IntegrationConnection) => void
  onReconnect: (connection: IntegrationConnection) => void
  onRefresh: (connectionId: string) => void
}

export function IntegrationConnectionCard({ connection, busy, onDisconnect, onReconnect, onRefresh }: Props) {
  const styles = useStyles()
  const resourcesId = useId()
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState("")
  const [freshness, setFreshness] = useState<"active" | "all" | "stale">("active")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const resources = connection.resources.filter((resource) => {
    const matchesQuery = resource.name.toLocaleLowerCase().includes(deferredQuery)
    if (freshness === "active") {
      return matchesQuery && !resource.stale
    }
    if (freshness === "stale") {
      return matchesQuery && resource.stale
    }
    return matchesQuery
  })
  const resourceLabel = connection.provider === "github" ? "repositories" : "teams"

  return (
    <Card className={mergeClasses(styles.card, connection.status === "disconnected" && styles.disconnected)}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <Body1Strong>{providerName(connection.provider)}</Body1Strong>
          <Body1>{connection.providerAccount ?? "Provider account unavailable"}</Body1>
          {statusBadge(connection)}
        </div>
        <IntegrationConnectionActions
          connection={connection}
          busy={busy}
          onDisconnect={onDisconnect}
          onReconnect={onReconnect}
          onRefresh={onRefresh}
        />
      </div>

      <dl className={styles.summary}>
        <div className={styles.summaryItem}>
          <dt className={styles.term}>Last successful sync</dt>
          <dd className={styles.value}>{formatDate(connection.lastSuccessfulSyncAt)}</dd>
        </div>
        <div className={styles.summaryItem}>
          <dt className={styles.term}>Resources</dt>
          <dd className={styles.value}>
            {connection.resourceCounts.active} current, {connection.resourceCounts.stale} stale
          </dd>
        </div>
        <div className={styles.summaryItem}>
          <dt className={styles.term}>Latest error</dt>
          <dd className={mergeClasses(styles.value, connection.latestError !== null && styles.error)}>
            {connection.latestError?.replaceAll("_", " ") ?? "None"}
          </dd>
        </div>
        <div className={styles.summaryItem}>
          <dt className={styles.term}>Capability scope</dt>
          <dd className={mergeClasses(styles.value, styles.scope)}>
            {connection.capabilities.length === 0
              ? "None"
              : connection.capabilities.map((capability) => (
                  <Badge key={capability} appearance="outline">
                    {capability.replaceAll(".", " ")}
                  </Badge>
                ))}
          </dd>
        </div>
      </dl>

      <div className={styles.resources}>
        <Button
          appearance="subtle"
          icon={expanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
          aria-expanded={expanded}
          aria-controls={resourcesId}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Hide" : "Show"} resources ({connection.resourceCounts.total})
        </Button>
        {expanded ? (
          <div id={resourcesId} className={styles.resources}>
            <div className={styles.resourceTools}>
              <Field label="Search resources">
                <Input contentBefore={<SearchRegular />} value={query} onChange={(_, data) => setQuery(data.value)} />
              </Field>
              <Field label="Resource state">
                <Select value={freshness} onChange={(_, data) => setFreshness(data.value as typeof freshness)}>
                  <option value="active">Current</option>
                  <option value="all">Current and stale</option>
                  <option value="stale">Stale</option>
                </Select>
              </Field>
            </div>
            {resources.length === 0 ? (
              <Body1 className={styles.empty}>No {resourceLabel} match this view.</Body1>
            ) : (
              <ul className={styles.resourceList} aria-label={`Discovered ${resourceLabel}`}>
                {resources.map((resource) => (
                  <li className={styles.resourceRow} key={`${resource.resourceType}:${resource.externalId}`}>
                    <span>{resource.name}</span>
                    {resource.stale ? (
                      <Badge appearance="outline" color="warning">
                        Stale
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
