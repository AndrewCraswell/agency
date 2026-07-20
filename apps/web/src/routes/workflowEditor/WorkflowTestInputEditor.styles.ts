import { makeStyles, tokens } from "@fluentui/react-components"

export const useWorkflowTestInputEditorStyles = makeStyles({
  editor: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  fields: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }
})
