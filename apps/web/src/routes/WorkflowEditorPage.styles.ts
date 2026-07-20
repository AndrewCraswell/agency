import { makeStyles, tokens } from "@fluentui/react-components"

export const useWorkflowEditorPageStyles = makeStyles({
  screenReaderHeading: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0
  },
  page: {
    height: "100vh",
    minHeight: "680px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    "@media (max-width: 800px)": { height: "calc(100dvh - 52px)", minHeight: "620px", overflow: "hidden" }
  },
  toolbar: {
    minHeight: "112px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gridTemplateRows: "auto auto",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalS,
    alignItems: "center",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 1100px)": { gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "auto" },
    "@media (max-width: 800px)": {
      minHeight: "auto",
      gap: tokens.spacingVerticalS,
      padding: tokens.spacingHorizontalS
    }
  },
  identity: {
    display: "grid",
    gridTemplateColumns: "32px minmax(0, 1fr)",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
    minWidth: 0
  },
  identityFields: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 320px) minmax(240px, 1fr)",
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
    "@media (max-width: 800px)": { gridTemplateColumns: "minmax(0, 1fr)" }
  },
  nameInput: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  descriptionInput: { minWidth: 0 },
  statusCluster: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
    "@media (max-width: 1100px)": { justifyContent: "flex-start" },
    "@media (max-width: 800px)": { flexWrap: "wrap" }
  },
  commandArea: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
    minWidth: 0,
    "@media (max-width: 800px)": { alignItems: "flex-start", flexDirection: "column-reverse", gap: 0 }
  },
  actions: {
    justifyContent: "flex-end",
    flexWrap: "nowrap",
    width: "100%",
    maxWidth: "100%",
    paddingBottom: tokens.spacingVerticalXXS,
    "& > *": { flexShrink: 0 },
    "@media (max-width: 800px)": { justifyContent: "flex-start" }
  },
  commandHint: { color: tokens.colorNeutralForeground2 },
  viewBar: {
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `0 ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2
  },
  viewControls: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM },
  workspace: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)"
  },
  workspaceCatalog: {
    gridTemplateColumns: "320px minmax(0, 1fr)",
    "@media (max-width: 800px)": { gridTemplateColumns: "minmax(0, 1fr)" }
  },
  workspaceDock: {
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    "@media (max-width: 800px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateRows: "minmax(260px, 1fr) minmax(220px, 42vh)"
    }
  },
  workspaceCatalogDock: {
    gridTemplateColumns: "320px minmax(0, 1fr) 320px",
    "@media (max-width: 1100px)": { gridTemplateColumns: "280px minmax(0, 1fr) 300px" },
    "@media (max-width: 800px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateRows: "minmax(260px, 1fr) minmax(220px, 42vh)"
    }
  },
  surface: {
    position: "relative",
    minWidth: 0,
    minHeight: 0,
    backgroundColor: tokens.colorNeutralBackground3,
    "& .react-flow__attribution a": { color: tokens.colorNeutralForeground1 },
    "@media (max-width: 800px)": { minHeight: "260px" }
  },
  surfaceHidden: { display: "none" },
  hint: { color: tokens.colorNeutralForeground3 },
  node: { width: "220px", minHeight: "78px", overflow: "visible" },
  nodeSelected: { outline: `2px solid ${tokens.colorBrandStroke1}`, boxShadow: tokens.shadow8 },
  nodeHeader: { minWidth: 0 },
  nodeIcon: { fontSize: "20px", color: tokens.colorBrandForeground1 },
  nodeCopy: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  nodeKind: { color: tokens.colorNeutralForeground3, textTransform: "uppercase" },
  catalogPanel: {
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalM,
    overflow: "hidden",
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 800px)": {
      position: "absolute",
      inset: 0,
      zIndex: 6,
      borderRight: 0
    }
  },
  catalogHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS
  },
  catalogHeaderCopy: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS
  },
  catalogSections: { minHeight: 0, overflowY: "auto" },
  catalogList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    overflowY: "auto",
    margin: 0,
    padding: 0,
    listStyleType: "none"
  },
  catalogListItem: { width: "100%" },
  catalogItem: {
    height: "auto",
    width: "100%",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS
  },
  catalogItemCopy: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    textAlign: "left",
    whiteSpace: "normal"
  },
  catalogEmpty: { padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3 },
  outline: { overflowY: "auto", padding: 0, backgroundColor: tokens.colorNeutralBackground1 },
  outlineList: {
    maxWidth: "840px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS
  }
})
