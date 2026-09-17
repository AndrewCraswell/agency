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

function normalizedSourceUrl(value: string | null | undefined) {
  if (!value) {
    return undefined
  }
  const parsed = sourceUrlSchema.safeParse(value)
  return parsed.success ? new URL(parsed.data).href : undefined
}

export function createCitationPresentation(
  answerId: string,
  text: string,
  evidence: readonly EvidenceSnapshot[],
  previousNumbers: ReadonlyMap<string, number> = new Map()
) {
  const byId = new Map(evidence.map((source) => [source.id, source]))
  const byReference = new Map<string, EvidenceSnapshot | null>(byId)
  const byUrl = new Map<string, EvidenceSnapshot | null>()
  for (const source of byId.values()) {
    if (source.citationRef) {
      const existing = byReference.get(source.citationRef)
      if (existing === null || (existing && existing.id !== source.id)) {
        byReference.set(source.citationRef, null)
      } else {
        byReference.set(source.citationRef, source)
      }
    }
    for (const value of [source.sourceUrl, evidenceSourceUrl(source)]) {
      const url = normalizedSourceUrl(value)
      if (!url) {
        continue
      }
      const existing = byUrl.get(url)
      if (existing === null || (existing && existing.id !== source.id)) {
        byUrl.set(url, null)
      } else {
        byUrl.set(url, source)
      }
    }
  }

  function resolveEvidence(href: string | undefined) {
    if (href?.startsWith("#citation-")) {
      return byReference.get(href.slice("#citation-".length))
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

  const tree = markdownParser.parse(text)
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

  function formatCitationGroups(markdown: string) {
    const parsed = markdown === text ? tree : markdownParser.parse(markdown)
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
