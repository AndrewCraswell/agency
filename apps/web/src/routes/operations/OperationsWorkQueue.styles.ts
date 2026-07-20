import { makeStyles, tokens } from "@fluentui/react-components"

export const useOperationsWorkQueueStyles = makeStyles({
  view: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    padding: `${tokens.spacingVerticalXL} clamp(20px, 4vw, 64px) ${tokens.spacingVerticalXXL}`
  },
  heading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: tokens.spacingHorizontalL,
    "& > div": { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS }
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 2fr) repeat(5, minmax(140px, 1fr)) auto",
    gap: tokens.spacingHorizontalM,
    alignItems: "end",
    "@media (max-width: 1100px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
    "@media (max-width: 640px)": { gridTemplateColumns: "1fr" }
  },
  searchField: { minWidth: 0 },
  clearButton: { alignSelf: "end" },
  tableSurface: {
    minHeight: "280px",
    overflowX: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  table: { minWidth: "1040px" },
  loading: { minHeight: "280px" },
  workItemCell: { display: "flex", alignItems: "start", gap: tokens.spacingHorizontalXS, minWidth: 0 },
  workItemIdentity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  description: { color: tokens.colorNeutralForeground2, maxWidth: "440px", whiteSpace: "normal" },
  actions: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, minWidth: "116px" },
  empty: {
    minHeight: "280px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalXS,
    color: tokens.colorNeutralForeground2
  },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalM
  },
  paginationActions: { display: "flex", gap: tokens.spacingHorizontalS },
  dialogContent: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL }
})
