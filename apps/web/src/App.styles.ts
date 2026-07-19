import { makeStyles, shorthands, tokens } from "@fluentui/react-components"

export const useAppStyles = makeStyles({
  page: { minHeight: "100%", backgroundColor: tokens.colorNeutralBackground2, color: tokens.colorNeutralForeground1 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: tokens.spacingHorizontalXL,
    padding: `${tokens.spacingVerticalXXL} clamp(20px, 4vw, 64px) ${tokens.spacingVerticalXL}`,
    "@media (max-width: 720px)": { alignItems: "flex-start", flexDirection: "column" }
  },
  headerCopy: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
  eyebrow: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold, letterSpacing: "0" },
  subtitle: { color: tokens.colorNeutralForeground2, marginTop: tokens.spacingVerticalXS },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
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
  agentsSection: { padding: `${tokens.spacingVerticalXL} clamp(20px, 4vw, 64px) 0` },
  boardSection: { padding: `${tokens.spacingVerticalXL} clamp(20px, 4vw, 64px) ${tokens.spacingVerticalXXL}` },
  sectionHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacingVerticalM,
    "& > div": { display: "flex", flexDirection: "column" }
  },
  sectionIcon: { fontSize: "24px", color: tokens.colorBrandForeground1 },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(260px, 1fr))",
    gap: tokens.spacingHorizontalM,
    overflowX: "auto",
    paddingBottom: tokens.spacingVerticalS
  },
  column: {
    minWidth: "220px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    padding: tokens.spacingHorizontalS
  },
  columnHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: "44px",
    paddingInline: tokens.spacingHorizontalXS
  },
  taskList: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minHeight: "140px" },
  taskCard: {
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow2,
    backgroundColor: tokens.colorNeutralBackground1
  },
  identifier: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold
  },
  taskTitle: { display: "block", marginTop: tokens.spacingVerticalXS, lineHeight: tokens.lineHeightBase400 },
  description: {
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: tokens.colorNeutralForeground2
  },
  cardFooter: { justifyContent: "space-between", marginTop: tokens.spacingVerticalS },
  runLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorBrandForeground1,
    textDecorationLine: "none",
    fontWeight: tokens.fontWeightSemibold
  },
  externalRunStatus: { color: tokens.colorNeutralForeground3, textAlign: "right" },
  empty: {
    display: "block",
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingHorizontalM,
    textAlign: "center"
  },
  agentList: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    overflow: "hidden"
  },
  agentRow: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1fr) 140px 120px 20px",
    gap: tokens.spacingHorizontalM,
    alignItems: "center",
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr) 20px",
      "& > :nth-child(2), & > :nth-child(3)": { display: "none" }
    }
  },
  agentIdentity: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    "& small": { color: tokens.colorNeutralForeground2, overflow: "hidden", textOverflow: "ellipsis" }
  },
  stage: { color: tokens.colorNeutralForeground2, textTransform: "capitalize" }
})
