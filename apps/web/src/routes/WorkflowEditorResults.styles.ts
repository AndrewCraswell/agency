import { makeStyles, tokens } from "@fluentui/react-components"

export const useWorkflowEditorResultsStyles = makeStyles({
  root: {
    flexShrink: 0,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1
  },
  header: {
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    paddingRight: tokens.spacingHorizontalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  tabs: {
    flex: 1,
    padding: `0 ${tokens.spacingHorizontalL}`,
    minWidth: 0
  },
  tabLabel: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  panel: {
    minHeight: "180px",
    maxHeight: "260px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    "@media (max-width: 800px)": { minHeight: "132px", maxHeight: "180px", padding: tokens.spacingHorizontalM }
  },
  heading: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalM },
  resultList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    margin: 0,
    padding: 0,
    listStyleType: "none"
  },
  resultButton: { width: "100%", justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal" },
  stepResult: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM
  },
  muted: { color: tokens.colorNeutralForeground3 }
})
