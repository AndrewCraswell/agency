import { style } from "@vanilla-extract/css"

export const status = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginLeft: "auto",
  minHeight: 18,
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.4,
  color: "var(--foreground)"
})
export const title = style({
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.3,
  overflowWrap: "anywhere",
  color: "var(--foreground)"
})
export const explanation = style({
  display: "block",
  margin: 0,
  borderTop: "1px solid var(--border)",
  padding: "12px 16px",
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "var(--muted-foreground)",
  overflowWrap: "anywhere"
})
export const loading = style({ display: "block" })
export const skeleton = style({
  display: "block",
  width: "100%",
  height: 9,
  borderRadius: 2,
  background: "var(--secondary)"
})
export const skeletonTitle = style({ maxWidth: 300, height: 13 })
export const skeletonMeta = style({ maxWidth: 420, height: 10 })
