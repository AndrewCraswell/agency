import { style } from "@vanilla-extract/css"

export const root = style({ width: "100%", maxWidth: 920, minWidth: 0, margin: "0 auto" })
export const header = style({ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 })
export const heading = style({ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--foreground)" })
export const description = style({ margin: 0, maxWidth: "76ch", fontSize: 14, color: "var(--foreground)" })
export const disclaimer = style({ margin: 0, fontSize: 12, color: "var(--muted-foreground)" })
