import { makeStyles, tokens } from "@fluentui/react-components"

export const useWorkflowEditorOutlineStyles = makeStyles({
  root: {
    height: "100%",
    overflowY: "auto",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXXL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 800px)": { padding: tokens.spacingHorizontalM }
  },
  list: {
    maxWidth: "840px",
    margin: "0 auto",
    padding: 0,
    listStyleType: "none",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS
  },
  item: {
    minWidth: 0,
    paddingLeft: `calc(var(--outline-depth, 0) * ${tokens.spacingHorizontalXL})`,
    "@media (max-width: 800px)": {
      paddingLeft: `calc(min(var(--outline-depth, 0), 3) * ${tokens.spacingHorizontalM})`
    }
  },
  step: {
    width: "100%",
    minHeight: "56px",
    display: "grid",
    gridTemplateColumns: "32px minmax(0, 1fr) max-content",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    textAlign: "left",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "2px" },
    "@media (max-width: 520px)": { gridTemplateColumns: "28px minmax(0, 1fr)" }
  },
  selected: {
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
    boxShadow: tokens.shadow4
  },
  index: { color: tokens.colorNeutralForeground3, fontVariantNumeric: "tabular-nums" },
  copy: { minWidth: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  description: { color: tokens.colorNeutralForeground3 },
  badges: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalXS,
    "@media (max-width: 520px)": { gridColumn: "2", justifyContent: "flex-start" }
  },
  relationships: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM} 0 44px`
  },
  relationship: { height: "28px" },
  relationSummary: { color: tokens.colorNeutralForeground3 }
})
