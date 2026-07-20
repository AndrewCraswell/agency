import { Checkbox, Field, Input, Select, Tab, TabList, Textarea } from "@fluentui/react-components"
import { useState } from "react"
import { arrayIncludes } from "ts-extras"
import type { JsonValue } from "@/services/api"
import { useWorkflowTestInputEditorStyles } from "./WorkflowTestInputEditor.styles"

const inputModes = ["form", "json"] as const
type InputMode = (typeof inputModes)[number]
type PropertyDefinition = {
  name: string
  label: string
  type: "string" | "number" | "integer" | "boolean"
  required: boolean
  options: JsonValue[]
}

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  return value
}

function propertyDefinitions(schema: JsonValue): PropertyDefinition[] {
  const schemaObject = objectValue(schema)
  const properties = objectValue(schemaObject?.properties)
  if (properties === undefined) {
    return []
  }
  const required = Array.isArray(schemaObject?.required)
    ? schemaObject.required.filter((item): item is string => typeof item === "string")
    : []
  return Object.entries(properties).flatMap(([name, rawDefinition]) => {
    const definition = objectValue(rawDefinition)
    const type = definition?.type
    if (
      definition === undefined ||
      (type !== "string" && type !== "number" && type !== "integer" && type !== "boolean")
    ) {
      return []
    }
    const title = definition.title
    const options = Array.isArray(definition.enum) ? definition.enum : []
    return [{ name, label: typeof title === "string" ? title : name, type, required: required.includes(name), options }]
  })
}

function parsedInput(value: string): { parsed: Record<string, JsonValue>; error: string } {
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { parsed: {}, error: "Test input must be a JSON object." }
    }
    const result: Record<string, JsonValue> = {}
    for (const [key, item] of Object.entries(parsed)) {
      if (item !== undefined) {
        result[key] = item
      }
    }
    return { parsed: result, error: "" }
  } catch {
    return { parsed: {}, error: "Enter valid JSON test input." }
  }
}

type WorkflowTestInputEditorProps = {
  schema: JsonValue
  value: string
  onChange: (value: string) => void
}

export function WorkflowTestInputEditor({ schema, value, onChange }: WorkflowTestInputEditorProps) {
  const classes = useWorkflowTestInputEditorStyles()
  const definitions = propertyDefinitions(schema)
  const [mode, setMode] = useState<InputMode>(definitions.length === 0 ? "json" : "form")
  const input = parsedInput(value)

  function updateProperty(definition: PropertyDefinition, rawValue: string | boolean): void {
    const next = { ...input.parsed }
    if (rawValue === "" && !definition.required) {
      delete next[definition.name]
    } else if (definition.type === "boolean") {
      next[definition.name] = Boolean(rawValue)
    } else if (definition.type === "number" || definition.type === "integer") {
      const numberValue = Number(rawValue)
      if (Number.isFinite(numberValue) && (definition.type !== "integer" || Number.isInteger(numberValue))) {
        next[definition.name] = numberValue
      }
    } else {
      next[definition.name] = String(rawValue)
    }
    onChange(JSON.stringify(next, null, 2))
  }

  function propertyControl(definition: PropertyDefinition) {
    const currentValue = input.parsed[definition.name]
    if (definition.type === "boolean") {
      return (
        <Checkbox
          checked={currentValue === true}
          onChange={(_, data) => updateProperty(definition, data.checked === true)}
        />
      )
    }
    if (definition.options.length > 0) {
      return (
        <Select
          value={typeof currentValue === "string" || typeof currentValue === "number" ? String(currentValue) : ""}
          onChange={(_, data) => updateProperty(definition, data.value)}
        >
          {!definition.required ? <option value="">Not set</option> : null}
          {definition.options.map((option) => (
            <option key={JSON.stringify(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </Select>
      )
    }
    const inputType = definition.type === "string" ? "text" : "number"
    const step = definition.type === "integer" ? 1 : undefined
    return (
      <Input
        type={inputType}
        step={step}
        value={typeof currentValue === "string" || typeof currentValue === "number" ? String(currentValue) : ""}
        onChange={(_, data) => updateProperty(definition, data.value)}
      />
    )
  }

  return (
    <section className={classes.editor} aria-label="Test input">
      {definitions.length > 0 ? (
        <TabList
          size="small"
          selectedValue={mode}
          onTabSelect={(_, data) => {
            if (typeof data.value === "string" && arrayIncludes(inputModes, data.value)) {
              setMode(data.value)
            }
          }}
          aria-label="Test input mode"
        >
          <Tab value="form">Form</Tab>
          <Tab value="json">Advanced JSON</Tab>
        </TabList>
      ) : null}
      {mode === "form" ? (
        <div className={classes.fields}>
          {definitions.map((definition) => (
            <Field key={definition.name} label={definition.label} required={definition.required}>
              {propertyControl(definition)}
            </Field>
          ))}
        </div>
      ) : (
        <Field
          label="Test input JSON"
          validationState={input.error === "" ? "none" : "error"}
          validationMessage={input.error}
        >
          <Textarea resize="vertical" value={value} onChange={(_, data) => onChange(data.value)} />
        </Field>
      )}
    </section>
  )
}
