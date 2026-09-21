import { globalStyle, style } from "@vanilla-extract/css"

export const region = style({
  borderTop: "1px solid var(--border)",
  padding: "16px 16px 14px",
  overflowX: "auto",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: -2 }
})
export const path = style({ display: "flex", minWidth: 480, listStyle: "none", margin: 0, padding: 0 })
export const stage = style({
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  textAlign: "center"
})
export const track = style({
  height: 20,
  display: "grid",
  placeItems: "center",
  position: "relative",
  "::before": { content: "", position: "absolute", left: "50%", width: "100%", height: 1, background: "var(--border)" }
})
export const dot = style({
  zIndex: 1,
  width: 9,
  height: 9,
  borderRadius: "50%",
  border: "1.5px solid var(--input)",
  background: "var(--card)"
})
export const label = style({
  padding: "0 4px",
  fontSize: 11.5,
  fontWeight: 500,
  lineHeight: 1.3,
  color: "var(--muted-foreground)",
  overflowWrap: "anywhere"
})
export const date = style({
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 10,
  lineHeight: 1.3,
  color: "var(--muted-foreground)"
})
export const notice = style({ margin: 0, padding: "0 16px 14px", fontSize: 11, color: "var(--muted-foreground)" })
globalStyle(`${stage}:last-child ${track}::before`, { display: "none" })
globalStyle(`${stage}[data-state="recorded"] ${dot}, ${stage}[data-state="current"] ${dot}`, {
  background: "var(--primary)",
  borderColor: "var(--primary)"
})
globalStyle(`${stage}[data-state="current"] ${dot}`, { width: 12, height: 12, boxShadow: "0 0 0 4px var(--accent)" })
globalStyle(`${stage}[data-state="current"] ${label}`, { fontWeight: 600, color: "var(--foreground)" })
globalStyle(`${stage}[data-state="recorded"] ${label}`, { color: "var(--foreground)" })
globalStyle(`${stage}[data-connected="true"] ${track}::before`, {
  background: "var(--primary)"
})
