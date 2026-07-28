import { useEffect } from "react"
import type { RefObject } from "react"

/**
 * A Polaris field draws its label, frame, and input inside a shadow root, so a page stylesheet reaches none of them.
 * A constructed sheet handed to the field itself does, which is what lets the mark sit on the box the merchant typed
 * in rather than around the label as well.
 *
 * Polaris draws the field's border as an inset shadow, so recolouring that shadow replaces the border without
 * changing its geometry and nothing on the page moves when a rewrite lands. The sheet is appended after the ones
 * Polaris adopts, so everything else about the field still comes from Polaris.
 */
const markedFieldStyles = `
  .input-wrapper {
    background-image: var(--article-ai-shading);
    box-shadow: inset 0 0 0 0.0625rem var(--article-ai-border);
  }

  input,
  textarea {
    color: var(--article-ai-text);
  }
`

/** Colours a Polaris field while it holds text a workflow wrote and the merchant has not saved yet. */
export function useAiFieldMark(field: RefObject<HTMLElement | null>, isMarked: boolean) {
  useEffect(() => {
    const root = field.current?.shadowRoot
    if (!isMarked || root === undefined || root === null) {
      return
    }
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(markedFieldStyles)
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    return () => {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter((adopted) => adopted !== sheet)
    }
  }, [field, isMarked])
}
