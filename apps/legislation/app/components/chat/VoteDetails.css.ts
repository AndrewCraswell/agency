import { globalStyle, keyframes, style } from "@vanilla-extract/css"

const enter = keyframes({ from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } })
const exit = keyframes({ from: { transform: "translateX(0)" }, to: { transform: "translateX(100%)" } })

export const panel = style({
  position: "fixed",
  inset: "0 0 0 auto",
  zIndex: 60,
  width: 520,
  maxWidth: "100%",
  height: "100dvh",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 24,
  overflowY: "auto",
  background: "var(--card)",
  color: "var(--foreground)",
  borderLeft: "1px solid var(--border)",
  boxShadow: "none",
  overflowWrap: "anywhere",
  selectors: {
    '&[data-state="open"]': { animation: `${enter} 240ms ease-out` },
    '&[data-state="closed"]': { animation: `${exit} 180ms ease-in` }
  },
  "@media": {
    "(max-width: 40rem)": { padding: 16 },
    "(prefers-reduced-motion: reduce)": { animation: "none !important" }
  }
})
export const header = style({ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, padding: 0 })
export const footer = style({ padding: 0, marginTop: "auto" })
export const heading = style({ flex: 1, fontSize: 20, fontWeight: 600, lineHeight: 1.3 })
export const facts = style({ display: "flex", flexDirection: "column", gap: 10 })
export const motion = style({ fontSize: 18, fontWeight: 600, lineHeight: 1.3 })
export const date = style({ fontSize: 14, lineHeight: 1.5, color: "var(--muted-foreground)" })
export const tallies = style({ display: "flex", flexDirection: "column", gap: 8 })
export const label = style({ fontSize: 12, color: "var(--muted-foreground)" })
export const tally = style({
  display: "grid",
  gridTemplateColumns: "102px minmax(0, 1fr) 36px",
  gap: 10,
  alignItems: "center",
  minHeight: 26,
  fontSize: 14,
  selectors: { '&[data-has-proportion="false"]': { gridTemplateColumns: "102px 36px" } }
})
export const count = style({
  gridColumn: 3,
  textAlign: "right",
  fontSize: 18,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  selectors: {
    [`${tally}[data-has-proportion="false"] &`]: { gridColumn: 2 },
    '&[data-option="yes"]': { color: "var(--state-success)" },
    '&[data-option="no"]': { color: "var(--state-danger)" }
  }
})
export const meter = style({
  width: "100%",
  height: 16,
  appearance: "none",
  border: 0,
  borderRadius: 0,
  background: "var(--secondary)"
})
globalStyle(`${meter} [data-slot="progress-indicator"]`, { background: "var(--subtle)" })
globalStyle(`${meter}[data-option="yes"] [data-slot="progress-indicator"]`, { background: "var(--state-success)" })
globalStyle(`${meter}[data-option="no"] [data-slot="progress-indicator"]`, { background: "var(--state-danger)" })
export const positionHeading = style({ fontSize: 16, fontWeight: 600 })
export const positions = style({ width: "100%", borderCollapse: "collapse", fontSize: 14 })
export const positionName = style({
  height: 44,
  padding: "10px 12px",
  fontWeight: 400,
  whiteSpace: "normal",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: -2 }
})
export const positionOption = style({
  width: 100,
  whiteSpace: "normal",
  padding: "10px 12px",
  textAlign: "right",
  borderBottom: "1px solid var(--border)"
})
export const coverage = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 12,
  color: "var(--muted-foreground)"
})
export const source = style({
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "flex-start",
  gap: 8,
  minHeight: 44,
  marginTop: "auto",
  fontSize: 14,
  color: "var(--primary)",
  ":hover": { textDecoration: "underline" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
