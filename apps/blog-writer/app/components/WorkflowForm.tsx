import { Form } from "react-router"

export type ActionResult = {
  ok: boolean
  intent: string
  error?: string
  keywordImportOutcome?: "current" | "imported"
  keywordImportForced?: boolean
} | null

export type WorkflowFormProps = {
  intent: string
  children: React.ReactNode
  isBusy: boolean
  identifier?: {
    name: "ideaId" | "draftId" | "articleId" | "recommendationId" | "competitorDomain" | "blogHostname"
    value: string
  }
  /** Asks the action to override the throttle that would otherwise decline this request. */
  force?: boolean
}

export function WorkflowForm({ intent, children, isBusy, identifier, force }: WorkflowFormProps) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      {identifier === undefined ? null : <input type="hidden" name={identifier.name} value={identifier.value} />}
      {force === true ? <input type="hidden" name="force" value="on" /> : null}
      <fieldset disabled={isBusy} style={{ border: 0, margin: 0, padding: 0 }}>
        {children}
      </fieldset>
    </Form>
  )
}
