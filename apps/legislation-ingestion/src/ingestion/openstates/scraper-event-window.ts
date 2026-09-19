import { z } from "zod"

/** Explicit inclusive calendar windows, shared by admission, retained evidence and canonical preparation. */
export const scraperEventWindow = z
  .strictObject({ start: z.iso.date(), end: z.iso.date() })
  .refine(({ start, end }) => {
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000
    return days >= 0 && days <= 6
  }, "Meeting windows must contain one to seven days")

export const washingtonEventWindow = scraperEventWindow.refine(
  ({ start, end }) => start >= "2025-01-01" && end <= "2026-12-31",
  "Washington meeting window is outside the reviewed session"
)
