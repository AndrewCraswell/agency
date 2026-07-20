import { Field, Textarea } from "@fluentui/react-components"
import { useState } from "react"
import type { JsonValue } from "@/services/api"

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue)
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue)
  }
  return false
}

type DraftJsonFieldProps = {
  label: string
  value: JsonValue
  onChange: (value: JsonValue) => void
  hint?: string
  invalidMessage?: string
}

export function DraftJsonField({
  label,
  value,
  onChange,
  hint,
  invalidMessage = "Enter valid JSON."
}: DraftJsonFieldProps) {
  const serializedValue = JSON.stringify(value, null, 2)
  const [text, setText] = useState(serializedValue)
  const [error, setError] = useState("")

  function update(nextText: string): void {
    setText(nextText)
    try {
      const parsed: unknown = JSON.parse(nextText)
      if (!isJsonValue(parsed)) {
        throw new Error(invalidMessage)
      }
      setError("")
      onChange(parsed)
    } catch {
      setError(invalidMessage)
    }
  }

  return (
    <Field label={label} hint={hint} validationState={error === "" ? "none" : "error"} validationMessage={error}>
      <Textarea resize="vertical" value={text} onChange={(_, data) => update(data.value)} />
    </Field>
  )
}
