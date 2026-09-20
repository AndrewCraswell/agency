import { globalStyle, style } from "@vanilla-extract/css"

export const root = style({
  display: "flex",
  flexDirection: "column",
  gap: 16,
  minWidth: 0,
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--card)",
  color: "var(--foreground)",
  "@media": { "(max-width: 40rem)": { padding: 14 } }
})
export const heading = style({ margin: 0, fontSize: 18, lineHeight: 1.4, fontWeight: 600 })
export const toolbar = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12
})
export const viewControls = style({ display: "flex", gap: 6, border: 0, margin: 0, padding: 0 })
export const contextControl = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  minHeight: 44,
  fontSize: 13,
  cursor: "pointer"
})
export const unchangedNotice = style({
  display: "block",
  padding: 12,
  background: "var(--secondary)",
  borderRadius: 6,
  fontSize: 14
})
export const emptyNotice = style({ display: "block", marginTop: 4, color: "var(--muted-foreground)" })
export const library = style({
  minWidth: 0,
  border: "1px solid var(--border)",
  borderRadius: 6,
  overflow: "hidden",
  vars: {
    "--diff-background-color": "var(--card)",
    "--diff-text-color": "var(--foreground)",
    "--diff-font-family": "var(--font-ibm-plex-mono), monospace",
    "--diff-code-insert-background-color": "color-mix(in srgb, var(--state-success) 12%, var(--card))",
    "--diff-code-delete-background-color": "var(--state-danger-soft)",
    "--diff-gutter-insert-background-color": "color-mix(in srgb, var(--state-success) 20%, var(--card))",
    "--diff-gutter-delete-background-color": "var(--state-danger-soft)",
    "--diff-code-insert-edit-background-color": "color-mix(in srgb, var(--state-success) 30%, var(--card))",
    "--diff-code-delete-edit-background-color": "color-mix(in srgb, var(--state-danger) 25%, var(--card))",
    "--diff-code-insert-text-color": "var(--foreground)",
    "--diff-code-delete-text-color": "var(--foreground)",
    "--diff-code-insert-edit-text-color": "var(--foreground)",
    "--diff-code-delete-edit-text-color": "var(--foreground)",
    "--diff-gutter-insert-text-color": "var(--foreground)",
    "--diff-gutter-delete-text-color": "var(--foreground)"
  }
})
globalStyle(`${library} .diff`, { fontSize: 13, lineHeight: 1.6 })
globalStyle(`${library} .diff-code`, { overflowWrap: "anywhere", wordBreak: "normal", whiteSpace: "pre-wrap" })
globalStyle(`${library} .diff-gutter-col`, { width: "5ch" })
globalStyle(`${library} .diff-code-omit`, { background: "var(--secondary)" })
globalStyle(`${library} .diff-decoration-content`, {
  padding: "6px 12px",
  color: "var(--muted-foreground)",
  background: "var(--secondary)"
})
export const visuallyHidden = style({
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0
})
