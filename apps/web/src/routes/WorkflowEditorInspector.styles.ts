import { makeStyles, shorthands, tokens } from "@fluentui/react-components"

export const useWorkflowEditorInspectorStyles = makeStyles({
  inspector: {
    padding: tokens.spacingHorizontalL,
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    "@media (max-width: 800px)": {
      borderLeft: 0,
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
      maxHeight: "42vh"
    }
  },
  inspectorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalS
  },
  fields: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  hint: { color: tokens.colorNeutralForeground3 },
  advanced: {
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    "& > summary": { cursor: "pointer", padding: tokens.spacingHorizontalS, fontWeight: tokens.fontWeightSemibold },
    "& > div": {
      display: "flex",
      flexDirection: "column",
      gap: tokens.spacingVerticalM,
      padding: tokens.spacingHorizontalS
    }
  }
})
