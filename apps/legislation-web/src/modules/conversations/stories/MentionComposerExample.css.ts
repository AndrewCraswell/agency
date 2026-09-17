import { style } from "@vanilla-extract/css"

export const stage = style({
  minHeight: "min(680px, 100dvh)",
  display: "flex",
  alignItems: "flex-end",
  padding: "24px 16px",
  background: "var(--background)"
})
export const workspace = style({ width: "100%", maxWidth: 720, marginInline: "auto" })
export const sent = style({ marginBottom: 24, fontSize: 16, overflowWrap: "anywhere" })
