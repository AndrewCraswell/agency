import { z } from "zod"
import { organizationMembershipEndReasons } from "./membership.js"

export const ingestionContract = { membershipEndReasons: organizationMembershipEndReasons }

export const ingestionReadinessSchema = z.object({
  status: z.literal("ready"),
  ingestionContract: z.object({ membershipEndReasons: z.array(z.string()) })
})
