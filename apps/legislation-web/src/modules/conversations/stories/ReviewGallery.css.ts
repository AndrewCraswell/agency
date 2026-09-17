import { style } from "@vanilla-extract/css"

export const page = style({ width: "100%", maxWidth: 1280, margin: "0 auto", padding: "32px 24px 80px", minWidth: 0 })
export const heading = style({ fontSize: 28, lineHeight: 1.25, fontWeight: 600, marginBottom: 12 })
export const metadata = style({
  color: "var(--muted-foreground)",
  fontSize: 12,
  lineHeight: "18px",
  overflowWrap: "anywhere"
})
export const navigation = style({ display: "flex", flexWrap: "wrap", gap: 20, margin: "20px 0", fontSize: 14 })
export const section = style({ padding: "28px 0", borderTop: "1px solid var(--border)", scrollMarginTop: 80 })
export const sectionHeading = style({ fontSize: 20, fontWeight: 600, marginBottom: 16 })
export const group = style({ padding: "20px 0", borderTop: "1px solid var(--border)", minWidth: 0 })
export const groupHeading = style({ fontSize: 14, fontWeight: 600, marginBottom: 12 })
export const grid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "24px 32px",
  "@media": { "(max-width: 700px)": { gridTemplateColumns: "minmax(0, 1fr)" } }
})
export const sample = style({ minWidth: 0, paddingBottom: 8 })
export const label = style({ color: "var(--muted-foreground)", fontSize: 12, lineHeight: "16px", marginBottom: 8 })
export const actions = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
  margin: "16px 0",
  fontSize: 14
})
