import { z } from "zod"
import {
  billId as createBillId,
  childId,
  jurisdictionId,
  legislativeSessionId,
  legislativeVoteId,
  organizationId,
  personId
} from "../../legislation/identifiers.js"
import type { CanonicalBillAggregate } from "../../legislation/model.js"

const safeArray = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (value) =>
      Array.isArray(value)
        ? value.flatMap((candidate) => {
            const parsed = item.safeParse(candidate)
            return parsed.success ? [parsed.data] : []
          })
        : [],
    z.array(item)
  )
const sourceSchema = z.object({ url: z.string().min(1) })
const linkSchema = z.object({ media_type: z.string().optional(), text: z.string().optional(), url: z.string().min(1) })
const documentSchema = z.object({
  classification: z.string().optional(),
  date: z.string().optional(),
  links: safeArray(linkSchema),
  note: z.string().optional()
})
const actionSchema = z.object({
  classification: z.array(z.string()).default([]),
  date: z.string().optional(),
  description: z.string().min(1),
  organization_id: z.string().optional(),
  order: z.number().int().nonnegative().optional()
})
const sponsorshipSchema = z.object({
  classification: z.string().optional(),
  entity_type: z.string().optional(),
  name: z.string().min(1),
  person_id: z.string().optional(),
  primary: z.boolean().default(false)
})
const relationSchema = z.object({
  identifier: z.string().min(1),
  legislative_session: z.string().optional(),
  relation_type: z.string().optional()
})
const voteSchema = z.object({
  classification: safeArray(z.string()),
  counts: safeArray(z.object({ option: z.string(), value: z.number().int().nonnegative() })),
  id: z.string().optional(),
  identifier: z.string().optional(),
  motion: z.string().optional(),
  motion_text: z.string().optional(),
  organization_id: z.string().optional(),
  result: z.string().optional(),
  sources: safeArray(sourceSchema),
  start_date: z.string().optional(),
  votes: safeArray(z.object({ option: z.string(), voter_id: z.string().optional(), voter_name: z.string().min(1) }))
})

export const openStatesBillSchema = z.object({
  _id: z.string().optional(),
  abstracts: safeArray(z.object({ abstract: z.string().min(1), date: z.string().optional() })),
  actions: safeArray(actionSchema),
  classification: safeArray(z.string()),
  documents: safeArray(documentSchema),
  from_organization: z.string().optional(),
  id: z.string().optional(),
  identifier: z.string().min(1),
  legislative_session: z.string().min(1),
  openstates_url: z.string().optional(),
  related_bills: safeArray(relationSchema),
  sources: safeArray(sourceSchema),
  sponsorships: safeArray(sponsorshipSchema),
  subject: safeArray(z.string()),
  title: z.string().min(1),
  updated_at: z.string().optional(),
  versions: safeArray(documentSchema),
  votes: safeArray(voteSchema)
})

export interface OpenStatesContext {
  jurisdictionCode: string
  jurisdictionName: string
  sessionName?: string
}

export interface NormalizationDiagnostic {
  field: string
  reason: string
  value: unknown
}

export interface OpenStatesNormalizationResult {
  aggregate: CanonicalBillAggregate
  diagnostics: NormalizationDiagnostic[]
}

function parsePrintedIdentifier(identifier: string): { billNumber: string; billType: string } {
  const normalized = identifier.normalize("NFKC").trim().replaceAll(/\s+/g, " ")
  const numericPrefix = /^(\d+)([a-z][\w-]*)$/i.exec(normalized)
  if (numericPrefix?.[1] !== undefined && numericPrefix[2] !== undefined) {
    return { billNumber: numericPrefix[1], billType: numericPrefix[2] }
  }

  const separatedTypeSuffix = /^([a-z][a-z.-]*)\s+([a-z]+)(\d[\w-]*)$/i.exec(normalized)
  if (
    separatedTypeSuffix?.[1] !== undefined &&
    separatedTypeSuffix[2] !== undefined &&
    separatedTypeSuffix[3] !== undefined
  ) {
    return {
      billNumber: separatedTypeSuffix[3],
      billType: `${separatedTypeSuffix[1]}${separatedTypeSuffix[2]}`
    }
  }

  const separated = /^(.+?)\s+([a-z0-9][\w-]*)$/i.exec(normalized)
  if (separated?.[1] !== undefined && separated[2] !== undefined) {
    return { billNumber: separated[2], billType: separated[1] }
  }

  const compact = /^([a-z][a-z.-]*?)(\d[\w-]*)$/i.exec(normalized)
  if (compact?.[1] !== undefined && compact[2] !== undefined) {
    return { billNumber: compact[2], billType: compact[1] }
  }

  throw new Error(`Unsupported Open States bill identifier: ${identifier}`)
}

function exactDate(value: string | undefined, field: string, diagnostics: NormalizationDiagnostic[]) {
  if (value === undefined) {
    return undefined
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  if (match?.[1] !== undefined) {
    return match[1]
  }
  diagnostics.push({ field, reason: "fuzzy date was not fabricated", value })
  return undefined
}

function chamberFromOrganization(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  const normalized = value.toLowerCase()
  if (normalized.includes("house") || normalized.includes("lower")) {
    return "lower"
  }
  if (normalized.includes("senate") || normalized.includes("upper")) {
    return "upper"
  }
  if (normalized.includes("unicameral")) {
    return "unicameral"
  }
  if (normalized.includes("legislature")) {
    return "legislature"
  }
  return undefined
}

function normalizeRelation(value: string | undefined): string {
  const normalized = value?.toLowerCase().replaceAll("_", "-")
  if (normalized === "companion" || normalized === "prior-session" || normalized === "replaced-by") {
    return normalized
  }
  if (normalized === "replaces") {
    return "replacement"
  }
  return "related"
}

function normalizeVoteOption(value: string): string {
  const normalized = value.trim().toLowerCase().replaceAll("_", "-")
  if (normalized === "yea" || normalized === "aye" || normalized === "yes") {
    return "yes"
  }
  if (normalized === "nay" || normalized === "no") {
    return "no"
  }
  if (
    normalized === "absent" ||
    normalized === "abstain" ||
    normalized === "not-voting" ||
    normalized === "present" ||
    normalized === "proxy" ||
    normalized === "paired"
  ) {
    return normalized
  }
  if (normalized === "not voting") {
    return "not-voting"
  }
  return "other"
}

function nonBlank(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized === "" ? undefined : normalized
}

function optionalOrganizationId(value: string | undefined): string | undefined {
  const providerOrganizationId = nonBlank(value)
  return providerOrganizationId === undefined ? undefined : organizationId("openstates", providerOrganizationId)
}

function uniqueBy<T>(values: readonly T[], identity: (value: T) => string): T[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = identity(value)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function canonicalDocumentClassification(
  collection: "document" | "version",
  document: z.infer<typeof documentSchema>,
  link: z.infer<typeof linkSchema>
): "amendment" | "analysis" | "fiscal-note" | "supplemental" | "version" {
  if (collection === "version") {
    return "version"
  }
  const value = `${document.classification ?? ""} ${document.note ?? ""} ${link.text ?? ""}`.toLowerCase()
  if (value.includes("amendment")) {
    return "amendment"
  }
  if (value.includes("fiscal") && value.includes("note")) {
    return "fiscal-note"
  }
  if (value.includes("analysis")) {
    return "analysis"
  }
  return "supplemental"
}

function sourceUrl(sources: Array<{ url: string }>, fallback?: string): string {
  const url = sources[0]?.url ?? fallback
  if (url === undefined) {
    throw new Error("Open States bill has no source URL")
  }
  return url
}

function providerBillUrl(upstreamId: string | undefined): string | undefined {
  return upstreamId?.startsWith("ocd-bill/") ? `https://v3.openstates.org/bills/${upstreamId}` : undefined
}

function jurisdictionClassification(code: string): "district" | "state" | "territory" {
  const normalized = code.toLowerCase()
  if (normalized === "dc") {
    return "district"
  }
  if (normalized === "pr") {
    return "territory"
  }
  return "state"
}

function documentRecords(
  billId: string,
  collection: "document" | "version",
  documents: Array<z.infer<typeof documentSchema>>,
  diagnostics: NormalizationDiagnostic[]
) {
  return documents.flatMap((document) =>
    document.links.map((link) => {
      const identity = `${collection}:${link.url}`
      return {
        document: {
          billId,
          classification: canonicalDocumentClassification(collection, document, link),
          contentType: link.media_type,
          documentDate: exactDate(document.date, `${collection}.date`, diagnostics),
          id: childId("document", billId, identity),
          sourceUrl: link.url,
          title: document.note ?? link.text ?? `${collection} document`,
          versionCode: collection === "version" ? (document.classification ?? document.note) : undefined
        }
      }
    })
  )
}

export function normalizeOpenStatesBill(input: unknown, context: OpenStatesContext): OpenStatesNormalizationResult {
  const source = openStatesBillSchema.parse(input)
  const diagnostics: NormalizationDiagnostic[] = []
  const jurisdiction = jurisdictionId(context.jurisdictionCode)
  const session = legislativeSessionId(context.jurisdictionCode, source.legislative_session)
  const printed = parsePrintedIdentifier(source.identifier)
  const canonicalBillId = createBillId(
    context.jurisdictionCode,
    source.legislative_session,
    printed.billType,
    printed.billNumber
  )
  const upstreamId = source.id ?? source._id

  const peopleById = new Map<string, NonNullable<CanonicalBillAggregate["people"]>[number]>()
  const sponsors = uniqueBy(
    source.sponsorships.map((sponsor, index) => {
      const canonicalPersonId = sponsor.person_id === undefined ? undefined : personId("openstates", sponsor.person_id)
      if (sponsor.person_id !== undefined && canonicalPersonId !== undefined) {
        peopleById.set(canonicalPersonId, {
          id: canonicalPersonId,
          jurisdictionId: jurisdiction,
          name: sponsor.name,
          sourceId: sponsor.person_id,
          upstreamIds: { openstates: sponsor.person_id }
        })
      }
      const identity = sponsor.person_id ?? `${sponsor.name}:${sponsor.classification ?? "sponsor"}:${index}`
      return {
        billId: canonicalBillId,
        classification: sponsor.classification ?? (sponsor.primary ? "primary" : "sponsor"),
        id: childId("sponsor", canonicalBillId, identity),
        isPrimary: sponsor.primary,
        name: sponsor.name,
        personId: canonicalPersonId
      }
    }),
    (sponsor) => `${sponsor.personId ?? sponsor.id}:${sponsor.classification}`
  )

  const votes = source.votes.map((vote, voteOrdinal) => {
    const providerVoteId = nonBlank(vote.id)
    const providerOrganizationId = nonBlank(vote.organization_id)
    const rollCallNumber = nonBlank(vote.identifier)
    const voteIdentity = providerVoteId ?? rollCallNumber ?? `${vote.start_date ?? "undated"}:${voteOrdinal}`
    const canonicalVoteId = legislativeVoteId("openstates", childId("vote", canonicalBillId, voteIdentity))
    const counts = new Map<string, number>()
    for (const count of vote.counts) {
      const normalizedOption = normalizeVoteOption(count.option)
      const bucket = normalizedOption === "yes" || normalizedOption === "no" ? normalizedOption : "other"
      counts.set(bucket, (counts.get(bucket) ?? 0) + count.value)
    }
    const positions = uniqueBy(
      vote.votes.flatMap((position) => {
        const providerPersonId = nonBlank(position.voter_id)
        const sourcePersonId = providerPersonId ?? `vote-name:${context.jurisdictionCode}:${position.voter_name}`
        const canonicalPersonId = personId(
          providerPersonId === undefined ? "openstates-voter-name" : "openstates",
          sourcePersonId
        )
        peopleById.set(canonicalPersonId, {
          id: canonicalPersonId,
          jurisdictionId: jurisdiction,
          name: position.voter_name,
          sourceId: sourcePersonId,
          upstreamIds:
            providerPersonId === undefined
              ? { openstatesVoteName: position.voter_name }
              : { openstates: providerPersonId }
        })
        return [
          {
            option: normalizeVoteOption(position.option),
            personId: canonicalPersonId,
            sourceIdentity: sourcePersonId,
            sourceName: position.voter_name,
            sourcePersonId,
            voteId: canonicalVoteId
          }
        ]
      }),
      (position) => position.personId
    )
    return {
      positions,
      vote: {
        billId: canonicalBillId,
        chamber: chamberFromOrganization(vote.organization_id),
        classification: nonBlank(vote.classification[0])?.toLowerCase().replaceAll("_", "-") ?? "recorded",
        heldAt:
          vote.start_date !== undefined && /^\d{4}-\d{2}-\d{2}T/.test(vote.start_date)
            ? new Date(vote.start_date)
            : undefined,
        id: canonicalVoteId,
        motion: nonBlank(vote.motion_text) ?? nonBlank(vote.motion) ?? rollCallNumber ?? "Recorded vote",
        noCount: counts.get("no"),
        otherCount: counts.get("other"),
        organizationId:
          providerOrganizationId === undefined ? undefined : organizationId("openstates", providerOrganizationId),
        result: vote.result,
        rollCallNumber,
        sourceId: providerVoteId,
        sourceUrl: vote.sources[0]?.url,
        voteType: vote.classification.join(", ") || undefined,
        yesCount: counts.get("yes")
      }
    }
  })
  const uniqueVotes = uniqueBy(votes, (vote) => vote.vote.id)
  const actions = uniqueBy(
    source.actions.map((action, index) => ({
      actionDate: exactDate(action.date, "actions.date", diagnostics),
      billId: canonicalBillId,
      chamber: chamberFromOrganization(action.organization_id),
      classification: action.classification.map((value) => value.toLowerCase().replaceAll("_", "-")),
      description: action.description,
      id: childId(
        "action",
        canonicalBillId,
        `${action.order ?? index}:${action.date ?? "undated"}:${action.description}`
      ),
      organizationId: optionalOrganizationId(action.organization_id),
      ordinal: action.order ?? index,
      sourceOrganizationId: nonBlank(action.organization_id)
    })),
    (action) => String(action.ordinal)
  )
  const documents = uniqueBy(
    [
      ...documentRecords(canonicalBillId, "version", source.versions, diagnostics),
      ...documentRecords(canonicalBillId, "document", source.documents, diagnostics)
    ],
    (document) => document.document.sourceUrl
  )
  const relations = uniqueBy(
    source.related_bills
      .map((relation) => {
        const relatedPrinted = parsePrintedIdentifier(relation.identifier)
        const relatedSession = relation.legislative_session ?? source.legislative_session
        return {
          billId: canonicalBillId,
          classification: normalizeRelation(relation.relation_type),
          relatedBillId: createBillId(
            context.jurisdictionCode,
            relatedSession,
            relatedPrinted.billType,
            relatedPrinted.billNumber
          )
        }
      })
      .filter((relation) => relation.relatedBillId !== canonicalBillId),
    (relation) => `${relation.relatedBillId}:${relation.classification}`
  )
  const organizationLinks: Array<{ classification: string; sourceOrganizationId: string }> = []
  const sourceOrganizationId = nonBlank(source.from_organization)
  if (sourceOrganizationId !== undefined) {
    organizationLinks.push({ classification: "origin", sourceOrganizationId })
  }
  for (const action of source.actions) {
    const actionOrganizationId = nonBlank(action.organization_id)
    if (actionOrganizationId !== undefined) {
      organizationLinks.push({ classification: "action", sourceOrganizationId: actionOrganizationId })
    }
  }
  for (const vote of source.votes) {
    const voteOrganizationId = nonBlank(vote.organization_id)
    if (voteOrganizationId !== undefined) {
      organizationLinks.push({ classification: "vote", sourceOrganizationId: voteOrganizationId })
    }
  }

  return {
    aggregate: {
      actions,
      bill: {
        chamber: chamberFromOrganization(source.from_organization),
        classification: source.classification.map((value) => value.toLowerCase().replaceAll(" ", "-")),
        id: canonicalBillId,
        identifier: source.identifier,
        jurisdictionId: jurisdiction,
        sessionId: session,
        sourceUpdatedAt: source.updated_at === undefined ? undefined : new Date(source.updated_at),
        sourceUrl: sourceUrl(source.sources, source.openstates_url ?? providerBillUrl(upstreamId)),
        subjects: source.subject,
        summary: source.abstracts[0]?.abstract,
        title: source.title,
        upstreamIds: upstreamId === undefined ? {} : { openstates: upstreamId }
      },
      documents,
      jurisdiction: {
        classification: jurisdictionClassification(context.jurisdictionCode),
        countryCode: "US",
        id: jurisdiction,
        name: context.jurisdictionName,
        subdivisionCode: context.jurisdictionCode.toUpperCase()
      },
      people: [...peopleById.values()],
      organizations: uniqueBy(
        organizationLinks.map(({ classification, sourceOrganizationId }) => ({
          billId: canonicalBillId,
          classification,
          organizationId: organizationId("openstates", sourceOrganizationId)
        })),
        (organization) => organization.organizationId
      ),
      relations,
      session: {
        id: session,
        identifier: source.legislative_session,
        jurisdictionId: jurisdiction,
        name: context.sessionName ?? source.legislative_session
      },
      sponsors,
      votes: uniqueVotes
    },
    diagnostics
  }
}
