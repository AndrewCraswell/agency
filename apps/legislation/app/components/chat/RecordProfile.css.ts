import { style } from "@vanilla-extract/css"

export const content = style({
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minWidth: 0,
  overflowWrap: "anywhere",
  "@media": { "(max-width: 40rem)": { padding: "16px 20px" } }
})
export const identity = style({ display: "flex", flexDirection: "column", gap: 8 })
export const titleRow = style({ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 })
export const affiliation = style({ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 16 })
export const party = style({ borderRadius: 4, minHeight: 28, padding: "0 10px", fontSize: 16, fontWeight: 400 })
export const back = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 32,
  alignSelf: "flex-start",
  fontSize: 12,
  color: "var(--muted-foreground)",
  ":hover": { color: "var(--primary)", textDecoration: "underline" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const title = style({
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 32,
  fontWeight: 600,
  lineHeight: 1.2,
  "@media": { "(max-width: 40rem)": { fontSize: 24 } }
})
export const sections = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 32,
  padding: "12px 0",
  "@media": { "(max-width: 48rem)": { gridTemplateColumns: "minmax(0, 1fr)" } }
})
export const section = style({ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 })
export const heading = style({ fontSize: 20, lineHeight: 1.3, fontWeight: 600 })
export const term = style({
  padding: "0 0 8px",
  display: "flex",
  flexDirection: "column",
  gap: 4
})
export const metadata = style({ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.5 })
export const source = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 32,
  fontSize: 14,
  color: "var(--primary)",
  ":hover": { textDecoration: "underline" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const sources = style({ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 })
export const reading = style({
  background: "var(--card)",
  border: "1px solid var(--border)",
  padding: 32,
  maxWidth: 820,
  width: "100%",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 24,
  "@media": { "(max-width: 40rem)": { padding: 20 } }
})
export const passage = style({
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 18,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere"
})
