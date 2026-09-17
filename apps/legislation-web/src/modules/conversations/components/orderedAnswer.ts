import type { UIMessage } from "ai"
import remarkParse from "remark-parse"
import { defaultRemarkPlugins } from "streamdown"
import { unified } from "unified"

type OrderedAnswerPart =
  | Readonly<{ type: "text"; key: string; text: string }>
  | Readonly<{ type: "presentation"; key: string; part: UIMessage["parts"][number] }>

const markdownParser = unified().use(remarkParse).use(Object.values(defaultRemarkPlugins))

export function orderedAnswerParts(parts: UIMessage["parts"]): OrderedAnswerPart[] {
  const ordered = new Map<string, OrderedAnswerPart>()
  for (const [index, part] of parts.entries()) {
    if (part.type === "text") {
      const key = `text:${index}`
      ordered.set(key, { type: "text", key, text: part.text })
    } else if (part.type === "data-presentation") {
      const key = part.id ? `presentation:${part.id}` : `invalid:${index}`
      ordered.set(key, { type: "presentation", key, part })
    }
  }
  return [...ordered.values()]
}

export function answerReferenceDefinitions(text: string) {
  const tree = markdownParser.parse(text)
  const definitions = new Map<string, string>()
  function visit(node: typeof tree | (typeof tree.children)[number]) {
    if (node.type === "definition" && !definitions.has(node.identifier)) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start !== undefined && end !== undefined) {
        definitions.set(node.identifier, text.slice(start, end))
      }
    }
    if ("children" in node) {
      node.children.forEach(visit)
    }
  }
  visit(tree)
  return [...definitions.values()].join("\n\n")
}
