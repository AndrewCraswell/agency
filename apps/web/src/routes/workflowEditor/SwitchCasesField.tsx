import { Button, Field, Input, Select } from "@fluentui/react-components"
import { AddRegular, DeleteRegular } from "@fluentui/react-icons"
import { useState } from "react"
import type { JsonValue } from "@/services/api"
import { isJsonValue } from "./DraftJsonField"
import { useSwitchCasesFieldStyles } from "./SwitchCasesField.styles"

const operators = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "exists",
  "truthy"
] as const
type CaseRow = { key: string; path: string; operator: string; value: string }

function caseRows(value: JsonValue | undefined): CaseRow[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item) => {
    if (item === null || Array.isArray(item) || typeof item !== "object") {
      return []
    }
    const when = item.when
    if (when === null || when === undefined || Array.isArray(when) || typeof when !== "object") {
      return []
    }
    const path = Array.isArray(when.path)
      ? when.path.filter((part): part is string => typeof part === "string").join(".")
      : ""
    return [
      {
        key: typeof item.key === "string" ? item.key : "",
        path,
        operator: typeof when.operator === "string" ? when.operator : "truthy",
        value: JSON.stringify(when.value ?? null)
      }
    ]
  })
}

export function SwitchCasesField({
  value,
  onChange
}: {
  value: JsonValue | undefined
  onChange: (value: JsonValue[]) => void
}) {
  const classes = useSwitchCasesFieldStyles()
  const [rows, setRows] = useState(() => caseRows(value))
  const [error, setError] = useState("")

  function emit(nextRows: CaseRow[]): void {
    if (nextRows.some((row) => row.key.trim() === "" || row.path.trim() === "")) {
      setError("Enter a branch key and input path for every case.")
      return
    }
    const cases: JsonValue[] = []
    try {
      for (const row of nextRows) {
        const when: Record<string, JsonValue> = {
          path: row.path
            .split(".")
            .map((part) => part.trim())
            .filter(Boolean),
          operator: row.operator
        }
        if (row.operator !== "exists" && row.operator !== "truthy") {
          const parsed: unknown = JSON.parse(row.value)
          if (!isJsonValue(parsed)) {
            throw new Error()
          }
          when.value = parsed
        }
        cases.push({ key: row.key.trim(), when })
      }
    } catch {
      setError("Enter a valid JSON comparison value for every case.")
      return
    }
    setError("")
    onChange(cases)
  }

  function update(index: number, patch: Partial<CaseRow>): void {
    const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    setRows(nextRows)
    emit(nextRows)
  }

  return (
    <fieldset className={classes.fieldset}>
      <legend>Cases</legend>
      {rows.map((row, index) => (
        <div className={classes.case} key={`${index}:${row.key}`}>
          <div className={classes.row}>
            <Field label="Branch key">
              <Input value={row.key} onChange={(_, data) => update(index, { key: data.value })} />
            </Field>
            <Field label="Input path">
              <Input value={row.path} onChange={(_, data) => update(index, { path: data.value })} />
            </Field>
            <Button
              appearance="subtle"
              icon={<DeleteRegular />}
              aria-label={`Remove case ${row.key || index + 1}`}
              onClick={() => {
                const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
                setRows(nextRows)
                emit(nextRows)
              }}
            />
          </div>
          <Field label="Operator">
            <Select value={row.operator} onChange={(_, data) => update(index, { operator: data.value })}>
              {operators.map((operator) => (
                <option key={operator} value={operator}>
                  {operator.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          {row.operator === "exists" || row.operator === "truthy" ? null : (
            <Field label="Comparison value">
              <Input value={row.value} onChange={(_, data) => update(index, { value: data.value })} />
            </Field>
          )}
        </div>
      ))}
      {error === "" ? null : (
        <span className={classes.error} role="alert">
          {error}
        </span>
      )}
      <Button
        icon={<AddRegular />}
        onClick={() => setRows((current) => [...current, { key: "", path: "", operator: "truthy", value: "null" }])}
      >
        Add case
      </Button>
    </fieldset>
  )
}
