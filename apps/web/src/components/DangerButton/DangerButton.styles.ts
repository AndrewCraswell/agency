import { makeStyles, tokens } from "@fluentui/react-components"

export const useDangerButtonStyles = makeStyles({
  root: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    borderTopColor: tokens.colorPaletteRedBackground3,
    borderRightColor: tokens.colorPaletteRedBackground3,
    borderBottomColor: tokens.colorPaletteRedBackground3,
    borderLeftColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": {
      backgroundColor: tokens.colorPaletteRedForeground1,
      borderTopColor: tokens.colorPaletteRedForeground1,
      borderRightColor: tokens.colorPaletteRedForeground1,
      borderBottomColor: tokens.colorPaletteRedForeground1,
      borderLeftColor: tokens.colorPaletteRedForeground1,
      color: tokens.colorNeutralForegroundOnBrand
    },
    ":hover:active": {
      backgroundColor: tokens.colorPaletteRedForeground2,
      borderTopColor: tokens.colorPaletteRedForeground2,
      borderRightColor: tokens.colorPaletteRedForeground2,
      borderBottomColor: tokens.colorPaletteRedForeground2,
      borderLeftColor: tokens.colorPaletteRedForeground2,
      color: tokens.colorNeutralForegroundOnBrand
    }
  }
})
