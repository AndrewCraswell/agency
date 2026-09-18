import { createVar, keyframes, style } from "@vanilla-extract/css"

export const entrancePose = createVar()
export const entranceRange = createVar()
export const entranceEasing = createVar()
const cardEntrance = keyframes({
  from: { opacity: 0, transform: entrancePose },
  to: { opacity: 1, transform: "none" }
})
export const scrollEntrance = style({
  vars: {
    [entrancePose]: "translate3d(0, 96px, 0) scale(0.96)",
    [entranceRange]: "entry 0% contain 28%",
    [entranceEasing]: "cubic-bezier(0.22, 0.1, 0.64, 1)"
  },
  transformOrigin: "center bottom",
  "@media": {
    "screen and (prefers-reduced-motion: no-preference)": {
      "@supports": {
        "(animation-timeline: view()) and (animation-range: entry 0% contain 100%)": {
          animationName: cardEntrance,
          animationDuration: "1ms",
          animationTimingFunction: entranceEasing,
          animationFillMode: "both",
          animationTimeline: "view(block)",
          animationRange: entranceRange,
          selectors: { "&:focus-within": { animationName: "none" } }
        }
      }
    },
    "(max-width: 48rem)": {
      vars: { [entrancePose]: "translate3d(0, 44px, 0) scale(0.985)" }
    }
  }
})

const inviteScroll = keyframes({
  "0%, 100%": { transform: "translateY(0)" },
  "50%": { transform: "translateY(6px)" }
})
const hoverScroll = keyframes({
  "0%, 100%": { transform: "translateY(0)" },
  "50%": { transform: "translateY(10px)" }
})

export const page = style({ minHeight: "100dvh" })
export const skip = style({
  position: "absolute",
  top: 8,
  left: 16,
  zIndex: 10,
  padding: "8px 16px",
  background: "var(--card)",
  color: "var(--foreground)",
  transform: "translateY(-200%)",
  ":focus": { transform: "translateY(0)", outline: "2px solid var(--ring)" }
})
export const hero = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 64,
  padding: "96px 24px 64px",
  scrollMarginTop: 24,
  "@media": {
    "(max-width: 48rem)": { padding: "56px 20px 40px", gap: 40 },
    "(max-height: 48rem) and (min-width: 48rem)": { paddingTop: 56, gap: 40 }
  }
})
export const heroContent = style({
  display: "flex",
  flexDirection: "column",
  gap: 56,
  width: "100%",
  maxWidth: 1040,
  alignItems: "center",
  "@media": { "(max-width: 48rem)": { gap: 44 } }
})
export const heading = style({ display: "grid", gap: 16, maxWidth: 720, textAlign: "center" })
export const title = style({
  margin: 0,
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 46,
  fontWeight: 600,
  lineHeight: 1.12,
  textWrap: "balance",
  letterSpacing: 0,
  "@media": { "(max-width: 48rem)": { fontSize: 36 }, "(max-width: 24rem)": { fontSize: 32 } }
})
export const description = style({
  margin: "0 auto",
  maxWidth: 600,
  fontSize: 16,
  lineHeight: 1.65,
  color: "var(--muted-foreground)",
  textWrap: "pretty"
})
export const composer = style({ width: "100%", maxWidth: 720, minWidth: 0 })
export const questions = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minHeight: 176,
  paddingInline: 16,
  "@media": { "(max-width: 40rem)": { paddingInline: 0 } }
})
export const questionRow = style({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  maxWidth: "100%",
  minWidth: 0,
  selectors: {
    "&:first-child, &:last-child": { maxWidth: "84%" },
    "&:nth-child(2)": { transform: "translateX(-12px)" },
    "&:nth-child(3)": { transform: "translateX(12px)" }
  },
  "@media": {
    "(max-width: 40rem)": {
      flexWrap: "wrap",
      selectors: {
        "&:first-child, &:last-child": { maxWidth: "90%" },
        "&:nth-child(2), &:nth-child(3)": { transform: "none" }
      }
    }
  }
})
const questionShape = style({
  display: "inline-flex",
  boxSizing: "border-box",
  border: "1px solid var(--border)",
  minHeight: 36,
  height: "auto",
  maxWidth: "100%",
  width: "fit-content",
  flex: "0 1 auto",
  whiteSpace: "normal",
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 13,
  lineHeight: 1.4,
  fontWeight: 500
})
export const questionSkeleton = style([
  questionShape,
  {
    width: "44ch",
    height: "calc(1lh + 18px)",
    background: "var(--secondary)",
    selectors: {
      "&:nth-child(2)": { width: "42ch" },
      [`${questionRow}:first-child &`]: { width: "43ch" },
      [`${questionRow}:last-child &`]: { width: "48ch" }
    }
  }
])
export const question = style([
  questionShape,
  {
    textAlign: "center",
    color: "var(--foreground)",
    background: "var(--background)",
    borderColor: "var(--border)",
    boxShadow: "none",
    transition: "background-color 160ms ease, border-color 160ms ease",
    ":hover": { background: "var(--accent)", borderColor: "var(--ring)", color: "var(--foreground)" },
    "@media": { "(prefers-reduced-motion: reduce)": { transition: "none" } }
  }
])
export const handoff = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  padding: 8,
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 12,
  textTransform: "uppercase",
  color: "var(--subtle)",
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 4 },
  ":hover": { color: "var(--primary)" }
})
export const handoffArrow = style({
  animation: `${inviteScroll} 1.8s ease-in-out infinite`,
  selectors: {
    [`${handoff}:hover &, ${handoff}:focus-visible &`]: { animationName: hoverScroll, animationDuration: "900ms" }
  },
  "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } }
})
export const band = style({
  padding: "96px 24px",
  borderTop: "1px solid var(--border)",
  scrollMarginTop: 24,
  overflowX: "clip",
  "@media": { "(max-width: 48rem)": { padding: "56px 20px" } }
})
export const inner = style({ maxWidth: 1040, margin: "0 auto", minWidth: 0 })
export const sectionHead = style({ display: "grid", gap: 16, marginBottom: 48, maxWidth: 760 })
export const sectionDescription = style({
  maxWidth: 640,
  fontSize: 16,
  lineHeight: 1.65,
  color: "var(--muted-foreground)",
  textWrap: "pretty"
})
export const eyebrow = style({
  fontFamily: "var(--font-public-sans), sans-serif",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--subtle)",
  textTransform: "uppercase"
})
export const sectionTitle = style({
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 30,
  lineHeight: 1.2,
  fontWeight: 600,
  textWrap: "pretty",
  "@media": { "(max-width: 40rem)": { fontSize: 26 } }
})
export const proof = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 596fr) minmax(280px, 380fr)",
  gap: 64,
  alignItems: "start",
  "@media": {
    "(max-width: 68rem)": { gap: 32 },
    "(max-width: 48rem)": { gridTemplateColumns: "minmax(0, 1fr)", gap: 32 }
  }
})
export const answer = style([
  scrollEntrance,
  {
    vars: {
      [entranceRange]: "entry 0% entry 120%",
      [entranceEasing]: "cubic-bezier(0.3, 0.08, 0.72, 0.72)"
    },
    display: "grid",
    gap: 32,
    minWidth: 0
  }
])
export const rail = style([
  scrollEntrance,
  {
    vars: {
      [entrancePose]: "translate3d(52px, 120px, 0) rotate(2deg) scale(0.96)",
      [entranceRange]: "entry 8% entry 200%",
      [entranceEasing]: "cubic-bezier(0.28, 0.16, 0.68, 1)"
    },
    display: "grid",
    alignContent: "start",
    gap: 20,
    paddingLeft: 24,
    borderLeft: "1px solid var(--border)",
    minWidth: 0,
    "@media": {
      "(max-width: 48rem)": {
        vars: { [entrancePose]: "translate3d(0, 44px, 0) scale(0.985)" },
        paddingLeft: 0,
        borderLeft: 0
      }
    }
  }
])
