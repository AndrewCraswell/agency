import type { UIMessage } from "ai"
import { CircleCheck, CircleAlert, Circle, ChevronDown } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../components/ui/collapsible"
import { Spinner } from "../../../components/ui/spinner"
import { entityPageSchema } from "../entityResults"
import { researchToolLabels } from "../researchTools"
import { sessionLabel, sessionLabelsInText } from "../sessionLabels"
import * as styles from "./ConversationResponse.css"

type ResearchActivityProps = Readonly<{
  part: Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>
  isRunning: boolean
  previousParts?: UIMessage["parts"]
}>

const activityInputSchema = z
  .object({
    limit: z.number().int().positive().nullish(),
    query: z.string().max(500).nullable().optional(),
    id: z.string().max(500).nullable().optional(),
    billId: z.string().max(500).nullish(),
    ids: z.array(z.string().max(500)).nullish(),
    documentIds: z.array(z.string().max(500)).nullish(),
    jurisdictionId: z.string().nullish(),
    organizationId: z.string().nullish(),
    personId: z.string().nullish(),
    recordId: z.string().nullish(),
    recordType: z.string().nullish(),
    classification: z.string().nullish(),
    from: z.string().nullish(),
    to: z.string().nullish(),
    observedFrom: z.string().nullish(),
    observedTo: z.string().nullish(),
    sessionIds: z.array(z.string().max(500)).nullish()
  })
  .extend({
    billIds: z.array(z.string()).nullish(),
    jurisdictionIds: z.array(z.string()).nullish(),
    sponsorIds: z.array(z.string()).nullish(),
    sponsorPersonId: z.string().nullish(),
    parentOrganizationId: z.string().nullish(),
    amendmentId: z.string().nullish(),
    eventId: z.string().nullish(),
    documentId: z.string().nullish(),
    versionCode: z.string().nullish(),
    classifications: z.array(z.string()).nullish(),
    statuses: z.array(z.string()).nullish(),
    subjects: z.array(z.string()).nullish(),
    isActive: z.boolean().nullish(),
    introducedFrom: z.string().nullish(),
    introducedTo: z.string().nullish(),
    publishedFrom: z.string().nullish(),
    publishedTo: z.string().nullish(),
    issuedFrom: z.string().nullish(),
    issuedTo: z.string().nullish(),
    asOf: z.string().nullish(),
    mode: z.string().nullish(),
    kind: z.string().nullish(),
    corpora: z.array(z.string()).nullish(),
    publicationKinds: z.array(z.string()).nullish(),
    sourceId: z.string().nullish(),
    codeId: z.string().nullish(),
    codeIds: z.array(z.string()).nullish(),
    agencyIds: z.array(z.string()).nullish(),
    editionId: z.string().nullish(),
    editionIds: z.array(z.string()).nullish(),
    versionId: z.string().nullish(),
    parentId: z.string().nullish(),
    nodeKind: z.string().nullish(),
    traversal: z.string().nullish()
  })
const activityOutputSchema = z.object({ data: z.object({ items: z.array(z.unknown()) }) })
const activityResultSchema = z.object({ resultSet: entityPageSchema.pick({ items: true }) })
const comparisonOutputSchema = z.object({
  data: z.object({
    billId: z.string(),
    documents: z.array(
      z.object({
        id: z.string(),
        title: z.string().nullish(),
        versionCode: z.string().nullish(),
        documentDate: z.string().nullish()
      })
    )
  })
})

const documentMetadataSchema = comparisonOutputSchema.shape.data.shape.documents.element.extend({ billId: z.string() })
const documentContainerSchema = z.object({
  documents: z.array(z.unknown()).optional(),
  document: z.unknown().optional()
})
const priorOutputSchema = z.object({
  data: documentContainerSchema.extend({ items: z.array(z.object({ data: documentContainerSchema })).optional() })
})

function comparisonVersions(part: ResearchActivityProps["part"], previousParts: UIMessage["parts"]) {
  if (part.toolName !== "compare_bill_versions") {
    return undefined
  }
  const input = activityInputSchema.safeParse(part.input)
  if (!input.success || input.data.documentIds?.length !== 2) {
    return undefined
  }
  const output = part.state === "output-available" ? comparisonOutputSchema.safeParse(part.output) : undefined
  const knownDocuments = new Map<string, z.infer<typeof documentMetadataSchema>>()
  for (const previous of previousParts) {
    if (previous.type !== "dynamic-tool" || previous.state !== "output-available") {
      continue
    }
    const parsed = priorOutputSchema.safeParse(previous.output)
    if (!parsed.success) {
      continue
    }
    const containers = [parsed.data.data, ...(parsed.data.data.items?.map((item) => item.data) ?? [])]
    for (const container of containers) {
      for (const candidate of [...(container.documents ?? []), container.document]) {
        const document = documentMetadataSchema.safeParse(candidate)
        if (document.success && document.data.billId === input.data.billId) {
          knownDocuments.set(document.data.id, document.data)
        }
      }
    }
  }
  const documents = input.data.documentIds.map((id) => {
    if (output?.success && output.data.data.billId === input.data.billId) {
      const document = output.data.data.documents.find((candidate) => candidate.id === id)
      if (document) {
        return document
      }
    }
    return knownDocuments.get(id)
  })
  const labels = documents.map((document) => document?.versionCode?.trim() || document?.title?.trim())
  return labels
    .map((label, index) => {
      const date = documents[index]?.documentDate
      if (label && labels[0] === labels[1] && date) {
        return `${label} (${date})`
      }
      return label || `Version ${index + 1} (label unavailable)`
    })
    .join(" vs. ")
}

function activityRecordLabel(id: string) {
  const match = /^bill:([a-z0-9-]+):([a-z0-9-]+):([a-z0-9]+):([a-z0-9-]+)$/.exec(id)
  if (!match) {
    return id
  }
  const [, jurisdiction, session, billType, billNumber] = match
  if (!jurisdiction || !session || !billType || !billNumber) {
    return id
  }
  return `${billType.toUpperCase()} ${billNumber.toUpperCase()}, ${jurisdiction.toUpperCase()}, ${sessionLabel(`session:${jurisdiction}:${session}`)}`
}

export function ResearchActivity({ part, isRunning, previousParts = [] }: ResearchActivityProps) {
  const [isErrorExpanded, setIsErrorExpanded] = useState(false)
  let label =
    part.toolName === "ask_clarification" ? "Clarify question" : (researchToolLabels[part.toolName] ?? "Research")
  let state = "Pending"
  let Icon = Circle
  let stateClass = styles.activityPending
  const versions = comparisonVersions(part, previousParts)
  const input = activityInputSchema.safeParse(part.input)
  const isMeetingList =
    part.toolName === "search_events" &&
    input.success &&
    !input.data.query &&
    !input.data.jurisdictionId &&
    !input.data.organizationId &&
    !input.data.from &&
    !input.data.to
  if (isMeetingList) {
    label = "List meetings"
  }
  const output = part.state === "output-available" ? activityOutputSchema.safeParse(part.output) : undefined
  const result = part.state === "output-available" ? activityResultSchema.safeParse(part.output) : undefined
  const knownTitles = new Map<string, string>([
    ["organization:congress:house", "House"],
    ["organization:congress:senate", "Senate"]
  ])
  for (const previous of previousParts) {
    if (previous.type !== "dynamic-tool" || previous.state !== "output-available") {
      continue
    }
    const parsed = activityResultSchema.safeParse(previous.output)
    if (parsed.success) {
      for (const record of parsed.data.resultSet.items) {
        if (record.title.trim()) {
          knownTitles.set(record.id, record.title)
        }
      }
    }
  }
  const sessionNames = new Map<string, string>()
  if (result?.success) {
    for (const record of result.data.resultSet.items) {
      if (record.billSummary?.sessionId && record.billSummary.sessionName) {
        sessionNames.set(record.billSummary.sessionId, record.billSummary.sessionName)
      }
    }
  }
  let detail: string | undefined
  if (input.success) {
    const filters = input.data
    const parts: string[] = []
    if (isMeetingList) {
      parts.push("All jurisdictions")
    }
    if (part.toolName === "search_bills") {
      const jurisdictions = new Set<string>()
      for (const id of [filters.jurisdictionId, ...(filters.jurisdictionIds ?? [])]) {
        if (id) {
          jurisdictions.add(id.replace(/^jurisdiction:/, "").toUpperCase())
        }
      }
      for (const id of filters.sessionIds ?? []) {
        const match = /^session:([a-z0-9-]+):[^:\s]+$/.exec(id)
        if (match?.[1]) {
          jurisdictions.add(match[1].toUpperCase())
        }
      }
      const summary = [
        filters.query,
        ...jurisdictions,
        ...(filters.sessionIds?.map((id) => sessionLabel(id, sessionNames.get(id))) ?? [])
      ]
        .filter(Boolean)
        .join(", ")
      if (summary) {
        parts.push(summary)
      }
    } else if (filters.query) {
      parts.push(filters.query)
    }
    const ids = [
      filters.id,
      ...(filters.ids ?? []),
      filters.billId,
      ...(filters.billIds ?? []),
      filters.organizationId,
      filters.parentOrganizationId,
      filters.personId,
      filters.sponsorPersonId,
      ...(filters.sponsorIds ?? []),
      filters.recordId,
      filters.amendmentId,
      filters.eventId
    ]
    for (const id of new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))) {
      const record = result?.success ? result.data.resultSet.items.find((candidate) => candidate.id === id) : undefined
      if (part.toolName === "get_bills" || id === filters.billId || filters.billIds?.includes(id)) {
        parts.push(activityRecordLabel(id))
      } else {
        parts.push(record?.title || knownTitles.get(id) || activityRecordLabel(id))
      }
    }
    for (const id of new Set([filters.jurisdictionId, ...(filters.jurisdictionIds ?? [])])) {
      if (id && part.toolName !== "search_bills") {
        parts.push(id.replace(/^jurisdiction:/, "").toUpperCase())
      }
    }
    if (filters.recordType) {
      parts.push(`Record type: ${filters.recordType}`)
    }
    if (filters.classification) {
      const label = part.toolName === "search_changes" ? "Change" : "Classification"
      parts.push(`${label}: ${filters.classification.replaceAll("-", " ")}`)
    }
    for (const [label, values] of [
      ["Classification", filters.classifications],
      ["Status", filters.statuses],
      ["Subject", filters.subjects],
      ["Corpus", filters.corpora],
      ["Publication type", filters.publicationKinds]
    ] as const) {
      if (values?.length) {
        parts.push(`${label}: ${values.join(", ")}`)
      }
    }
    if (typeof filters.isActive === "boolean") {
      parts.push(filters.isActive ? "Active only" : "Inactive only")
    }
    if (filters.versionCode && part.toolName !== "get_bill_text") {
      parts.push(`Version: ${filters.versionCode}`)
    }
    if (!["compare_bill_versions", "search_bill_text", "get_bill_text"].includes(part.toolName)) {
      const documentIds = [filters.documentId, ...(filters.documentIds ?? [])].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
      if (documentIds.length) {
        const labels = documentIds.map((id) => knownTitles.get(id))
        if (labels.every((label) => Boolean(label))) {
          parts.push(`Documents: ${labels.join("; ")}`)
        } else {
          parts.push(`${documentIds.length} selected ${documentIds.length === 1 ? "document" : "documents"}`)
        }
      }
    }
    for (const [label, value] of [
      ["Mode", ["search_bills", "search_bill_text"].includes(part.toolName) ? undefined : filters.mode],
      ["Kind", filters.kind],
      ["Source", filters.sourceId],
      ["Node kind", filters.nodeKind],
      ["Traversal", filters.traversal]
    ] as const) {
      if (value) {
        parts.push(`${label}: ${value}`)
      }
    }
    for (const [label, ids] of [
      ["Code", [filters.codeId, ...(filters.codeIds ?? [])]],
      ["Agency", filters.agencyIds ?? []],
      ["Edition", [filters.editionId, ...(filters.editionIds ?? [])]],
      ["Version", [filters.versionId]],
      ["Parent", [filters.parentId]]
    ] as const) {
      const selected = [...ids].filter((id): id is string => typeof id === "string" && id.length > 0)
      if (selected.length) {
        parts.push(`${label}: ${selected.map((id) => knownTitles.get(id) || id).join(", ")}`)
      }
    }
    const from = filters.from || filters.observedFrom
    const to = filters.to || filters.observedTo
    const dateFormat = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    })
    const formatDate = (value: string) => {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? value : dateFormat.format(date)
    }
    if (from && to) {
      parts.push(`Between ${formatDate(from)} -- ${formatDate(to)}`)
    }
    for (const [label, value] of [
      ["From", to ? undefined : from],
      ["To", from ? undefined : to],
      ["Introduced from", filters.introducedFrom],
      ["Introduced to", filters.introducedTo],
      ["Published from", filters.publishedFrom],
      ["Published to", filters.publishedTo],
      ["Issued from", filters.issuedFrom],
      ["Issued to", filters.issuedTo],
      ["As of", filters.asOf]
    ]) {
      if (value) {
        parts.push(`${label}: ${formatDate(value)}`)
      }
    }
    detail = parts.join("; ")
    if (filters.limit) {
      const count = new Intl.NumberFormat("en-US").format(filters.limit)
      let noun = filters.limit === 1 ? "result" : "results"
      if (part.toolName === "search_changes") {
        noun = filters.limit === 1 ? "recorded change" : "recorded changes"
      } else if (part.toolName === "search_votes") {
        noun = filters.limit === 1 ? "vote" : "votes"
      } else if (part.toolName === "search_events") {
        noun = filters.limit === 1 ? "meeting" : "meetings"
      }
      detail = [detail, `Up to ${count} ${noun}`].filter(Boolean).join("; ")
    }
  }
  if (detail) {
    detail = sessionLabelsInText(detail, sessionNames)
  }
  const sessions =
    input.success && part.toolName !== "search_bills"
      ? input.data.sessionIds?.map((id) => sessionLabel(id, sessionNames.get(id))).join(", ")
      : undefined
  if (part.state === "output-available") {
    state = "Complete"
    Icon = CircleCheck
    stateClass = styles.activityComplete
  } else if (part.state === "output-error" || part.state === "output-denied") {
    state = "Failed"
    Icon = CircleAlert
    stateClass = styles.activityFailed
  } else if (!isRunning) {
    state = "Interrupted"
    Icon = CircleAlert
    stateClass = styles.activityFailed
  } else if (part.state === "input-available") {
    state = "Running"
  }

  if (part.state === "output-error" || part.state === "output-denied") {
    return (
      <Collapsible className={styles.activityStep} open={isErrorExpanded} onOpenChange={setIsErrorExpanded}>
        <CollapsibleTrigger className={styles.failedToolTrigger} aria-label={`${label}: ${state}`}>
          <span className={styles.activityHeading}>
            <CircleAlert className={`${stateClass} size-4 shrink-0`} aria-hidden="true" />
            <span className={styles.activityLabel}>{label}</span>
            <span className={styles.activityCount}>{state}</span>
            <ChevronDown
              className={`size-4 shrink-0 text-subtle ${isErrorExpanded ? "" : "-rotate-90"}`}
              aria-hidden="true"
            />
          </span>
          {(detail || sessions) && (
            <span className={styles.activityDetails}>
              <span className="min-w-0 flex-1 break-words">{[detail, sessions].filter(Boolean).join(", ")}</span>
            </span>
          )}
          {versions && (
            <span className={styles.activityDetails}>
              <span className="min-w-0 break-words">{versions}</span>
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className={styles.failedToolDetails}>
          <p className={styles.failedToolError}>
            {part.state === "output-error" ? part.errorText : "This operation was not permitted."}
          </p>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className={styles.activityStep}>
      <div className={styles.activityHeading} aria-label={`${label}: ${state}`}>
        {state === "Running" ? (
          <Spinner className={stateClass} aria-hidden="true" />
        ) : (
          <Icon className={`${stateClass} size-4 shrink-0`} aria-hidden="true" />
        )}
        <span className={styles.activityLabel}>{label}</span>
        <span className={styles.activityCount}>{state}</span>
      </div>
      {(detail || sessions || output?.success) && (
        <div className={styles.activityDetails}>
          <span className="min-w-0 flex-1 break-words">{[detail, sessions].filter(Boolean).join(", ")}</span>
          {output?.success && (
            <span className="shrink-0 font-mono">
              {new Intl.NumberFormat().format(output.data.data.items.length)} returned
            </span>
          )}
        </div>
      )}
      {versions && (
        <div className={styles.activityDetails}>
          <span className="min-w-0 break-words">{versions}</span>
        </div>
      )}
    </div>
  )
}
