import { globalStyle, style } from "@vanilla-extract/css"

export const card = style({
  width: "100%",
  maxWidth: 560,
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "14px minmax(0,1fr) 104px",
  alignItems: "center",
  gap: 12,
  padding: "11px 16px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--card)",
  textAlign: "left",
  color: "var(--foreground)",
  fontFamily: "var(--font-public-sans), sans-serif",
  letterSpacing: 0,
  textDecoration: "none",
  minHeight: 44,
  selectors: { "&:is(a, button):hover": { background: "var(--accent)" } },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const title = style({
  display: "block",
  fontSize: 12.5,
  fontWeight: 500,
  lineHeight: 1.35,
  overflowWrap: "anywhere"
})
export const metadata = style({
  display: "block",
  marginTop: 1,
  fontSize: 11,
  fontWeight: 400,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
  color: "var(--muted-foreground)"
})
export const trailing = style({
  minWidth: 0,
  textAlign: "right",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.35,
  color: "var(--muted-foreground)",
  overflowWrap: "anywhere"
})
export const icon = style({ width: 14, height: 14, flexShrink: 0, color: "var(--primary)" })
export const tallies = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 500,
  color: "var(--muted-foreground)"
})
export const tally = style({ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" })
globalStyle(`${tally}[data-vote-option="yes"]`, { color: "var(--state-success)", fontWeight: 600 })
globalStyle(`${tally}[data-vote-option="no"]`, { color: "var(--state-danger)", fontWeight: 600 })
export const voteCard = style({
  gridTemplateColumns: "14px minmax(0,1fr) auto",
  "@media": { "(max-width: 40rem)": { gridTemplateColumns: "14px minmax(0,1fr) 104px" } }
})
export const group = style({
  width: "100%",
  maxWidth: 560,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--card)"
})
globalStyle(`${group} .${card}`, { maxWidth: "none", border: 0, borderRadius: 0 })
globalStyle(`${group} > * + *`, { borderTop: "1px solid var(--border)" })
globalStyle(`${group} > :first-child .${card}`, { borderTopLeftRadius: 8, borderTopRightRadius: 8 })
globalStyle(`${group} > :last-child .${card}`, { borderBottomLeftRadius: 8, borderBottomRightRadius: 8 })
