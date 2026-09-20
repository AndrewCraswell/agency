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
  padding: "2rem 24px",
  "@media": { [mobile]: { padding: "24px 20px 20px" } }
})

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

export const body = style({
  display: "flex",
  width: "100%",
  maxWidth: "45rem",
  flexDirection: "column",
  gap: "2rem",
  "@media": { [mobile]: { gap: "1.5rem" } }
})
