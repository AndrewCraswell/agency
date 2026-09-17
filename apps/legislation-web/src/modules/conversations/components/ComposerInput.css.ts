import { globalStyle, style } from "@vanilla-extract/css"

export const anchor = style({ position: "relative", minHeight: 84 })
export const editor = style({
  minHeight: 84,
  maxHeight: 180,
  overflowY: "auto",
  padding: "18px 20px 8px",
  fontSize: 16,
  lineHeight: 1.75,
  outline: "none",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere"
})
globalStyle(`${editor} p`, { margin: 0 })
export const tag = style({
  display: "inline",
  padding: "2px 4px",
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  borderRadius: 4,
  fontWeight: 500,
  boxDecorationBreak: "clone"
})
export const picker = style({
  position: "fixed",
  width: 420,
  maxWidth: "calc(100vw - 32px)",
  borderRadius: 8,
  border: "1px solid var(--input)",
  overflow: "hidden",
  background: "var(--card)",
  boxShadow: "0 12px 24px rgb(15 20 19 / 16%)",
  display: "flex",
  flexDirection: "column",
  zIndex: 10
})
export const query = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 44,
  padding: "10px 14px",
  borderBottom: "1px solid var(--border)",
  fontSize: 16,
  fontWeight: 500
})
export const queryText = style({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })
export const queryLabel = style({
  marginLeft: "auto",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 11,
  fontWeight: 400,
  textTransform: "uppercase",
  color: "var(--muted-foreground)",
  textAlign: "right"
})
export const skeletons = style({ display: "grid", gap: 20, padding: "12px" })
export const skeleton = style({ height: 11, borderRadius: 2, background: "var(--secondary)" })
export const skeletonLong = style({ width: "52%" })
export const skeletonShort = style({ width: "41%" })
export const skeletonMedium = style({ width: "47%" })
export const skeletonStatic = style({ animation: "none" })
export const loadingFooter = style({
  display: "block",
  padding: "10px 12px",
  borderTop: "1px solid var(--border)",
  background: "var(--secondary)",
  color: "var(--muted-foreground)",
  fontSize: 14,
  lineHeight: "20px"
})
export const group = style({ border: 0, margin: 0, padding: 0, minWidth: 0 })
export const groupHeading = style({
  padding: "12px 14px 6px",
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 11,
  lineHeight: "16px",
  textTransform: "uppercase",
  color: "var(--muted-foreground)"
})
export const results = style({ maxHeight: "min(340px, 42dvh)", overflowY: "auto", padding: 0 })
export const option = style({
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 64,
  padding: "10px 14px",
  border: 0,
  borderRadius: 0,
  textAlign: "left",
  background: "transparent",
  color: "var(--foreground)",
  cursor: "pointer",
  selectors: {
    '&[aria-selected="true"]': { background: "var(--secondary)" },
    '&[aria-disabled="true"]': { opacity: 0.5, cursor: "default" }
  },
  "@media": { "(max-width: 400px)": { paddingInline: 8, gap: 8 } }
})
export const identity = style({ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 })
export const name = style({ fontSize: 16, fontWeight: 600, lineHeight: "22px", overflowWrap: "anywhere" })
export const detail = style({ fontSize: 14, lineHeight: "20px", color: "var(--muted-foreground)" })
export const kind = style({
  fontFamily: "var(--font-ibm-plex-mono), monospace",
  fontSize: 11,
  textTransform: "uppercase",
  color: "var(--muted-foreground)",
  flexShrink: 0,
  "@media": { "(max-width: 40rem)": { display: "none" } }
})
export const status = style({
  display: "block",
  margin: 0,
  padding: "12px 14px",
  fontSize: 14,
  color: "var(--muted-foreground)"
})
