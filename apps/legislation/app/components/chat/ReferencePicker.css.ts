import { style } from "@vanilla-extract/css"

export const panel = style({
  width: 400,
  maxWidth: "calc(100vw - 32px)",
  maxHeight: "calc(100dvh - 32px)",
  padding: 12,
  gap: 8,
  background: "var(--card)",
  borderRadius: 16,
  border: "1px solid var(--input)",
  boxShadow: "none",
  display: "flex",
  flexDirection: "column"
})
export const header = style({ display: "flex", alignItems: "center", gap: 12, minHeight: 44 })
export const title = style({ flex: 1, fontSize: 16, fontWeight: 600 })
export const close = style({ width: 44, height: 44, borderRadius: 8 })
export const search = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 44,
  flexShrink: 0,
  padding: "0 12px",
  border: "1px solid var(--input)",
  borderRadius: 10,
  background: "var(--background)",
  ":focus-within": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const input = style({
  height: 42,
  fontSize: 14,
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: "transparent",
  boxShadow: "none",
  ":focus-visible": { boxShadow: "none", outline: "none" },
  "@media": { "(pointer: coarse)": { fontSize: 16 } }
})
export const type = style({
  height: 44,
  fontSize: 13,
  borderRadius: 8,
  borderColor: "var(--border)",
  boxShadow: "none"
})
export const list = style({ overflowY: "auto", minHeight: 0, maxHeight: 360 })
export const row = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  minHeight: 48,
  borderRadius: 4,
  cursor: "pointer",
  ":hover": { background: "var(--secondary)" },
  ":focus-within": { outline: "2px solid var(--ring)", outlineOffset: -2 }
})
export const label = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: 1,
  minWidth: 0,
  fontSize: 14,
  lineHeight: 1.4,
  fontWeight: 500,
  overflowWrap: "anywhere"
})
export const trailing = style({
  color: "var(--subtle)",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 12,
  flexShrink: 0
})
export const selection = style({ width: 18, height: 18, borderRadius: 2 })
export const metadata = style({ fontSize: 12, lineHeight: 1.4, fontWeight: 400, color: "var(--muted-foreground)" })
export const footer = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 12,
  paddingTop: 12,
  borderTop: "1px solid var(--border)"
})
export const add = style({
  height: 44,
  padding: "0 16px",
  borderRadius: 8,
  fontSize: 13,
  ":disabled": { opacity: 1, background: "var(--secondary)", color: "var(--subtle)" }
})
export const chips = style({ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 20px 8px" })
export const chip = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  maxWidth: "100%",
  padding: "0 4px 0 8px",
  border: "1px solid var(--input)",
  background: "var(--secondary)",
  borderRadius: 4,
  fontSize: 12
})
export const chipLabel = style({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 })
