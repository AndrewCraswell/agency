import { useEffect, useState } from "react"
import { AutoHeightFrame } from "../app/components/AutoHeightFrame.tsx"
import { type BrowserPreview, previewVariation, templateOf } from "./browserPreview.ts"
import "./templatePreview.css"

/* Stand-in identities, the same ones the preview viewer shows. A real send substitutes them. */
const FROM_ADDRESS = "support@store.com"
const TO_ADDRESS = "customer@gmail.com"

export type TemplatePreviewProps = {
  /** Registry id of the template, for example `order_confirmation`. */
  templateId: string
  /** Registry id of the variation, for example `standard`. */
  variationId: string
}

/* Carrying the request key alongside the outcome is what lets a switch read as pending without a reset render. */
type PreviewState = { key: string; rendered: BrowserPreview } | { key: string; failure: string }

/**
 * Renders one template variation the way a customer receives it. The Liquid is rendered in the
 * browser from sources Vite inlined, so a built Storybook needs no server behind it.
 */
export function TemplatePreview({ templateId, variationId }: TemplatePreviewProps) {
  const [state, setState] = useState<PreviewState>()
  const key = `${templateId}/${variationId}`

  useEffect(() => {
    let current = true
    previewVariation(templateId, variationId).then(
      (rendered) => {
        if (current) {
          setState({ key, rendered })
        }
      },
      (error: unknown) => {
        if (current) {
          setState({ key, failure: error instanceof Error ? error.message : String(error) })
        }
      }
    )
    return () => {
      current = false
    }
  }, [key, templateId, variationId])

  if (state?.key !== key) {
    return null
  }
  if ("failure" in state) {
    return <p className="template-preview__error">{state.failure}</p>
  }

  const isPrintout = templateOf(templateId).type === "printout"

  return (
    <div className={isPrintout ? "template-preview template-preview--printout" : "template-preview"}>
      {isPrintout ? null : (
        <div className="template-preview__head">
          <p className="template-preview__subject">{state.rendered.subject}</p>
          <dl className="template-preview__fields">
            <dt>From</dt>
            <dd>{FROM_ADDRESS}</dd>
            <dt>To</dt>
            <dd>{TO_ADDRESS}</dd>
          </dl>
        </div>
      )}
      <div className="template-preview__body">
        <AutoHeightFrame
          className="template-preview__frame"
          srcDoc={state.rendered.document}
          title={`${templateId} ${variationId}`}
        />
      </div>
    </div>
  )
}
