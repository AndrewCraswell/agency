import { style } from "@vanilla-extract/css"

export const list = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  listStyle: "none",
  margin: 0,
  padding: 0
})
export const item = style({ minWidth: 0, maxWidth: "100%" })
export const chip = style({
  minHeight: 28,
  maxWidth: "100%",
  gap: 8,
  padding: "4px 8px",
  borderRadius: 4,
  border: "1px solid var(--input)",
  background: "var(--card)",
  color: "var(--foreground)",
  whiteSpace: "normal",
  flexWrap: "wrap",
  justifyContent: "flex-start",
  fontSize: 12,
  lineHeight: 1.3
})
export const title = style({ minWidth: 0, overflowWrap: "anywhere", fontWeight: 600 })
export const metadata = style({ minWidth: 0, overflowWrap: "anywhere", color: "var(--subtle)", fontWeight: 400 })
