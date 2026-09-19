import remarkParse from "remark-parse"
import { defaultRemarkPlugins } from "streamdown"
import { unified } from "unified"
import { evidenceSourceUrl, sourceUrlSchema, type EvidenceSnapshot } from "../evidence"

export type CitationSelection = Readonly<{
  answerId: string
  number: number
  evidence: EvidenceSnapshot
}>

type CitationReference = Readonly<{
  answerId: string
  number: number
  referenceId: string
  evidence: EvidenceSnapshot | undefined
}>

const markdownParser = unified().use(remarkParse).use(Object.values(defaultRemarkPlugins))
const malformedCitation = /\[\d+\]\(#citation-(?:e[1-9][0-9]{0,30}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\]/i

function normalizeMalformedCitations(markdown: string) {
  if (!malformedCitation.test(markdown)) {
    return markdown
  }
  const tree = markdownParser.parse(markdown)
  const candidates: { start: number; end: number }[] = []
  function visit(node: typeof tree | (typeof tree.children)[number]) {
    if (node.type === "text") {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start === undefined || end === undefined) {
        return
      }
      // Repair only the observed wrong closing delimiter, inside Markdown prose.
      // Missing or ambiguous exact IDs still flow through the unavailable-citation renderer.
      for (const match of markdown.slice(start, end).matchAll(new RegExp(malformedCitation.source, "gi"))) {
        const offset = start + match.index
        const prefix = markdown.slice(0, offset)
        if (prefix.endsWith("!") || (prefix.match(/\\+$/)?.[0].length ?? 0) % 2 === 1) {
          continue
        }
        candidates.push({ start: offset, end: offset + match[0].length })
      }
    } else if ("children" in node && node.type !== "link" && node.type !== "linkReference") {
      node.children.forEach(visit)
    }
  }
  visit(tree)
  if (candidates.length === 0) {
    return markdown
  }
  // A malformed marker can prevent its surrounding link or image from parsing.
  // Mask candidates without moving offsets, then protect the enclosing Markdown.
  let masked = markdown
  for (const candidate of candidates.toSorted((left, right) => right.start - left.start)) {
    masked =
      masked.slice(0, candidate.start) + "x".repeat(candidate.end - candidate.start) + masked.slice(candidate.end)
  }
  const protectedRanges: { start: number; end: number }[] = []
  function protect(node: typeof tree | (typeof tree.children)[number]) {
    if (
      node.type === "link" ||
      node.type === "linkReference" ||
      node.type === "image" ||
      node.type === "imageReference"
    ) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start !== undefined && end !== undefined) {
        protectedRanges.push({ start, end })
      }
      return
    }
    if ("children" in node) {
      node.children.forEach(protect)
    }
  }
  protect(markdownParser.parse(masked))
  const edits = candidates
    .filter(
      (candidate) => !protectedRanges.some((range) => candidate.start >= range.start && candidate.end <= range.end)
    )
    .map((candidate) => candidate.end - 1)
  let normalized = markdown
  for (const offset of edits.sort((left, right) => right - left)) {
    normalized = normalized.slice(0, offset) + ")" + normalized.slice(offset + 1)
  }
  return normalized
}

function normalizedSourceUrl(value: string | null | undefined) {
  if (!value) {
    return undefined
  }
  const parsed = sourceUrlSchema.safeParse(value)
  return parsed.success ? new URL(parsed.data).href : undefined
}

function uuidIdentity(value: string) {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(value)
    ? value.replaceAll("-", "").toLowerCase()
    : undefined
}

function registerReference(references: Map<string, EvidenceSnapshot | null>, key: string, source: EvidenceSnapshot) {
  const existing = references.get(key)
  references.set(key, existing === null || (existing && existing.id !== source.id) ? null : source)
}

export function createCitationPresentation(
  answerId: string,
  text: string,
  evidence: readonly EvidenceSnapshot[],
  previousNumbers: ReadonlyMap<string, number> = new Map()
) {
  const byId = new Map(evidence.map((source) => [source.id, source]))
  const byReference = new Map<string, EvidenceSnapshot | null>(byId)
  const byUuid = new Map<string, EvidenceSnapshot | null>()
  const byUrl = new Map<string, EvidenceSnapshot | null>()
  for (const source of byId.values()) {
    if (source.citationRef) {
      registerReference(byReference, source.citationRef, source)
    }
    const uuid = uuidIdentity(source.id)
    if (uuid !== undefined) {
      registerReference(byUuid, uuid, source)
    }
    for (const value of [source.sourceUrl, evidenceSourceUrl(source)]) {
      const url = normalizedSourceUrl(value)
      if (!url) {
        continue
      }
      registerReference(byUrl, url, source)
    }
  }

  function resolveEvidence(href: string | undefined) {
    if (href?.startsWith("#citation-")) {
      const id = href.slice("#citation-".length)
      const uuid = uuidIdentity(id)
      return uuid === undefined ? byReference.get(id) : byUuid.get(uuid)
    }
    const url = normalizedSourceUrl(href)
    return url ? byUrl.get(url) : undefined
  }

  function referenceId(href: string | undefined) {
    const source = resolveEvidence(href)
    if (source) {
      if (source.citationRef && byReference.get(source.citationRef)?.id === source.id) {
        return source.citationRef
      }
      return source.id
    }
    return href?.startsWith("#citation-") ? href.slice("#citation-".length) : undefined
  }

  const normalizedText = normalizeMalformedCitations(text)
  const tree = markdownParser.parse(normalizedText)
  const definitions = new Map<string, string>()
  const footnotes = new Map<string, Extract<(typeof tree.children)[number], { type: "footnoteDefinition" }>>()
  function collectDefinitions(node: typeof tree | (typeof tree.children)[number]) {
    if (node.type === "definition" && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url)
    }
    if (node.type === "footnoteDefinition" && !footnotes.has(node.identifier)) {
      footnotes.set(node.identifier, node)
    }
    if ("children" in node) {
      node.children.forEach(collectDefinitions)
    }
  }
  collectDefinitions(tree)

  const numbers = new Map(previousNumbers)
  const cited = new Map<string, CitationSelection>()
  const references = new Map<string, CitationReference>()
  const missingReferences = new Set<string>()
  const referencedFootnotes = new Set<string>()
  let nextNumber = Math.max(0, ...numbers.values()) + 1
  function visit(node: typeof tree | (typeof tree.children)[number]) {
    if (node.type === "footnoteDefinition") {
      return
    }
    if (node.type === "footnoteReference") {
      referencedFootnotes.add(node.identifier)
    }
    let href: string | undefined
    if (node.type === "link") {
      href = node.url
    } else if (node.type === "linkReference") {
      href = definitions.get(node.identifier)
    }
    const source = href && resolveEvidence(href)
    if (href?.startsWith("#citation-") && !source) {
      missingReferences.add(href.slice("#citation-".length))
    }
    const id = referenceId(href)
    if (id !== undefined && !references.has(id)) {
      let number = numbers.get(id)
      if (number === undefined) {
        number = nextNumber++
        numbers.set(id, number)
      }
      references.set(id, { answerId, number, referenceId: id, evidence: source || undefined })
      if (source) {
        cited.set(source.id, { answerId, number, evidence: source })
      }
    }
    if ("children" in node) {
      node.children.forEach(visit)
    }
  }
  visit(tree)
  for (const identifier of referencedFootnotes) {
    footnotes.get(identifier)?.children.forEach(visit)
  }

  function formatCitationGroups(input: string) {
    const markdown = normalizeMalformedCitations(input)
    const parsed = markdown === normalizedText ? tree : markdownParser.parse(markdown)
    const edits: { start: number; end: number; text: string }[] = []
    function visitGroups(node: typeof parsed | (typeof parsed.children)[number]) {
      if (!("children" in node)) {
        return
      }
      let group: { start: number; end: number; id: string; number: number }[] = []
      function flush() {
        const first = group[0]
        const last = group.at(-1)
        if (first && last && group.length > 1) {
          const unique = new Map(group.map((item) => [item.id, item]))
          edits.push({
            start: first.start,
            end: last.end,
            text: [...unique.values()]
              .sort((left, right) => left.number - right.number)
              .map((item) => markdown.slice(item.start, item.end))
              .join(" ")
          })
        }
        group = []
      }
      for (const child of node.children) {
        let href: string | undefined
        if (child.type === "link") {
          href = child.url
        } else if (child.type === "linkReference") {
          href = definitions.get(child.identifier)
        }
        const id = referenceId(href)
        const reference = id === undefined ? undefined : references.get(id)
        const start = child.position?.start.offset
        const end = child.position?.end.offset
        if (reference && start !== undefined && end !== undefined) {
          group.push({ start, end, id: reference.referenceId, number: reference.number })
          continue
        }
        if (child.type === "text" && /^[\s,;]*$/.test(child.value)) {
          continue
        }
        flush()
        visitGroups(child)
      }
      flush()
    }
    visitGroups(parsed)
    let formatted = markdown
    for (const edit of edits.sort((left, right) => right.start - left.start)) {
      formatted = formatted.slice(0, edit.start) + edit.text + formatted.slice(edit.end)
    }
    return formatted
  }

  return {
    numbers,
    references: [...references.values()].sort((left, right) => left.number - right.number),
    formatCitationGroups,
    missingReferences: [...missingReferences],
    citations: [...cited.values()].sort((left, right) => left.number - right.number),
    resolveCitation(href: string | undefined) {
      const source = resolveEvidence(href)
      return source ? cited.get(source.id) : undefined
    },
    resolveReference(href: string | undefined) {
      const id = referenceId(href)
      return id === undefined ? undefined : references.get(id)
    }
  }
}
