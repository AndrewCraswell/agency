import { globalStyle, style } from "@vanilla-extract/css"

export const band = style({ padding: "96px 24px 80px", "@media": { "(max-width: 48rem)": { padding: "56px 20px" } } })
export const content = style({ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 64, minWidth: 0 })
export const section = style({ display: "grid", gap: 32, minWidth: 0 })
export const heading = style({ display: "grid", gap: 12, maxWidth: 560 })
export const description = style({
  fontSize: 14,
  color: "var(--muted-foreground)",
  lineHeight: 1.65,
  textWrap: "pretty"
})
export const split = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 560fr) minmax(0, 432fr)",
  gap: 48,
  alignItems: "start",
  "@media": { "(max-width: 48rem)": { gridTemplateColumns: "minmax(0, 1fr)", gap: 28 } }
})
export const facts = style({ display: "grid", gap: 24, fontSize: 14, lineHeight: 1.5 })
export const unavailable = style({
  padding: 24,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
  color: "var(--subtle)"
})
export const mentionPopover = style({ position: "relative", zIndex: "auto", maxWidth: "100%", justifySelf: "start" })
export const mentionInput = style({
  padding: 0,
  height: 24,
  border: 0,
  borderRadius: 0,
  boxShadow: "none",
  background: "transparent",
  fontSize: 16,
  ":focus-visible": { boxShadow: "none", outline: "2px solid var(--ring)", outlineOffset: 3 }
})
globalStyle(`${facts} > div`, { display: "grid", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 })
globalStyle(`${facts} dt`, { fontSize: 12, fontWeight: 600, color: "var(--subtle)" })
globalStyle(`${facts} dd`, { color: "var(--muted-foreground)" })
export const sectionTop = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 32,
  "@media": { "(max-width: 48rem)": { flexDirection: "column", alignItems: "start", gap: 16 } }
})
export const server = style({
  display: "grid",
  gap: 8,
  textAlign: "right",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 12,
  flexShrink: 0,
  "@media": { "(max-width: 48rem)": { textAlign: "left" } }
})
export const caption = style({
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 11,
  textTransform: "uppercase",
  color: "var(--subtle)"
})
export const clientColumn = style({ minWidth: 0, display: "grid", gap: 12 })
export const clients = style({ display: "flex", flexWrap: "wrap", gap: 0, borderBottom: "1px solid var(--input)" })
export const client = style({
  position: "relative",
  padding: "10px 10px",
  borderBottom: "2px solid transparent",
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
  color: "var(--subtle)",
  selectors: {
    "&:has([data-state=checked])": { color: "var(--primary)", borderBottomColor: "var(--primary)" },
    "&:has(:focus-visible)": { outline: "2px solid var(--ring)", outlineOffset: -2 }
  },
  ":hover": { background: "var(--secondary)" }
})
export const codePanel = style({
  minWidth: 0,
  minHeight: 248,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--secondary)"
})
export const codeHeader = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px 0 20px",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 11,
  color: "var(--subtle)"
})
export const copyButton = style({ width: 32, height: 32 })
export const code = style({
  padding: "8px 20px 24px",
  fontSize: 12,
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: -2 }
})
export const configFooter = style({
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
  fontSize: 12,
  minHeight: 20,
  color: "var(--subtle)"
})
export const link = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  color: "var(--primary)",
  ":hover": { textDecoration: "underline" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 4 }
})
export const error = style({ color: "var(--destructive)", fontSize: 12 })
export const tools = style({ borderTop: "1px solid var(--border)", paddingTop: 20, display: "grid", gap: 12 })
export const toolList = style({ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", padding: 0 })
export const tool = style({
  display: "block",
  fontSize: 10,
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  lineHeight: 1.5,
  border: "1px solid var(--border)",
  borderRadius: 3,
  padding: "3px 6px",
  background: "var(--card)",
  color: "var(--muted-foreground)",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const coverageTable = style({ minWidth: 1040, tableLayout: "fixed", fontSize: 12 })
export const tableRegion = style({ ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 4 } })
export const sourceHead = style({
  width: 194,
  fontSize: 10,
  textTransform: "uppercase",
  color: "var(--subtle)",
  paddingLeft: 0
})
export const categoryHead = style({
  fontSize: 9,
  textAlign: "center",
  textTransform: "uppercase",
  color: "var(--subtle)",
  padding: "0 2px"
})
export const statusHead = style({ width: 132, fontSize: 10, textTransform: "uppercase", color: "var(--subtle)" })
export const sourceCell = style({ padding: "16px 16px 16px 0", whiteSpace: "normal" })
export const sourceLink = style([link, { fontSize: 14, fontWeight: 500 }])
export const sourceDescription = style({
  display: "block",
  marginTop: 4,
  fontSize: 11,
  lineHeight: 1.4,
  color: "var(--subtle)"
})
export const coverageCell = style({ textAlign: "center", padding: "12px 2px" })
export const check = style({ color: "var(--primary)", margin: "0 auto" })
export const minus = style({ color: "var(--subtle)", margin: "0 auto" })
export const statusCell = style({ whiteSpace: "normal", fontSize: 11, lineHeight: 1.4, color: "var(--subtle)" })
export const summary = style({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 24,
  borderTop: "1px solid var(--border)",
  paddingTop: 20,
  fontSize: 14,
  "@media": { "(max-width: 48rem)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } }
})
globalStyle(`${summary} dt`, { fontSize: 12, color: "var(--subtle)", marginBottom: 4 })
export const footer = style({
  borderTop: "1px solid var(--border)",
  padding: "40px 24px",
  "@media": { "(max-width: 48rem)": { padding: "28px 20px" } }
})
export const footerInner = style({
  maxWidth: 1040,
  margin: "0 auto",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  fontSize: 12,
  color: "var(--subtle)"
})
