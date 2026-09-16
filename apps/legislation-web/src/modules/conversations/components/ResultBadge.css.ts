import { style } from "@vanilla-extract/css"

export const badge = style({
  alignSelf: "flex-start",
  gap: 4,
  minHeight: 22,
  maxWidth: "100%",
  padding: "2px 8px",
  border: "1px solid var(--input)",
  borderRadius: 4,
  background: "var(--secondary)",
  color: "var(--muted-foreground)",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.3,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  selectors: {
    '&[data-result-tone="success"]': {
      color: "var(--state-success)",
      background: "color-mix(in srgb, var(--state-success) 10%, var(--card))",
      borderColor: "color-mix(in srgb, var(--state-success) 30%, var(--card))"
    },
    '&[data-result-tone="danger"]': {
      color: "var(--state-danger)",
      background: "color-mix(in srgb, var(--state-danger) 10%, var(--card))",
      borderColor: "color-mix(in srgb, var(--state-danger) 30%, var(--card))"
    },
    '&[data-result-tone="pending"]': {
      color: "var(--state-pending)",
      background: "color-mix(in srgb, var(--state-pending) 10%, var(--card))",
      borderColor: "color-mix(in srgb, var(--state-pending) 30%, var(--card))"
    }
  },
  "@media": {
    "(forced-colors: active)": { color: "CanvasText", background: "Canvas", borderColor: "CanvasText" }
  }
})
export const icon = style({ width: 12, height: 12, flexShrink: 0 })
