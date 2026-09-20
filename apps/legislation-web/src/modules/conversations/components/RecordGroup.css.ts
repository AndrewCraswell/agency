import { globalStyle, style } from "@vanilla-extract/css"
import * as compact from "./CompactRecordCard.css"
import * as full from "./EntityResults.css"

export const group = style({
  width: "100%",
  minWidth: 0,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--card)"
})
export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
  padding: "10px 16px",
  borderRadius: "8px 8px 0 0",
  background: "var(--secondary)"
})
export const label = style({
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 10,
  lineHeight: 1.4,
  fontWeight: 400,
  color: "var(--muted-foreground)",
  margin: 0,
  textTransform: "uppercase"
})
export const action = style([full.primaryActionButton, { fontSize: 11, fontWeight: 600 }])
export const row = style({ borderTop: "1px solid var(--border)", minWidth: 0 })
globalStyle(`${row} > .${full.fullCard}, ${row} > .${compact.card}`, { border: 0, borderRadius: 0, maxWidth: "none" })
globalStyle(`${row}:last-child > section, ${row}:last-child > a, ${row}:last-child > button`, {
  borderRadius: "0 0 8px 8px"
})
globalStyle(`${row} .${full.fullTitle}`, { fontSize: 13.5 })
globalStyle(`${row} .${full.identityMetadata}, ${row} .${full.subtitle}`, { fontSize: 11 })
globalStyle(`${row} .${full.identity}`, { paddingBottom: 8 })
globalStyle(`${row} .${full.facts}`, { borderTop: 0, paddingTop: 4, paddingBottom: 14 })
globalStyle(`${row} > .${compact.card}`, { gridTemplateColumns: "14px minmax(0,1fr) 96px" })
globalStyle(`${row} .${compact.icon}`, { color: "var(--muted-foreground)" })
