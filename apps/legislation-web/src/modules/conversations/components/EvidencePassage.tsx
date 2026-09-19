"use client"

import type { ComponentProps } from "react"
import { defaultRehypePlugins, defaultRemarkPlugins } from "streamdown"
import { MessageResponse } from "../../../components/ai-elements/message"
import { humanReadableUrl } from "../evidence"
import * as styles from "./ConversationResponse.css"

type SourceNode = { type: string; value?: string; children?: SourceNode[] }

function sourceFormatting() {
  return (tree: SourceNode) => {
    function visit(node: SourceNode) {
      if (node.type === "html") {
        if (/^<br\s*\/?>$/i.test(node.value ?? "")) {
          // Interpret this one formatting token as Markdown, never as source HTML.
          node.type = "break"
          delete node.value
        } else {
          node.type = "text"
          node.value = ""
        }
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

function PassageLink({ href, children }: ComponentProps<"a">) {
  const destination = humanReadableUrl(href)
  return destination ? (
    <a href={destination} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  )
}

function OmittedImage() {
  return null
}

const components = { a: PassageLink, img: OmittedImage }
const remarkPlugins = [...Object.values(defaultRemarkPlugins), sourceFormatting]
const rehypePlugins = Object.entries(defaultRehypePlugins)
  .filter(([name]) => name !== "raw")
  .map(([, plugin]) => plugin)

type EvidencePassageProps = Readonly<{
  quote: string
  className: string
  id?: string
  isScrollable?: boolean
}>

export function EvidencePassage({ quote, className, id, isScrollable = false }: EvidencePassageProps) {
  return (
    <div
      id={id}
      className={isScrollable ? styles.passagePreview : undefined}
      role={isScrollable ? "region" : undefined}
      aria-label={isScrollable ? "Retrieved passage" : undefined}
      tabIndex={isScrollable ? 0 : undefined}
    >
      <blockquote className={`${className} ${styles.passageMarkdown}`}>
        <MessageResponse
          mode="static"
          controls={false}
          skipHtml
          components={components}
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
        >
          {quote}
        </MessageResponse>
      </blockquote>
    </div>
  )
}
