import { makeStyles, tokens } from "@fluentui/react-components"

export const useAppStyles = makeStyles({
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: "100%",
    overflow: "hidden",
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground2,
    backgroundImage: `radial-gradient(circle at 20% 0%, ${tokens.colorBrandBackground2} 0, transparent 28rem)`,
    "@media (max-width: 800px)": {
      height: "auto",
      overflow: "visible"
    }
  },
  header: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: tokens.spacingHorizontalL,
    alignItems: "end",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`
    }
  },
  eyebrow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorBrandForeground1
  },
  headline: {
    maxWidth: "680px",
    fontFamily: "Georgia, Cambria, serif",
    fontSize: "clamp(1.5rem, 2vw, 2.25rem)",
    lineHeight: "1.08",
    letterSpacing: "-0.02em"
  },
  intro: {
    maxWidth: "720px",
    marginTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(96px, 1fr))",
    gap: tokens.spacingHorizontalS
  },
  metric: {
    minWidth: "112px",
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackgroundAlpha,
    backdropFilter: "blur(12px)",
    "@media (max-width: 560px)": {
      minWidth: 0,
      padding: tokens.spacingHorizontalS
    }
  },
  metricValue: {
    display: "block",
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase500,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums"
  },
  metricLabel: { color: tokens.colorNeutralForeground3 },
  commandBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXXL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 900px)": {
      alignItems: "flex-start",
      flexDirection: "column",
      padding: tokens.spacingHorizontalM
    }
  },
  connectionSample: {
    width: "28px",
    height: "3px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusCircular
  },
  requiresSample: { backgroundColor: tokens.colorBrandStroke1 },
  supportsSample: {
    height: 0,
    borderTop: `3px dotted ${tokens.colorPaletteMarigoldBorderActive}`
  },
  resourceSample: { backgroundColor: tokens.colorPaletteBerryBorderActive },
  workspace: {
    display: "grid",
    flex: "1 1 auto",
    gridTemplateColumns: "minmax(0, 1fr) 380px",
    minHeight: 0,
    "@media (max-width: 1050px)": {
      gridTemplateColumns: "minmax(0, 1fr) 340px"
    },
    "@media (max-width: 800px)": {
      height: "auto",
      minHeight: 0,
      gridTemplateColumns: "minmax(0, 1fr)"
    }
  },
  canvasShell: {
    position: "relative",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground3
  },
  canvas: {
    width: "100%",
    height: "100%",
    minHeight: "620px",
    "& .react-flow__attribution": { display: "none" },
    "& .react-flow__controls": {
      overflow: "hidden",
      borderRadius: tokens.borderRadiusMedium,
      boxShadow: tokens.shadow8
    },
    "& .react-flow__edge-path": {
      transitionProperty: "opacity, stroke-width",
      transitionDuration: tokens.durationNormal
    },
    "& .react-flow__node": {
      cursor: "grab"
    },
    "& .react-flow__node.dragging": {
      cursor: "grabbing"
    }
  },
  storyCard: {
    position: "fixed",
    zIndex: 12,
    top: tokens.spacingVerticalL,
    left: tokens.spacingHorizontalL,
    width: "min(360px, calc(100vw - 32px))",
    maxWidth: "360px",
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorBrandStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    transitionProperty: "left, top",
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveEasyEase
  },
  storySpotlight: {
    position: "fixed",
    zIndex: 11,
    pointerEvents: "none",
    border: `3px solid ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: `0 0 0 5px ${tokens.colorBrandBackground2}, 0 0 0 9999px rgb(0 0 0 / 8%)`,
    transitionProperty: "left, top, width, height",
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveEasyEase
  },
  storyTopline: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    marginBottom: tokens.spacingVerticalXS,
    color: tokens.colorBrandForeground1
  },
  storyTitle: {
    display: "block",
    marginBottom: tokens.spacingVerticalXS,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold
  },
  storyBody: {
    display: "block",
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300
  },
  storyActions: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
    marginTop: tokens.spacingVerticalM
  },
  storyProgress: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalM
  },
  storyProgressStep: {
    width: "20px",
    height: "4px",
    padding: 0,
    border: 0,
    borderRadius: tokens.borderRadiusCircular,
    cursor: "pointer",
    backgroundColor: tokens.colorNeutralStroke1,
    transitionProperty: "width, background-color",
    transitionDuration: tokens.durationNormal,
    ":hover": {
      backgroundColor: tokens.colorBrandStroke2
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "2px"
    }
  },
  storyProgressStepActive: {
    width: "34px",
    backgroundColor: tokens.colorBrandBackground
  },
  graphLoading: {
    position: "absolute",
    zIndex: 5,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3
  },
  graphLoadingMark: {
    width: "20px",
    height: "20px",
    border: `3px solid ${tokens.colorBrandBackground2}`,
    borderTopColor: tokens.colorBrandBackground,
    borderRadius: tokens.borderRadiusCircular,
    animationName: {
      from: { transform: "rotate(0deg)" },
      to: { transform: "rotate(360deg)" }
    },
    animationDuration: "800ms",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear"
  },
  legend: {
    position: "absolute",
    zIndex: 4,
    right: tokens.spacingHorizontalL,
    bottom: tokens.spacingVerticalL,
    display: "flex",
    gap: tokens.spacingHorizontalXS,
    flexWrap: "wrap",
    justifyContent: "center",
    padding: tokens.spacingVerticalXS,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackgroundAlpha,
    boxShadow: tokens.shadow4,
    backdropFilter: "blur(12px)",
    "@media (max-width: 620px)": {
      right: tokens.spacingHorizontalS,
      bottom: tokens.spacingVerticalS,
      width: "max-content",
      maxWidth: "calc(100% - 64px)"
    }
  },
  legendButton: {
    minWidth: 0,
    columnGap: tokens.spacingHorizontalS,
    transitionProperty: "opacity, color, background-color, box-shadow, filter",
    transitionDuration: tokens.durationNormal,
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "2px"
    }
  },
  legendZoomHint: {
    width: "100%",
    padding: `0 ${tokens.spacingHorizontalS}`,
    color: tokens.colorNeutralForeground2,
    textAlign: "center"
  },
  legendButtonActive: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
    boxShadow: `inset 0 0 0 1px ${tokens.colorNeutralStroke2}`
  },
  legendButtonInactive: {
    color: tokens.colorNeutralForeground3,
    filter: "grayscale(1)",
    opacity: 0.46
  },
  inspector: {
    minWidth: 0,
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 800px)": {
      borderLeft: 0,
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`
    }
  },
  inspectorHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM
  },
  inspectorKind: {
    color: tokens.colorBrandForeground1,
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  },
  inspectorTitle: {
    display: "block",
    marginTop: tokens.spacingVerticalXS,
    fontFamily: "Georgia, Cambria, serif",
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase500
  },
  confidenceBadge: { flexShrink: 0 },
  definition: {
    marginTop: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400
  },
  section: {
    marginTop: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`
  },
  sectionHeading: {
    display: "block",
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase300
  },
  evidenceList: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    margin: 0,
    paddingLeft: tokens.spacingHorizontalXL,
    listStyleType: "disc",
    listStylePosition: "outside"
  },
  evidenceItem: {
    display: "list-item",
    paddingLeft: tokens.spacingHorizontalXS,
    "::marker": {
      color: tokens.colorBrandForeground1
    }
  },
  mappingList: {
    display: "grid",
    gap: tokens.spacingVerticalS
  },
  mappingCard: {
    display: "grid",
    gap: tokens.spacingVerticalXXS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2
  },
  mappingMeta: { color: tokens.colorNeutralForeground3 },
  mappingStatement: {
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300
  },
  noContent: { color: tokens.colorNeutralForeground3 }
})
