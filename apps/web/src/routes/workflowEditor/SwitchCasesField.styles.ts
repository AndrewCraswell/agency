import { makeStyles, shorthands, tokens } from "@fluentui/react-components"

export const useSwitchCasesFieldStyles = makeStyles({
  fieldset: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: 0,
    margin: 0,
    ...shorthands.border("0")
  },
  case: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalM,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2)
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr max-content",
    gap: tokens.spacingHorizontalS,
    alignItems: "end"
  },
  error: { color: tokens.colorPaletteRedForeground1, fontSize: tokens.fontSizeBase200 }
})
