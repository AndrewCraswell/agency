import { globalStyle, style } from "@vanilla-extract/css"

export const card = style({
  width: "100%",
  maxWidth: 560,
  minWidth: 0,
  background: "var(--card)",
  border: "1px solid var(--input)",
  borderRadius: 6,
  overflow: "hidden"
})
export const fullCard = style([card, { borderColor: "var(--border)", borderRadius: 8 }])
export const identity = style({ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px" })
export const eyebrow = style({ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" })
export const kindLabel = style({
  color: "var(--primary)",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0
})
export const identifier = style({
  borderLeft: "1px solid var(--border)",
  paddingLeft: 8,
  color: "var(--muted-foreground)",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 10,
  overflowWrap: "anywhere"
})
export const fullTitle = style({
  fontFamily: "var(--font-public-sans), sans-serif",
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.3,
  color: "var(--foreground)",
  overflowWrap: "anywhere",
  textAlign: "left",
  textDecoration: "none",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 },
  selectors: { "&:is(a,button):hover": { textDecoration: "underline" } }
})
export const headerStatus = style({
  marginLeft: "auto",
  maxWidth: "100%",
  minWidth: 0,
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.35,
  overflowWrap: "anywhere"
})
export const facts = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0,1fr))",
  gap: 16,
  padding: "12px 16px",
  margin: 0,
  borderTop: "1px solid var(--border)",
  "@media": { "(max-width: 30rem)": { gridTemplateColumns: "repeat(2, minmax(0,1fr))" } }
})
export const fact = style({ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 })
export const factLabel = style({
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 10,
  fontWeight: 400,
  lineHeight: 1.35,
  color: "var(--muted-foreground)",
  textTransform: "uppercase",
  letterSpacing: 0
})
export const factValue = style({
  margin: 0,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.35,
  color: "var(--foreground)",
  overflowWrap: "anywhere"
})
export const factDetail = style({
  margin: 0,
  fontSize: 11,
  fontWeight: 400,
  color: "var(--muted-foreground)",
  overflowWrap: "anywhere",
  lineHeight: 1.4
})
export const fullActions = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 16,
  padding: "10px 16px",
  borderTop: "1px solid var(--border)",
  background: "var(--secondary)"
})
export const fullQuote = style({
  margin: 0,
  paddingLeft: 10,
  borderLeft: "2px solid var(--border)",
  fontSize: 13,
  fontFamily: "var(--font-newsreader), Georgia, serif",
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere"
})
globalStyle(`${factValue}[data-vote-option="yes"]`, { color: "var(--state-success)", whiteSpace: "nowrap" })
globalStyle(`${factValue}[data-vote-option="no"]`, { color: "var(--state-danger)", whiteSpace: "nowrap" })
export const identityMetadata = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "4px 10px",
  fontSize: 12,
  lineHeight: 1.4,
  color: "var(--muted-foreground)"
})
export const metadataPart = style({
  minWidth: 0,
  overflowWrap: "anywhere",
  selectors: { "&:not(:first-child)": { borderLeft: "1px solid var(--border)", paddingLeft: 10 } }
})
globalStyle(`${identity} > p`, { margin: 0 })
export const actionButton = style({
  height: "auto",
  minHeight: 16,
  minWidth: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "var(--muted-foreground)",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: "16px",
  textDecoration: "none",
  boxShadow: "none",
  ":hover": { background: "var(--accent)", color: "var(--foreground)", textDecoration: "none" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 },
  selectors: { '&[data-state="on"]': { color: "var(--primary)" } },
  "@media": { "(hover: none), (pointer: coarse)": { minHeight: 44 } }
})
export const primaryActionButton = style([actionButton, { color: "var(--primary)", fontWeight: 700 }])
export const statusIcon = style({
  width: 13,
  height: 13,
  flexShrink: 0,
  color: "var(--subtle)",
  selectors: {
    '[data-result-tone="success"] > &': { color: "var(--state-success)" },
    '[data-result-tone="danger"] > &': { color: "var(--state-danger)" },
    '[data-result-tone="pending"] > &': { color: "var(--state-pending)" }
  }
})
export const title = style({
  display: "block",
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 600,
  color: "var(--foreground)",
  overflowWrap: "anywhere",
  ":hover": { textDecoration: "underline" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const subtitle = style({
  fontSize: 12,
  lineHeight: 1.4,
  color: "var(--muted-foreground)",
  overflowWrap: "anywhere",
  marginTop: 4
})
export const statusRow = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  minHeight: 18,
  fontSize: 12,
  lineHeight: 1.4
})
export const row = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderTop: "1px solid var(--border)",
  padding: "14px 0",
  minHeight: 44,
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const index = style({
  width: 24,
  flexShrink: 0,
  alignSelf: "flex-start",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--subtle)"
})
export const pager = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderTop: "1px solid var(--border)",
  paddingTop: 16,
  marginTop: 12
})
export const pageButton = style({ minHeight: 44, padding: "0 12px", borderRadius: 6, fontSize: 14, fontWeight: 600 })
export const retrievalStatus = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
  padding: 12,
  borderRadius: 6,
  background: "var(--secondary)",
  color: "var(--muted-foreground)",
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const retryButton = style({ minHeight: 44, padding: "0 12px", borderRadius: 6, fontSize: 14, fontWeight: 600 })
