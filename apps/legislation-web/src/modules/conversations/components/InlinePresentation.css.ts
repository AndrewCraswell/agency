import { globalStyle, style } from "@vanilla-extract/css"

export const card = style({
  width: "100%",
  maxWidth: 420,
  minWidth: 0,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--card)",
  overflowWrap: "anywhere"
})
export const heading = style({ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 12px 8px" })
export const title = style({ fontSize: 14, fontWeight: 600, lineHeight: 1.4, margin: 0 })
export const metadata = style({
  padding: "8px 12px",
  borderTop: "1px solid var(--border)",
  fontSize: 12,
  color: "var(--muted-foreground)"
})
globalStyle(`${metadata} > div`, {
  display: "grid",
  gridTemplateColumns: "64px minmax(0,1fr)",
  gap: 8,
  margin: "4px 0"
})
globalStyle(`${metadata} dd`, { margin: 0, fontFamily: "var(--font-ibm-plex-mono), monospace" })
export const body = style({ padding: 12, borderTop: "1px solid var(--border)" })
export const quote = style({
  margin: 0,
  paddingLeft: 12,
  borderLeft: "2px solid var(--primary)",
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 16,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere"
})
export const passage = style({
  width: "100%",
  maxWidth: 640,
  minWidth: 0,
  padding: "4px 0 0 16px",
  borderLeft: "2px solid var(--primary)"
})
export const passageText = style({
  margin: 0,
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 16,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere"
})
export const sourceLine = style({
  marginTop: 8,
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 12,
  color: "var(--muted-foreground)",
  overflowWrap: "anywhere"
})
export const actions = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
  minHeight: 44,
  padding: "8px 12px",
  borderTop: "1px solid var(--border)"
})
export const plainActions = style({ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 })
export const note = style({ fontSize: 12, lineHeight: 1.5, color: "var(--muted-foreground)", margin: "8px 0" })
export const view = style({ width: "100%", maxWidth: 640, minWidth: 0, overflowWrap: "anywhere" })
export const timeline = style({ listStyle: "none", margin: "12px 0", padding: 0 })
export const event = style({
  display: "grid",
  gridTemplateColumns: "92px minmax(0,1fr)",
  gap: 12,
  padding: "8px 0",
  fontSize: 13,
  lineHeight: 1.5
})
export const eventBody = style({ borderLeft: "2px solid var(--border)", paddingLeft: 12, minWidth: 0 })
export const date = style({
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 12,
  color: "var(--muted-foreground)"
})
export const progress = style({
  listStyle: "none",
  margin: "12px 0",
  padding: "4px 0",
  display: "flex",
  width: "max-content",
  minWidth: "100%"
})
export const progressRegion = style({
  width: "100%",
  overflowX: "auto",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const step = style({
  flex: "0 0 160px",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "8px 0",
  fontSize: 12,
  lineHeight: 1.4,
  textAlign: "center"
})
export const stepBody = style({ minWidth: 0, padding: "0 8px" })
export const track = style({
  height: 16,
  display: "flex",
  justifyContent: "center",
  position: "relative",
  "::before": { content: '""', position: "absolute", left: 0, right: 0, top: 8, borderTop: "1px solid var(--border)" }
})
globalStyle(`${track} svg`, { position: "relative", background: "var(--background)" })
export const tableRegion = style({
  width: "100%",
  overflowX: "auto",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const table = style({ width: "100%", minWidth: 360, fontSize: 13 })
export const tallies = style({ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0", fontSize: 12 })
globalStyle(`${tallies} dd`, {
  margin: 0,
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 16,
  whiteSpace: "nowrap"
})
