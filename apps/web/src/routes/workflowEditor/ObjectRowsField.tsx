import { Button, Field, Input } from "@fluentui/react-components"
import { AddRegular, DeleteRegular } from "@fluentui/react-icons"
import { useState } from "react"
import type { JsonValue } from "@/services/api"
import { isJsonValue } from "./DraftJsonField"
import { useObjectRowsFieldStyles } from "./ObjectRowsField.styles"

type ObjectRow = { key: string; value: string }

function objectRows(value: JsonValue | undefined, valueMode: "json" | "text"): ObjectRow[] {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return []
  }
  return Object.entries(value).map(([key, item]) => ({
    key,
    value: valueMode === "text" && typeof item === "string" ? item : JSON.stringify(item)
  }))
}

type ObjectRowsFieldProps = {
  label: string
  keyLabel: string
  valueLabel: string
  value: JsonValue | undefined
  valueMode: "json" | "text"
  onChange: (value: Record<string, JsonValue>) => void
}

export function ObjectRowsField({ label, keyLabel, valueLabel, value, valueMode, onChange }: ObjectRowsFieldProps) {
  const classes = useObjectRowsFieldStyles()
  const [rows, setRows] = useState(() => objectRows(value, valueMode))
  const [error, setError] = useState("")

  function emit(nextRows: ObjectRow[]): void {
    const keys = nextRows.map(({ key }) => key.trim())
    if (keys.some((key) => key === "")) {
      setError(`Enter a ${keyLabel.toLowerCase()} for every row.`)
      return
    }
    if (new Set(keys).size !== keys.length) {
      setError(`${keyLabel} values must be unique.`)
      return
    }
    const nextValue: Record<string, JsonValue> = {}
    try {
      for (const [index, row] of nextRows.entries()) {
        const parsed: unknown = valueMode === "text" ? row.value : JSON.parse(row.value)
        if (!isJsonValue(parsed)) {
          throw new Error()
        }
        nextValue[keys[index]] = parsed
      }
    } catch {
      setError(`Enter valid JSON in every ${valueLabel.toLowerCase()} field.`)
      return
    }
    setError("")
    onChange(nextValue)
  }

  function updateRow(index: number, patch: Partial<ObjectRow>): void {
    const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    setRows(nextRows)
    emit(nextRows)
  }

  function removeRow(index: number): void {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
    setRows(nextRows)
    emit(nextRows)
  }

  return (
    <fieldset className={classes.fieldset}>
      <legend>{label}</legend>
      {rows.map((row, index) => (
        <div className={classes.row} key={`${index}:${row.key}`}>
          <Field label={keyLabel} validationState={error !== "" && row.key.trim() === "" ? "error" : "none"}>
            <Input value={row.key} onChange={(_, data) => updateRow(index, { key: data.value })} />
          </Field>
          <Field label={valueLabel}>
            <Input value={row.value} onChange={(_, data) => updateRow(index, { value: data.value })} />
          </Field>
          <Button
            appearance="subtle"
            icon={<DeleteRegular />}
            aria-label={`Remove ${row.key || `row ${index + 1}`}`}
            onClick={() => removeRow(index)}
          />
        </div>
      ))}
      {error === "" ? null : (
        <span className={classes.error} role="alert">
          {error}
        </span>
      )}
      <Button
        icon={<AddRegular />}
        onClick={() => setRows((current) => [...current, { key: "", value: valueMode === "text" ? "" : "null" }])}
      >
        Add row
      </Button>
    </fieldset>
  )
}
