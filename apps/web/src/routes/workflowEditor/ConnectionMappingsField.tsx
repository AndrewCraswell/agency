import { Button, Field, Input } from "@fluentui/react-components"
import { AddRegular, DeleteRegular } from "@fluentui/react-icons"
import type { WorkflowDraftContent } from "@/services/api"
import { useConnectionMappingsFieldStyles } from "./ConnectionMappingsField.styles"

type Mapping = WorkflowDraftContent["connections"][number]["mappings"][number]
type ConnectionMappingsFieldProps = { value: Mapping[]; onChange: (value: Mapping[]) => void }

function segments(path: string): string[] {
  return path
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
}

export function ConnectionMappingsField({ value, onChange }: ConnectionMappingsFieldProps) {
  const classes = useConnectionMappingsFieldStyles()

  function update(index: number, field: "sourcePath" | "targetPath", path: string): void {
    onChange(
      value.map((mapping, mappingIndex) => (mappingIndex === index ? { ...mapping, [field]: segments(path) } : mapping))
    )
  }

  return (
    <fieldset className={classes.fieldset}>
      <legend>Field mappings</legend>
      {value.map((mapping, index) => (
        <div className={classes.row} key={`${index}:${mapping.sourcePath.join(".")}:${mapping.targetPath.join(".")}`}>
          <Field label="Source path">
            <Input
              value={mapping.sourcePath.join(".")}
              onChange={(_, data) => update(index, "sourcePath", data.value)}
            />
          </Field>
          <Field label="Target path">
            <Input
              value={mapping.targetPath.join(".")}
              onChange={(_, data) => update(index, "targetPath", data.value)}
            />
          </Field>
          <Button
            appearance="subtle"
            icon={<DeleteRegular />}
            aria-label={`Remove mapping ${index + 1}`}
            onClick={() => onChange(value.filter((_, mappingIndex) => mappingIndex !== index))}
          />
        </div>
      ))}
      <Button icon={<AddRegular />} onClick={() => onChange([...value, { sourcePath: [], targetPath: [] }])}>
        Add mapping
      </Button>
    </fieldset>
  )
}
