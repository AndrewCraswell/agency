import { style } from "@vanilla-extract/css"

export const card = style({
  width: "100%",
  maxWidth: 560,
  minWidth: 0,
  background: "var(--card)",
  border: "1px solid var(--input)",
  borderRadius: 6,
  overflow: "hidden"
})
export const head = style({ display: "flex", alignItems: "flex-start", gap: 8, padding: 12 })
export const documentTitle = style({
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 600,
  color: "var(--foreground)",
  overflowWrap: "anywhere",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const documentSource = style({ display: "flex", alignItems: "center", gap: 8 })
export const cardActions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  padding: "8px 12px",
  borderTop: "1px solid var(--border)",
  background: "var(--background)",
  "@media": {
    "(hover: none), (pointer: coarse)": { paddingBlock: 0 }
  }
})
export const sourceAction = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 600,
  color: "var(--primary)",
  ":hover": { textDecoration: "underline" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 },
  "@media": {
    "(hover: none), (pointer: coarse)": { minHeight: 44 }
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
export const body = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "0 12px 12px",
  fontSize: 12,
  lineHeight: 1.45,
  color: "var(--muted-foreground)",
  overflowWrap: "anywhere"
})
export const tallies = style({ display: "flex", flexWrap: "wrap", gap: 16 })
export const voteBody = style({ gap: 12 })
export const voteQuestion = style({ display: "flex", flexDirection: "column", gap: 4 })
export const voteQuestionLabel = style({ color: "var(--subtle)", fontSize: 12, lineHeight: 1.3, fontWeight: 600 })
export const voteQuestionText = style({
  color: "var(--foreground)",
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 14,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap"
})
export const voteTallies = style({
  display: "flex",
  flexWrap: "wrap",
  rowGap: 12,
  borderTop: "1px solid var(--border)",
  paddingTop: 8
})
export const voteTally = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: "1 1 52px",
  minWidth: 0,
  selectors: { "& + &": { borderLeft: "1px solid var(--border)", paddingLeft: 12 } }
})
export const voteTallyValue = style({
  order: -1,
  fontFamily: "var(--font-fraunces), Georgia, serif",
  color: "var(--foreground)",
  fontSize: 20,
  fontWeight: 600,
  lineHeight: 1.1,
  selectors: {
    '&[data-vote-option="yes"], &[data-vote-option="aye"]': { color: "var(--state-success)" },
    '&[data-vote-option="no"], &[data-vote-option="nay"]': { color: "var(--state-danger)" }
  }
})
export const voteTallyLabel = style({ fontSize: 12, lineHeight: 1.3, overflowWrap: "anywhere" })
export const statusRow = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  minHeight: 18,
  fontSize: 12,
  lineHeight: 1.4
})
export const committeeStatusIcon = style({ width: 13, height: 13, flexShrink: 0, color: "var(--state-pending)" })
export const cardTitleLink = style({ color: "var(--primary)" })
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
