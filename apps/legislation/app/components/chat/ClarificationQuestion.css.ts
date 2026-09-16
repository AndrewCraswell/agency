import { style } from "@vanilla-extract/css"

export const field = style({
  width: "100%",
  minWidth: 0,
  height: 44,
  padding: "0 12px",
  border: "1px solid var(--subtle)",
  borderRadius: 6,
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 16,
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const option = style({
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  minHeight: 44,
  padding: 12,
  border: "1px solid var(--input)",
  borderRadius: 6,
  background: "var(--card)",
  cursor: "pointer"
})
export const selectedOption = style({ borderColor: "var(--primary)", background: "var(--accent)" })
export const actions = style({ display: "flex", flexWrap: "wrap", gap: 8 })
export const action = style({ minHeight: 44, padding: "0 12px", borderRadius: 6 })
export const receipt = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 0",
  borderBottom: "1px solid var(--border)"
})
export const receiptStatus = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginLeft: "auto",
  fontSize: 12,
  fontWeight: 400,
  color: "var(--muted-foreground)"
})
export const receiptWithinMessage = style({ paddingTop: 0 })
