import { style } from "@vanilla-extract/css"

export const root = style({
  minWidth: 0,
  padding: 20,
  background: "var(--card)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  "@media": { "(max-width: 40rem)": { padding: 14 } }
})
export const header = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px 20px",
  marginBottom: 16
})
export const heading = style({ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.4 })
export const trigger = style({ minHeight: 44 })
export const unchanged = style({ display: "block", margin: "14px 0 0", fontSize: 14, fontWeight: 600 })
