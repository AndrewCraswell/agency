import { style } from "@vanilla-extract/css"

export const question = style({
  minWidth: 0,
  margin: 0,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.8
})
export const inlineTag = style({
  display: "inline",
  padding: "3px 7px",
  borderRadius: 5,
  background: "var(--card)",
  color: "var(--primary)",
  fontWeight: 500,
  boxDecorationBreak: "clone"
})
export const inlineIcon = style({
  display: "inline-block",
  width: "0.85em",
  height: "0.85em",
  marginRight: "0.35em",
  verticalAlign: "-0.08em"
})

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
