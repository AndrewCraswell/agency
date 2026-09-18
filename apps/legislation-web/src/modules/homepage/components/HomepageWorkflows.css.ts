import { style } from "@vanilla-extract/css"
import { entranceEasing, entrancePose, entranceRange, scrollEntrance } from "./HomepageLanding.css"

export const band = style({
  background: "var(--secondary)",
  borderBlock: "1px solid var(--border)",
  padding: "96px 24px 104px",
  overflowX: "clip",
  "@media": { "(max-width: 48rem)": { padding: "56px 20px" } }
})
export const heading = style({ display: "grid", gap: 16, maxWidth: 760, marginBottom: 64 })
export const title = style({
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 36,
  fontWeight: 600,
  lineHeight: 1.15,
  textWrap: "pretty",
  "@media": { "(max-width: 48rem)": { fontSize: 30 } }
})
export const acts = style({ display: "grid", gap: 80, "@media": { "(max-width: 48rem)": { gap: 56 } } })
export const act = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 300fr) minmax(0, 676fr)",
  gap: 64,
  alignItems: "start",
  "@media": {
    "(max-width: 68rem)": { gap: 32 },
    "(max-width: 48rem)": { gridTemplateColumns: "minmax(0, 1fr)", gap: 24 }
  }
})
export const reverseAct = style([act, { direction: "rtl", "@media": { "(max-width: 48rem)": { direction: "ltr" } } }])
export const copy = style({ display: "grid", gap: 12, direction: "ltr", minWidth: 0 })
export const step = style({
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 11,
  lineHeight: 1.5,
  color: "var(--ring)",
  textTransform: "uppercase"
})
export const actTitle = style({
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: 24,
  fontWeight: 600,
  lineHeight: 1.2,
  textWrap: "pretty"
})
export const body = style({ fontSize: 15, lineHeight: 1.65, color: "var(--muted-foreground)", textWrap: "pretty" })
export const preview = style([
  scrollEntrance,
  {
    vars: {
      [entrancePose]: "translate3d(64px, 120px, 0) rotate(2deg) scale(0.94)",
      [entranceRange]: "entry 3% contain 22%",
      [entranceEasing]: "cubic-bezier(0.28, 0.1, 0.62, 1)"
    },
    direction: "ltr",
    minWidth: 0,
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--card)",
    overflow: "hidden",
    boxShadow: "0 14px 36px -14px color-mix(in srgb, var(--foreground) 12%, transparent)",
    selectors: {
      [`${reverseAct} &`]: {
        vars: { [entrancePose]: "translate3d(-64px, 120px, 0) rotate(-2deg) scale(0.94)" }
      },
      [`${acts} > :nth-child(2) &`]: {
        vars: {
          [entranceRange]: "entry 9% contain 36%",
          [entranceEasing]: "cubic-bezier(0.24, 0.12, 0.68, 1)"
        }
      },
      [`${acts} > :nth-child(3) &`]: {
        vars: {
          [entranceRange]: "entry 0% contain 18%",
          [entranceEasing]: "cubic-bezier(0.3, 0.08, 0.6, 1)"
        }
      },
      [`${acts} > :nth-child(4) &`]: {
        vars: {
          [entranceRange]: "entry 6% contain 30%",
          [entranceEasing]: "cubic-bezier(0.24, 0.18, 0.66, 1)"
        }
      }
    },
    "@media": {
      "(max-width: 48rem)": {
        vars: { [entrancePose]: "translate3d(0, 44px, 0) scale(0.985)" },
        selectors: {
          [`${reverseAct} &`]: { vars: { [entrancePose]: "translate3d(0, 44px, 0) scale(0.985)" } }
        }
      }
    }
  }
])
export const chrome = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 12,
  padding: "12px 20px",
  background: "var(--background)",
  borderBottom: "1px solid var(--border)",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 11,
  color: "var(--subtle)",
  textTransform: "uppercase"
})
export const textLink = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--font-public-sans), sans-serif",
  fontSize: 12,
  textTransform: "none",
  color: "var(--primary)",
  textDecoration: "none",
  ":hover": { textDecoration: "underline" },
  ":focus-visible": { outline: "2px solid var(--ring)", outlineOffset: 3 }
})
export const readerBody = style({
  padding: 24,
  display: "grid",
  gap: 20,
  "@media": { "(max-width: 40rem)": { padding: 16 } }
})
export const version = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  paddingBottom: 16,
  borderBottom: "1px solid var(--border)"
})
export const documentTitle = style({
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 22,
  lineHeight: 1.3,
  marginTop: 8
})
export const highlight = style({
  padding: "16px 20px",
  borderLeft: "2px solid var(--ring)",
  background: "color-mix(in srgb, var(--accent) 45%, transparent)",
  display: "grid",
  gap: 10
})
export const documentText = style({
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 18,
  lineHeight: 1.6
})
export const readAction = style({
  justifySelf: "start",
  justifyContent: "flex-start",
  width: "fit-content",
  paddingInline: 0,
  fontSize: 12,
  color: "var(--primary)"
})
export const comparison = style({ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" })
export const diffColumn = style({ minWidth: 0, selectors: { "& + &": { borderLeft: "1px solid var(--border)" } } })
export const diffHeader = style({
  padding: "16px 20px",
  display: "grid",
  gap: 6,
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  "@media": { "(max-width: 40rem)": { padding: 12 } }
})
export const diffLocator = style({
  padding: "12px 20px",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 11,
  color: "var(--subtle)",
  "@media": { "(max-width: 40rem)": { padding: 12 } }
})
export const diffText = style({
  padding: "4px 20px 24px",
  fontFamily: "var(--font-newsreader), Georgia, serif",
  fontSize: 17,
  lineHeight: 1.6,
  overflowWrap: "break-word",
  "@media": { "(max-width: 40rem)": { padding: "4px 12px 20px", fontSize: 16 } }
})
export const removal = style({
  background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
  color: "var(--destructive)",
  textDecoration: "line-through"
})
export const addition = style({
  background: "var(--accent)",
  color: "var(--primary)",
  textDecoration: "underline",
  textUnderlineOffset: 3
})
export const previewFooter = style({
  minHeight: 56,
  padding: "12px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 12,
  borderTop: "1px solid var(--border)",
  background: "var(--background)",
  fontSize: 12,
  color: "var(--subtle)"
})
export const listBody = style({ paddingInline: 20, minHeight: 270 })
export const listItem = style({
  paddingBlock: 20,
  display: "grid",
  gap: 8,
  selectors: { "& + &": { borderTop: "1px solid var(--border)" } }
})
export const itemMeta = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
  fontSize: 11,
  color: "var(--subtle)"
})
export const itemTitle = style({ fontSize: 16, fontWeight: 600, lineHeight: 1.4 })
export const iconButton = style({ width: 32, height: 32, color: "var(--subtle)" })
export const empty = style({
  minHeight: 270,
  display: "grid",
  placeItems: "center",
  color: "var(--subtle)",
  fontSize: 14
})
export const review = style({
  display: "flex",
  alignItems: "center",
  gap: 6,
  minHeight: 28,
  fontSize: 11,
  cursor: "pointer"
})
export const finding = style({ fontSize: 16, lineHeight: 1.55 })
export const small = style({ fontSize: 11, lineHeight: 1.5, color: "var(--subtle)" })
export const copyError = style({ padding: "12px 20px", fontSize: 12, color: "var(--destructive)" })
