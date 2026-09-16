import { style } from "@vanilla-extract/css"

export const panel = style({ width: 560, gap: 0, selectors: { "&&": { padding: 0 } } })
export const header = style({ padding: "16px 20px", borderBottom: "1px solid var(--border)" })
export const body = style({ display: "flex", flexDirection: "column", gap: 16, padding: 20, minWidth: 0 })
export const title = style({ fontSize: 20, fontWeight: 600, lineHeight: 1.3 })
export const facts = style({ display: "flex", flexDirection: "column", gap: 4, fontSize: 14, lineHeight: 1.5 })
export const heading = style({ fontSize: 16, fontWeight: 600, marginBottom: 8 })
export const list = style({ display: "flex", flexDirection: "column", gap: 12 })
export const agendaItem = style({
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr)",
  gap: 12,
  fontSize: 14,
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const note = style({ color: "var(--muted-foreground)", fontSize: 12, lineHeight: 1.5 })
export const footer = style({ padding: "12px 20px", marginTop: "auto", borderTop: "1px solid var(--border)" })
