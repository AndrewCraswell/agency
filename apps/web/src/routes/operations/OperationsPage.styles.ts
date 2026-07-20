import { makeStyles, tokens } from "@fluentui/react-components"

export const useOperationsPageStyles = makeStyles({
  page: { minHeight: "100%", backgroundColor: tokens.colorNeutralBackground2, color: tokens.colorNeutralForeground1 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: tokens.spacingHorizontalXL,
    padding: `${tokens.spacingVerticalXXL} clamp(20px, 4vw, 64px) ${tokens.spacingVerticalL}`,
    "@media (max-width: 720px)": { alignItems: "start", flexDirection: "column" }
  },
  headerCopy: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  subtitle: { color: tokens.colorNeutralForeground2 },
  tabs: {
    paddingInline: "clamp(20px, 4vw, 64px)",
    borderBottomColor: tokens.colorNeutralStroke2,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px"
  },
  message: { margin: `${tokens.spacingVerticalL} clamp(20px, 4vw, 64px) 0` }
})
