import { keyframes, style, type StyleRule } from "@vanilla-extract/css"

const glow = keyframes({
  from: { opacity: 0.2, transform: "scale(0.995, 0.98)" },
  to: { opacity: 0.85, transform: "scale(1.01, 1.04)" }
})
const glowLayer = {
  position: "absolute",
  zIndex: -1,
  inset: -1,
  borderRadius: "inherit",
  content: '""',
  pointerEvents: "none",
  animation: `${glow} 3.2s ease-in-out infinite alternate`
} satisfies StyleRule

export const composer = style({
  position: "relative",
  isolation: "isolate",
  border: "1px solid var(--input)",
  borderRadius: "1.25rem",
  background: "var(--card)",
  ":focus-within": { outline: "2px solid var(--ring)", outlineOffset: 3 }
})

export const homepageGlow = style({
  "::before": {
    ...glowLayer,
    boxShadow: [
      "0 0 6px color-mix(in srgb, var(--ring) 30%, transparent)",
      "-12px -3px 28px 3px color-mix(in srgb, var(--ring) 36%, transparent)",
      "6px 3px 18px color-mix(in srgb, var(--primary) 18%, transparent)"
    ].join(", ")
  },
  "::after": {
    ...glowLayer,
    boxShadow: [
      "0 0 6px color-mix(in srgb, var(--ring) 24%, transparent)",
      "12px 3px 28px 3px color-mix(in srgb, var(--ring) 36%, transparent)",
      "-6px -3px 18px color-mix(in srgb, var(--primary) 18%, transparent)"
    ].join(", "),
    animationDelay: "-1.6s",
    animationDirection: "alternate-reverse"
  },
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      "::before": { animation: "none", opacity: 0.6, transform: "none" },
      "::after": { animation: "none", opacity: 0.6, transform: "none" }
    },
    "(forced-colors: active)": {
      "::before": { display: "none" },
      "::after": { display: "none" }
    }
  }
})

export const question = style({
  minHeight: "5.25rem",
  maxHeight: "calc(6 * 1.55em + 26px)",
  overflowY: "auto",
  padding: "18px 20px 8px",
  borderRadius: "1.25rem 1.25rem 0 0",
  lineHeight: 1.55,
  fontSize: "1rem"
})

export const bar = style({
  display: "flex",
  minHeight: "3.5rem",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0 0.75rem 0.75rem"
})

export const send = style({
  width: "2.75rem",
  height: "2.75rem",
  borderRadius: "50%",
  padding: 0,
  flexShrink: 0,
  ":disabled": { opacity: 1, background: "var(--secondary)", color: "var(--subtle)" }
})

export const reference = style({
  width: "2.75rem",
  height: "2.75rem",
  padding: 0,
  borderRadius: "50%",
  color: "var(--muted-foreground)"
})
