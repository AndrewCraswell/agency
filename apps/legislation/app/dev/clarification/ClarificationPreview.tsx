"use client"

import { useState } from "react"
import { ClarificationQuestion } from "../../components/chat/ClarificationQuestion"
import { Button } from "../../components/ui/button"
import { clarificationRequestSchema, type ClarificationInput, type ClarificationRequest } from "../../lib/clarification"

const options = [
  { id: "washington", label: "Washington", description: "Washington State Legislature" },
  { id: "colorado", label: "Colorado", description: "Colorado General Assembly" }
]
const inputs: Record<ClarificationInput["kind"], ClarificationInput> = {
  single: {
    kind: "single",
    question: "Which jurisdiction should this research cover?",
    allowSkip: true,
    allowFreeText: true,
    options
  },
  multiple: {
    kind: "multiple",
    question: "Which jurisdictions would you like to compare?",
    allowSkip: true,
    allowFreeText: true,
    options,
    minSelections: 2,
    maxSelections: 2
  },
  text: { kind: "text", question: "What would you like to understand about this policy?", allowSkip: false }
}

export function ClarificationPreview() {
  const [kind, setKind] = useState<ClarificationInput["kind"]>("single")
  const [state, setState] = useState<ClarificationRequest["state"]>("pending")
  const [revision, setRevision] = useState(1)
  const [hasFailure, setHasFailure] = useState(false)
  const request = clarificationRequestSchema.parse({
    id: "4f659fde-e05f-45fb-8598-e8e5d26627ca",
    revision,
    state,
    input: inputs[kind]
  })

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-5 py-8">
      <header className="space-y-4 border-b pb-6">
        <h1 className="font-display text-3xl">Clarification preview</h1>
        <p className="text-sm text-muted-foreground">
          Development fixtures. No model or research API requests are made.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-sm">
            Input type
            <select
              value={kind}
              className="rounded-sm border bg-card p-2"
              onChange={(event) => {
                const value = event.target.value
                if (value === "single" || value === "multiple" || value === "text") {
                  setKind(value)
                  setRevision(revision + 1)
                }
              }}
            >
              <option value="single">Single choice</option>
              <option value="multiple">Multiple choice</option>
              <option value="text">Free text</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            State
            <select
              value={state}
              className="rounded-sm border bg-card p-2"
              onChange={(event) => setState(clarificationRequestSchema.shape.state.parse(event.target.value))}
            >
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="superseded">Superseded</option>
              <option value="answered">Answered</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <Button variant="outline" onClick={() => setRevision(revision + 1)}>
            Reset
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasFailure} onChange={(event) => setHasFailure(event.target.checked)} />
          Simulate a failed response
        </label>
      </header>
      <ClarificationQuestion
        request={request}
        onAnswer={() => {
          if (hasFailure) {
            return Promise.reject(new Error("Preview failure"))
          }
          return Promise.resolve()
        }}
      />
    </main>
  )
}
