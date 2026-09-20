import { style } from "@vanilla-extract/css"

export const root = style({ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 })
export const documents = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 20,
  "@media": { "(max-width: 40rem)": { gridTemplateColumns: "minmax(0, 1fr)", gap: 16 } }
})
export const document = style({ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 })
export const side = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted-foreground)"
})
export const displayLabel = style({ margin: 0, fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" })
export const identity = style({ display: "grid", gap: 6, margin: 0, fontSize: 11, color: "var(--muted-foreground)" })
export const identifier = style({
  margin: 0,
  color: "var(--foreground)",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 12,
  overflowWrap: "anywhere"
})
export const hash = style({
  margin: 0,
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  overflowWrap: "anywhere"
})
export const source = style({
  display: "inline-flex",
  alignSelf: "flex-start",
  alignItems: "center",
  gap: 6,
  minHeight: 44,
  fontSize: 13,
  color: "var(--primary)",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 3 }
})
export const summary = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  borderTop: "1px solid var(--border)",
  paddingTop: 14
})
export const summaryLabel = style({ margin: 0, fontSize: 13, fontWeight: 600 })
export const counts = style({ display: "flex", flexWrap: "wrap", gap: "8px 20px", margin: 0 })
export const count = style({
  display: "flex",
  gap: 8,
  alignItems: "baseline",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums"
})
export const caption = style({ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--muted-foreground)" })
export const notice = style({ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: 14 })
export const error = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  border: "1px solid var(--state-danger)",
  borderRadius: 6
})
export const unavailable = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: 14,
  background: "var(--secondary)",
  borderRadius: 6
})
export const visuallyHidden = style({
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0
})
