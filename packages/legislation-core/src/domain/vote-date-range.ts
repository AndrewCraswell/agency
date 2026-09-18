import { z } from "zod"
import { LegislationError } from "./errors"

const voteDateBoundSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })])

export const voteDateRangeSchema = z
  .object({ from: voteDateBoundSchema.optional(), to: voteDateBoundSchema.optional() })
  .refine(
    ({ from, to }) => {
      if (from === undefined || to === undefined) {
        return true
      }
      const endOfDay = z.iso.date().safeParse(to).success ? 86_400_000 - 1 : 0
      return Date.parse(from) <= Date.parse(to) + endOfDay
    },
    { message: "from must be less than or equal to to" }
  )

export type VoteDateRange = z.infer<typeof voteDateRangeSchema>

export function validateVoteDateRange(from: string | undefined, to: string | undefined): void {
  const parsed = voteDateRangeSchema.safeParse({ from, to })
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    if (field === "from" || field === "to") {
      throw new LegislationError("invalid_request", `${field} must be an ISO date or RFC3339 timestamp`)
    }
    throw new LegislationError("invalid_request", "from must be less than or equal to to")
  }
}
