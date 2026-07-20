import { makeStyles, shorthands, tokens } from "@fluentui/react-components"

export const useConnectionMappingsFieldStyles = makeStyles({
  fieldset: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: 0,
    margin: 0,
    ...shorthands.border("0")
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr max-content",
    gap: tokens.spacingHorizontalS,
    alignItems: "end",
    "@media (max-width: 520px)": {
      gridTemplateColumns: "1fr max-content",
      "& > div:nth-child(2)": { gridColumn: "1 / -1", gridRow: 2 }
    }
  }
})
