import { globalStyle, keyframes, style } from "@vanilla-extract/css"

const pulse = keyframes({ "0%, 100%": { opacity: 0.4 }, "50%": { opacity: 1 } })
const spin = keyframes({ to: { transform: "rotate(360deg)" } })
const drawerEnter = keyframes({ from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } })
const drawerExit = keyframes({ from: { transform: "translateX(0)" }, to: { transform: "translateX(100%)" } })
const overlayEnter = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
const overlayExit = keyframes({ from: { opacity: 1 }, to: { opacity: 0 } })
const activityCaption = { fontSize: 12, lineHeight: "16px" }

export const questionTurn = style({ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 })
export const questionHead = style({ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 })
export const messageTime = style({
  color: "var(--subtle)",
  fontSize: 12,
  fontWeight: 400,
  cursor: "default",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const questionAuthor = style({
  color: "var(--muted-foreground)",
  fontSize: 12,
  fontWeight: 500,
  textAlign: "right"
})
export const questionBubble = style({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
  padding: "12px 16px",
  border: "1px solid var(--border)",
  borderRadius: 18,
  background: "var(--secondary)",
  color: "var(--foreground)",
  fontSize: "var(--text-sm)",
  lineHeight: "var(--text-sm--line-height)",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere"
})
export const answerTurn = style({ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, padding: "4px 0" })
export const orderedContent = style({ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 })
export const receiptTurn = style({ gap: 8, paddingTop: 12 })
export const answerHead = style({ display: "flex", alignItems: "center", gap: 8, minHeight: 15 })
export const answerAuthor = style({ fontSize: 12, fontWeight: 600, color: "var(--foreground)" })
export const answerMark = style({ width: 15, height: 15, borderRadius: 4, flexShrink: 0 })

export const messageActions = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 36,
  opacity: 0,
  transform: "translateY(-4px)",
  pointerEvents: "none",
  transition: "opacity 160ms ease-out, transform 160ms ease-out",
  selectors: {
    [`${questionTurn} > &`]: { justifyContent: "flex-end" },
    [`${answerTurn} > &, ${answerTurn} > ${orderedContent} > &`]: { marginTop: -4 },
    [`${receiptTurn} > &, ${receiptTurn} > ${orderedContent} > &`]: { marginTop: 0 },
    [`${questionTurn}:hover > &, ${answerTurn}:hover > &, &:has(:focus-visible)`]: {
      opacity: 1,
      transform: "translateY(0)",
      pointerEvents: "auto"
    }
  },
  "@media": {
    "(hover: none), (pointer: coarse)": { opacity: 1, transform: "none", pointerEvents: "auto" },
    "(prefers-reduced-motion: reduce)": { transition: "none", transform: "none" }
  }
})

export const activityTrigger = style({
  ...activityCaption,
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 44,
  padding: "12px 0",
  textAlign: "left",
  fontWeight: 500,
  color: "var(--muted-foreground)",
  cursor: "pointer",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const activityCount = style({ ...activityCaption, fontWeight: 400, color: "var(--subtle)", flexShrink: 0 })
export const activityItems = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  marginTop: 8,
  paddingLeft: 16,
  borderLeft: "1px solid var(--border)"
})
export const activityStep = style({ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", minWidth: 0 })
export const activityHeading = style({ display: "flex", alignItems: "center", gap: 8, minWidth: 0 })
export const activityLabel = style({
  ...activityCaption,
  flex: 1,
  minWidth: 0,
  overflowWrap: "anywhere",
  fontWeight: 500,
  color: "var(--foreground)"
})
export const activityDetails = style({
  ...activityCaption,
  display: "flex",
  gap: 8,
  paddingLeft: 24,
  color: "var(--subtle)"
})
export const reasoningSummary = style({
  display: "grid",
  gridTemplateColumns: "16px minmax(0, 1fr)",
  gap: 8,
  alignItems: "start",
  padding: "10px 0",
  color: "var(--muted-foreground)",
  fontSize: 13,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere"
})
export const reasoningSummaryIcon = style({
  width: 16,
  height: 16,
  marginTop: 2,
  color: "var(--primary)"
})
export const reasoningSummaryText = style({ minWidth: 0 })
globalStyle(`${reasoningSummaryText} p`, { margin: "0 0 8px" })
globalStyle(`${reasoningSummaryText} p:last-child`, { marginBottom: 0 })
export const activityPending = style({ color: "var(--subtle)" })
export const activityComplete = style({ color: "var(--state-success)" })
export const activityFailed = style({ color: "var(--state-danger)" })
export const failedToolTrigger = style({
  ...activityCaption,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "center",
  width: "100%",
  gap: 6,
  padding: 0,
  minHeight: 44,
  textAlign: "left",
  fontWeight: 500,
  cursor: "pointer",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const failedToolDetails = style({
  ...activityCaption,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  paddingLeft: 24
})
export const failedToolError = style({
  ...activityCaption,
  background: "var(--state-danger-soft)",
  color: "var(--state-danger)",
  borderRadius: 6,
  padding: 12,
  overflowWrap: "anywhere"
})

export const working = style({
  ...activityCaption,
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--muted-foreground)",
  animation: `${pulse} 1.8s ease-in-out infinite`,
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } }
})
export const spinner = style({
  width: 16,
  height: 16,
  flexShrink: 0,
  animation: `${spin} 1.5s linear infinite`,
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } }
})
export const markdown = style({
  fontSize: "var(--text-sm)",
  lineHeight: "var(--text-sm--line-height)",
  overflowWrap: "anywhere",
  minWidth: 0
})
export const recordMention = style({
  color: "var(--primary)",
  textDecoration: "underline",
  textUnderlineOffset: "0.2em",
  textAlign: "inherit",
  overflowWrap: "anywhere",
  cursor: "pointer",
  ":hover": { textDecorationThickness: 2 },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
globalStyle(`${markdown} h1, ${markdown} h2, ${markdown} h3`, {
  fontFamily: "var(--font-public-sans), sans-serif",
  fontSize: "var(--text-base)",
  fontWeight: 600,
  lineHeight: "var(--text-base--line-height)",
  margin: "24px 0 12px"
})
globalStyle(`${markdown} p`, { margin: "12px 0" })
globalStyle(`${markdown} > :last-child`, { marginBottom: 0 })
globalStyle(`${markdown} ul`, { listStyle: "disc", paddingLeft: 24, margin: "12px 0" })
globalStyle(`${markdown} ol`, { listStyle: "decimal", paddingLeft: 24, margin: "12px 0" })
globalStyle(`${markdown} li`, { margin: "6px 0" })
globalStyle(`${markdown} blockquote`, {
  borderLeft: "2px solid var(--border)",
  paddingLeft: 16,
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 19
})
globalStyle(`${markdown} > [data-streamdown="table-wrapper"]:has(> div > table[data-streamdown="table"])`, {
  border: 0,
  borderRadius: 0,
  background: "transparent",
  padding: 0
})
globalStyle(`${markdown} table`, { width: "100%", borderCollapse: "collapse", fontSize: 14 })
globalStyle(`${markdown} td, ${markdown} th`, {
  borderBottom: "1px solid var(--border)",
  padding: 8,
  textAlign: "left"
})
export const citationNumber = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 24,
  height: 24,
  flexShrink: 0,
  color: "var(--primary)",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1,
  borderRadius: 4,
  border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
  background: "var(--accent)"
})
export const citation = style([
  citationNumber,
  {
    minWidth: 16,
    height: 12,
    padding: "0 2px",
    fontSize: 8,
    borderRadius: 3,
    position: "relative",
    top: -6,
    cursor: "pointer",
    verticalAlign: "baseline",
    ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
  }
])
export const unresolvedCitation = style([
  citation,
  {
    color: "var(--state-danger)",
    background: "var(--state-danger-soft)",
    borderColor: "color-mix(in srgb, var(--state-danger) 25%, transparent)",
    cursor: "help"
  }
])
export const sourceNumber = style([
  citationNumber,
  { minWidth: 16, height: 16, padding: "0 2px", marginTop: 2, fontSize: 10, borderRadius: 3 }
])
export const source = style({
  display: "flex",
  width: "100%",
  gap: 12,
  alignItems: "start",
  textAlign: "left",
  padding: "10px 0",
  fontSize: 14,
  borderBottom: "1px solid var(--border)",
  cursor: "pointer",
  ":hover": { color: "var(--primary)" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const unavailableSourceNumber = style([
  sourceNumber,
  {
    color: "var(--state-danger)",
    background: "var(--state-danger-soft)",
    borderColor: "color-mix(in srgb, var(--state-danger) 25%, transparent)"
  }
])
export const unavailableSource = style([source, { cursor: "default", ":hover": { color: "inherit" } }])
export const sourcesTrigger = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  minHeight: 44,
  padding: "8px 0",
  fontSize: 14,
  fontWeight: 600,
  textAlign: "left",
  borderTop: "1px solid var(--border)",
  cursor: "pointer",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
export const evidencePanel = style({
  display: "block",
  boxShadow: "none",
  height: "auto",
  position: "fixed",
  top: 64,
  bottom: 0,
  right: 0,
  width: 440,
  maxWidth: "100vw",
  zIndex: 40,
  background: "var(--card)",
  borderLeft: "1px solid var(--border)",
  overflowY: "auto",
  padding: 24,
  outline: "none",
  selectors: {
    '&[data-state="open"]': { animation: `${drawerEnter} 240ms cubic-bezier(0.2, 0, 0, 1) both` },
    '&[data-state="closed"]': { animation: `${drawerExit} 180ms ease-in both`, pointerEvents: "none" }
  },
  "@media": {
    "(max-width: 63.99rem)": { top: 0, width: "100vw", padding: "24px 20px", zIndex: 60 },
    "(prefers-reduced-motion: reduce)": { animation: "none !important" }
  }
})
export const overlay = style({
  position: "fixed",
  inset: 0,
  background: "color-mix(in srgb, var(--foreground) 25%, transparent)",
  zIndex: 50,
  selectors: {
    '&[data-state="open"]': { animation: `${overlayEnter} 240ms ease-out both` },
    '&[data-state="closed"]': { animation: `${overlayExit} 180ms ease-in both`, pointerEvents: "none" }
  },
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none !important" } }
})
export const quote = style({
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 20,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere"
})

export const passageMarkdown = style({ minWidth: 0, whiteSpace: "normal" })
export const passagePreview = style({
  maxHeight: "16rem",
  overflow: "auto",
  overscrollBehavior: "contain",
  padding: "12px 16px",
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--background)",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})
globalStyle(`${passageMarkdown} h1, ${passageMarkdown} h2, ${passageMarkdown} h3`, {
  fontFamily: "var(--font-public-sans), sans-serif",
  fontSize: "1em",
  fontWeight: 600,
  margin: "12px 0"
})
globalStyle(`${passageMarkdown} p`, { margin: "8px 0" })
globalStyle(`${passageMarkdown} ul, ${passageMarkdown} ol`, { paddingLeft: 24, margin: "8px 0" })
globalStyle(`${passageMarkdown} ul`, { listStyle: "disc" })
globalStyle(`${passageMarkdown} ol`, { listStyle: "decimal" })
globalStyle(
  `${passageMarkdown} > div > [data-streamdown="table-wrapper"]:has(> div > table[data-streamdown="table"])`,
  {
    border: 0,
    borderRadius: 0,
    background: "transparent",
    padding: 0
  }
)
globalStyle(`${passageMarkdown} table`, { borderCollapse: "collapse", fontSize: 14 })
globalStyle(`${passageMarkdown} td, ${passageMarkdown} th`, {
  padding: 8,
  borderBottom: "1px solid var(--border)",
  textAlign: "left"
})
