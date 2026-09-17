import { organizationMembershipEndReasons } from "@repo/legislation-core/domain/membership"
import { z } from "zod"

export const ingestionContract = { membershipEndReasons: organizationMembershipEndReasons }

export const ingestionReadinessSchema = z.object({
  status: z.literal("ready"),
  ingestionContract: z.object({ membershipEndReasons: z.array(z.string()) })
})
