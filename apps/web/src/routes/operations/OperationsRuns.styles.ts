import { makeStyles, tokens } from "@fluentui/react-components"

export const useOperationsRunsStyles = makeStyles({
  view: { padding: `${tokens.spacingVerticalXL} clamp(20px, 4vw, 64px) ${tokens.spacingVerticalXXL}` },
  heading: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    marginBottom: tokens.spacingVerticalM
  },
  list: { margin: 0, padding: 0, listStyleType: "none", borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.4fr) minmax(180px, 1fr) 120px 120px",
    gap: tokens.spacingHorizontalL,
    alignItems: "center",
    minHeight: "68px",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      "& > :nth-child(2), & > :nth-child(4)": { display: "none" }
    }
  },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  secondary: {
    color: tokens.colorNeutralForeground2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  empty: { paddingBlock: tokens.spacingVerticalXXL, color: tokens.colorNeutralForeground3 }
})
