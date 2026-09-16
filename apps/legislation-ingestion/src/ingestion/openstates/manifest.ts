import { z } from "zod"

const manifestSchema = z.object({
  archives: z.array(
    z.object({
      jurisdictionCode: z.string().regex(/^[a-z]{2}$/),
      session: z.string().min(1),
      url: z.url({ protocol: /^https$/ })
    })
  ),
  source: z.literal("openstates"),
  version: z.literal(1)
})

export type OpenStatesManifest = z.infer<typeof manifestSchema>

export function parseOpenStatesManifest(input: string): OpenStatesManifest {
  return manifestSchema.parse(JSON.parse(input))
}
