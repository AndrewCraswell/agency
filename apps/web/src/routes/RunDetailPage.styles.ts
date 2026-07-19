import { makeStyles, shorthands, tokens } from "@fluentui/react-components"

export const useRunDetailPageStyles = makeStyles({
  page: {
    minHeight: "100%",
    backgroundColor: tokens.colorNeutralBackground2,
    padding: `${tokens.spacingVerticalL} clamp(20px, 6vw, 96px) ${tokens.spacingVerticalXXL}`
  },
  toolbar: { display: "flex", justifyContent: "space-between", marginBottom: tokens.spacingVerticalXL },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorBrandForeground1,
    textDecorationLine: "none",
    fontWeight: tokens.fontWeightSemibold
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXL,
    "@media (max-width: 640px)": { flexDirection: "column" }
  },
  headerIdentity: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: tokens.spacingVerticalXXS,
    minWidth: 0
  },
  eyebrow: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  runId: { fontFamily: tokens.fontFamilyMonospace, color: tokens.colorNeutralForeground2, wordBreak: "break-all" },
  stageSection: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    padding: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL
  },
  stageList: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(80px, 1fr))",
    listStyleType: "none",
    padding: 0,
    margin: `${tokens.spacingVerticalL} 0 0`,
    overflowX: "auto"
  },
  stageItem: {
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    textTransform: "capitalize",
    minWidth: "80px",
    "& span": {
      display: "grid",
      placeItems: "center",
      width: "28px",
      height: "28px",
      ...shorthands.borderRadius(tokens.borderRadiusCircular)
    }
  },
  stageComplete: {
    color: tokens.colorBrandForeground1,
    "& span": { backgroundColor: tokens.colorBrandBackground2, color: tokens.colorBrandForeground1 }
  },
  stageCurrent: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    "& span": {
      backgroundColor: tokens.colorBrandBackground,
      color: tokens.colorNeutralForegroundOnBrand,
      boxShadow: `0 0 0 3px ${tokens.colorBrandBackground2}`
    }
  },
  stagePending: {
    color: tokens.colorNeutralForeground3,
    "& span": { backgroundColor: tokens.colorNeutralBackground4 }
  },
  details: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalL,
    padding: `${tokens.spacingVerticalL} 0`,
    margin: `0 0 ${tokens.spacingVerticalXL}`,
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    "& > div": { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
    "& dt, & dd": { margin: 0 },
    "@media (max-width: 640px)": { gridTemplateColumns: "1fr", gap: tokens.spacingVerticalM }
  },
  workflowSection: { marginBottom: tokens.spacingVerticalXXL },
  workflowNodes: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(168px, 1fr))",
    gap: tokens.spacingHorizontalM,
    listStyleType: "none",
    padding: `0 0 ${tokens.spacingVerticalXS}`,
    margin: 0,
    overflowX: "auto"
  },
  workflowNode: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    minHeight: "168px",
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    "& > strong": { fontSize: tokens.fontSizeBase400 },
    "& > span:last-child": { color: tokens.colorNeutralForeground2 }
  },
  workflowNodeActive: {
    boxShadow: `inset 0 3px 0 ${tokens.colorBrandBackground}`
  },
  workflowNodeHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: "32px"
  },
  workflowNodeIcon: {
    display: "grid",
    placeItems: "center",
    width: "32px",
    height: "32px",
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    "& svg": { fontSize: "18px" }
  },
  workflowAgent: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  routeHeading: { display: "block", marginTop: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalS },
  workflowRoutes: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: tokens.spacingHorizontalS,
    listStyleType: "none",
    padding: 0,
    margin: 0,
    "& > li": {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(104px, auto) minmax(0, 1fr)",
      alignItems: "center",
      gap: tokens.spacingHorizontalS,
      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
      backgroundColor: tokens.colorNeutralBackground1,
      ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
      ...shorthands.borderRadius(tokens.borderRadiusMedium),
      "& > strong:last-child": { textAlign: "right" }
    }
  },
  workflowTransition: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground2,
    textAlign: "center",
    "& svg": { fontSize: "18px", color: tokens.colorBrandForeground1 }
  },
  timelineSection: { maxWidth: "960px" },
  sectionHeading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalM,
    "& > div": { display: "flex", flexDirection: "column" }
  },
  timeline: {
    listStyleType: "none",
    padding: 0,
    margin: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    overflow: "hidden",
    "& > li": {
      position: "relative",
      display: "grid",
      gridTemplateColumns: "20px minmax(0, 1fr)",
      gap: tokens.spacingHorizontalM,
      padding: tokens.spacingHorizontalL,
      ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2)
    }
  },
  timelineMarker: {
    width: "10px",
    height: "10px",
    marginTop: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorBrandBackground,
    ...shorthands.borderRadius(tokens.borderRadiusCircular)
  },
  eventBody: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, minWidth: 0 },
  eventHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalM
  },
  traceReference: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
    marginTop: tokens.spacingVerticalXS,
    "& code": { fontFamily: tokens.fontFamilyMonospace, color: tokens.colorNeutralForeground2, wordBreak: "break-all" }
  },
  emptyState: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalL,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    "& > svg": { flexShrink: 0, fontSize: "24px" },
    "& > div": { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS }
  }
})
