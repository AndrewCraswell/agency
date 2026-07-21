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
    gridTemplateColumns: "minmax(220px, 1.4fr) minmax(140px, 0.8fr) 120px 120px 20px",
    gap: tokens.spacingHorizontalL,
    alignItems: "center",
    minHeight: "68px",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "-2px" },
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr) auto 20px",
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
