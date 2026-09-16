import { style } from "@vanilla-extract/css"

export const shell = style({ minHeight: "100dvh", background: "var(--background)", color: "var(--foreground)" })
export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  height: 56,
  flexShrink: 0,
  padding: "0 16px",
  background: "var(--card)",
  borderBottom: "1px solid var(--border)"
})
export const brand = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 4 }
})
export const wordmark = style({
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 18,
  lineHeight: 1.3,
  fontWeight: 600
})
export const utilities = style({ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 })
export const utility = style({ width: 32, height: 32, borderRadius: 4, color: "var(--muted-foreground)" })
export const demoHeader = style({
  height: 64,
  padding: "0 24px",
  justifyContent: "flex-start",
  gap: 12,
  background: "var(--background)",
  "@media": { "(max-width: 40rem)": { padding: "0 20px" } }
})
export const demoLabel = style({ fontSize: 12, fontWeight: 500, color: "var(--subtle)", flex: 1 })
