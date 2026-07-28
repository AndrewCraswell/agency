import { makeStyles, tokens } from "@fluentui/react-components"

export const useKnowledgeNodeStyles = makeStyles({
  node: {
    width: "300px",
    minHeight: "116px",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
    transitionProperty: "box-shadow, outline-color, opacity, transform",
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveEasyEase,
    ":hover": {
      outline: `1px solid ${tokens.colorBrandStroke1}`,
      boxShadow: tokens.shadow16,
      transform: "translateY(-2px)"
    }
  },
  selected: {
    outline: `2px solid ${tokens.colorBrandStroke1}`,
    boxShadow: `0 0 0 3px ${tokens.colorBrandBackground2}, ${tokens.shadow16}`
  },
  outcome: {
    backgroundImage: `linear-gradient(145deg, ${tokens.colorBrandBackground2}, ${tokens.colorNeutralBackground1})`
  },
  resource: {
    backgroundColor: tokens.colorPaletteBerryBackground2
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS
  },
  kind: {
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  },
  confidence: {
    color: tokens.colorBrandForeground1,
    fontVariantNumeric: "tabular-nums"
  },
  label: {
    display: "block",
    overflowWrap: "anywhere",
    whiteSpace: "normal",
    lineHeight: tokens.lineHeightBase300
  },
  resourceMeta: {
    display: "block",
    marginTop: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground3
  },
  resourceAction: {
    marginTop: tokens.spacingVerticalS
  },
  handle: {
    width: "9px",
    height: "9px",
    border: `2px solid ${tokens.colorNeutralBackground1}`,
    backgroundColor: tokens.colorBrandBackground
  },
  resourceHandle: {
    backgroundColor: tokens.colorPaletteBerryBorderActive
  }
})
