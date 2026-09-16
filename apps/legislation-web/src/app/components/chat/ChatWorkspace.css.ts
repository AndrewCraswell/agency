import { style } from "@vanilla-extract/css"

const mobile = "(max-width: 40rem)"

export const layout = style({ display: "flex", height: "100dvh", flexDirection: "column" })
export const withEvidence = style({ "@media": { "(min-width: 64rem)": { paddingRight: 440 } } })

export const scroll = style({
  scrollbarGutter: "auto !important",
  "@media": { [mobile]: { scrollbarWidth: "none" } }
})

export const content = style({
  display: "flex",
  minHeight: "100%",
  flexDirection: "column",
  alignItems: "center",
  padding: "88px 24px 56px",
  "@media": { [mobile]: { padding: "24px 20px 20px" } }
})

export const threadContent = style({ paddingTop: "2rem", paddingBottom: "2rem" })

export const jumpToLatest = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  position: "absolute",
  bottom: 12,
  left: 16,
  right: 16,
  width: "fit-content",
  maxWidth: "calc(100% - 32px)",
  marginInline: "auto",
  height: 44,
  padding: "0 16px",
  border: "1px solid var(--input)",
  borderRadius: 22,
  color: "var(--foreground)",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
  zIndex: 10,
  background: "var(--card)",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 2 }
})

export const composerDock = style({
  flexShrink: 0,
  padding: "1rem 1.5rem max(1rem, env(safe-area-inset-bottom))",
  background: "var(--background)",
  "@media": { [mobile]: { padding: "0.75rem 1.25rem max(0.75rem, env(safe-area-inset-bottom))" } }
})

export const start = style({
  display: "flex",
  width: "100%",
  maxWidth: 660,
  flexDirection: "column",
  gap: "2rem",
  "@media": { [mobile]: { gap: "1.5rem" } }
})

export const threadBody = style({ maxWidth: "45rem" })

export const heading = style({
  paddingBottom: 16,
  "@media": { [mobile]: { paddingBottom: 0 } }
})

export const title = style({
  margin: 0,
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 40,
  fontWeight: 600,
  lineHeight: 1.12,
  "@media": { [mobile]: { fontSize: "1.875rem", fontWeight: 400, lineHeight: 1.12 } }
})

export const headlineWide = style({ "@media": { [mobile]: { display: "none" } } })

export const headlineNarrow = style({
  display: "none",
  "@media": { [mobile]: { display: "block" } }
})

export const suggestion = style({
  display: "grid",
  width: "100%",
  minWidth: 0,
  minHeight: "3rem",
  height: "auto",
  gridTemplateColumns: "15px minmax(0, 1fr) 14px",
  gap: "0.75rem",
  justifyContent: "start",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "12px 16px",
  background: "var(--background)",
  textAlign: "left",
  whiteSpace: "normal",
  lineHeight: 1.4,
  boxShadow: "none",
  ":hover": { background: "var(--accent)" }
})

export const suggestionExtra = style({ "@media": { [mobile]: { display: "none" } } })

export const suggestionCopy = style({
  display: "flex",
  minWidth: 0,
  flexDirection: "column",
  gap: "0.25rem",
  overflowWrap: "anywhere"
})

export const suggestionQuestion = style({ fontSize: 14, fontWeight: 500 })
export const suggestionDescription = style({ fontSize: 12, color: "var(--subtle)", lineHeight: 1.4 })

export const mobileDescription = style({
  display: "none",
  "@media": {
    [mobile]: { display: "block", marginTop: 8, color: "var(--muted-foreground)", fontSize: 14, lineHeight: 1.5 }
  }
})
export const dataNote = style({
  fontSize: 14,
  lineHeight: 1.5,
  color: "var(--muted-foreground)",
  "@media": { [mobile]: { display: "none" } }
})
