import { makeStyles, tokens } from "@fluentui/react-components"

export const useOperationsOverviewStyles = makeStyles({
  view: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXL,
    paddingBlock: tokens.spacingVerticalXL
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingInline: "clamp(20px, 4vw, 64px)",
    "& > div": {
      display: "flex",
      flexDirection: "column",
      gap: tokens.spacingVerticalXXS,
      paddingBlock: tokens.spacingVerticalL
    },
    "& strong": { fontSize: tokens.fontSizeBase600, lineHeight: tokens.lineHeightBase600 },
    "& span": { color: tokens.colorNeutralForeground2 },
    "@media (max-width: 720px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }
  },
  section: { paddingInline: "clamp(20px, 4vw, 64px)" },
  heading: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    marginBottom: tokens.spacingVerticalM
  }
})
