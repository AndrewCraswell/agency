import { z } from "zod"

/** Retain only source precision; a calendar date never becomes a fabricated instant. */
export function parseVoteDate(value: string | undefined): { heldAt?: Date; heldDate?: string } {
  if (value === undefined) return {}
  const date = z.iso.date().safeParse(value)
  if (date.success) return { heldDate: date.data }
  const timestamp = z.iso.datetime({ offset: true }).safeParse(value)
  if (!timestamp.success) return {}
  const heldAt = new Date(timestamp.data)
  return Number.isFinite(heldAt.valueOf()) ? { heldAt } : {}
}
