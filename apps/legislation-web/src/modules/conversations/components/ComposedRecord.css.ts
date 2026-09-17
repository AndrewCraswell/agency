import { globalStyle, style } from "@vanilla-extract/css"

export const comparison = style({
  maxWidth: "100%",
  overflowX: "auto",
  margin: "16px 0",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const table = style({
  width: "100%",
  minWidth: 560,
  tableLayout: "fixed",
  borderCollapse: "collapse",
  fontSize: 14,
  lineHeight: 1.5
})
export const caption = style({ captionSide: "top", textAlign: "left", fontWeight: 600, paddingBottom: 12 })
export const cell = style({
  borderBottom: "1px solid var(--border)",
  padding: "12px 14px",
  textAlign: "left",
  verticalAlign: "top",
  overflowWrap: "anywhere"
})
export const absent = style({ color: "var(--muted-foreground)" })
globalStyle(`${table} thead`, { background: "var(--muted)", color: "var(--muted-foreground)" })
globalStyle(`${table} th`, { fontWeight: 500 })
globalStyle(`${table} tbody tr:last-child > th, ${table} tbody tr:last-child > td`, { borderBottom: 0 })
