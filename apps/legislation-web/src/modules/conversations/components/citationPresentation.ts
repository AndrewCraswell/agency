import remarkParse from "remark-parse"
import { defaultRemarkPlugins } from "streamdown"
import { unified } from "unified"
import { evidenceSourceUrl, sourceUrlSchema, type EvidenceSnapshot } from "../evidence"

export type CitationSelection = Readonly<{
  answerId: string
  number: number
  evidence: EvidenceSnapshot
}>

const markdownParser = unified().use(remarkParse).use(Object.values(defaultRemarkPlugins))

function normalizedSourceUrl(value: string | null | undefined) {
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
  const byUrl = new Map<string, EvidenceSnapshot | null>()
  for (const source of byId.values()) {
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
      return byId.get(href.slice("#citation-".length))
    }
    const url = normalizedSourceUrl(href)
    return url ? byUrl.get(url) : undefined
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
    if (source && !cited.has(source.id)) {
      let number = numbers.get(source.id)
      if (number === undefined) {
        number = nextNumber++
        numbers.set(source.id, number)
      }
      cited.set(source.id, { answerId, number, evidence: source })
    }
    if ("children" in node) {
      node.children.forEach(visit)
    }
  }
  visit(tree)
  for (const identifier of referencedFootnotes) {
    footnotes.get(identifier)?.children.forEach(visit)
  }

  return {
    numbers,
    citations: [...cited.values()].sort((left, right) => left.number - right.number),
    resolveCitation(href: string | undefined) {
      const source = resolveEvidence(href)
      return source ? cited.get(source.id) : undefined
    }
  }
}
