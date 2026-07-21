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
  runActions: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  eyebrow: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  runId: { fontFamily: tokens.fontFamilyMonospace, color: tokens.colorNeutralForeground2, wordBreak: "break-all" },
  summary: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXL,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderLeft("4px", "solid", tokens.colorBrandStroke1),
    boxShadow: tokens.shadow4
  },
  recoverySection: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  unavailableReason: { color: tokens.colorNeutralForeground3 },
  recoveryActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: tokens.spacingHorizontalM,
    listStyleType: "none",
    padding: 0,
    margin: 0,
    "& > li": {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: tokens.spacingVerticalXS,
      minWidth: 0
    }
  },
  stepProgress: { marginBottom: tokens.spacingVerticalXL },
  stepList: {
    display: "flex",
    flexDirection: "column",
    listStyleType: "none",
    padding: 0,
    margin: 0
  },
  stepItem: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "32px minmax(0, 1fr)",
    gap: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalL,
    "&:not(:last-child)::before": {
      content: "''",
      position: "absolute",
      top: "32px",
      bottom: 0,
      left: "15px",
      width: "2px",
      backgroundColor: tokens.colorNeutralStroke2
    }
  },
  stepMarker: {
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorBrandBackground,
    fontWeight: tokens.fontWeightSemibold,
    ...shorthands.borderRadius(tokens.borderRadiusCircular)
  },
  stepContent: {
    minWidth: 0,
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium)
  },
  stepHeading: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
    "& > div": { display: "flex", flexDirection: "column" }
  },
  pendingStep: { color: tokens.colorNeutralForeground3 },
  activationTrace: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  attemptTrace: {
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
    "& > summary": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: tokens.spacingHorizontalM,
      padding: `${tokens.spacingVerticalM} 0`,
      cursor: "pointer",
      fontWeight: tokens.fontWeightSemibold
    }
  },
  attemptMeta: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  dataColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalM,
    "& > section": {
      display: "flex",
      flexDirection: "column",
      gap: tokens.spacingVerticalXS,
      minWidth: 0
    },
    "@media (max-width: 720px)": { gridTemplateColumns: "1fr" }
  },
  stepError: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalM,
    color: tokens.colorPaletteRedForeground1
  },
  providerDetails: {
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground2,
    "& > summary": { cursor: "pointer", fontWeight: tokens.fontWeightSemibold },
    "& > div": { paddingTop: tokens.spacingVerticalS }
  },
  jsonBlock: {
    overflowX: "auto",
    maxHeight: "320px",
    margin: 0,
    padding: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  },
  diagnostics: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    "& > summary": {
      display: "flex",
      cursor: "pointer",
      padding: tokens.spacingHorizontalL,
      listStyleType: "none"
    },
    "& > summary::-webkit-details-marker": { display: "none" },
    "& > summary > span": { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
    "&[open] > summary": { ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2) }
  },
  diagnosticsContent: { padding: tokens.spacingHorizontalL },
  subsectionHeading: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    marginBottom: tokens.spacingVerticalM
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
  activationList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: tokens.spacingHorizontalM,
    listStyleType: "none",
    padding: 0,
    margin: 0,
    "& > li": {
      display: "flex",
      flexDirection: "column",
      gap: tokens.spacingVerticalS,
      minWidth: 0,
      padding: tokens.spacingHorizontalM,
      backgroundColor: tokens.colorNeutralBackground1,
      ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
      ...shorthands.borderRadius(tokens.borderRadiusMedium)
    }
  },
  activationRow: {
    display: "grid",
    gridTemplateColumns: "max-content minmax(80px, auto) minmax(0, 1fr) max-content",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
    "& code": { fontFamily: tokens.fontFamilyMonospace },
    "@media (max-width: 640px)": {
      gridTemplateColumns: "max-content minmax(0, 1fr)",
      "& > span:last-child": { gridColumn: "1 / -1" }
    }
  },
  diagnosticGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalXXL,
    "@media (max-width: 800px)": { gridTemplateColumns: "1fr" }
  },
  evidenceSection: {
    minWidth: 0,
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    "& ul": {
      display: "flex",
      flexDirection: "column",
      gap: tokens.spacingVerticalM,
      listStyleType: "none",
      padding: 0,
      margin: 0
    },
    "& li": { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, minWidth: 0 },
    "& details": { color: tokens.colorNeutralForeground2 },
    "& summary": { cursor: "pointer", fontWeight: tokens.fontWeightSemibold },
    "& pre": {
      overflowX: "auto",
      margin: `${tokens.spacingVerticalS} 0 0`,
      padding: tokens.spacingHorizontalS,
      backgroundColor: tokens.colorNeutralBackground3,
      fontFamily: tokens.fontFamilyMonospace,
      fontSize: tokens.fontSizeBase200
    }
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
    },
    "& details": { color: tokens.colorNeutralForeground2 },
    "& summary": { cursor: "pointer", fontWeight: tokens.fontWeightSemibold },
    "& pre": {
      overflowX: "auto",
      margin: `${tokens.spacingVerticalS} 0 0`,
      padding: tokens.spacingHorizontalS,
      backgroundColor: tokens.colorNeutralBackground3,
      fontFamily: tokens.fontFamilyMonospace,
      fontSize: tokens.fontSizeBase200
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
