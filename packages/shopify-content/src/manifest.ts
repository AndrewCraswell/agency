import { z } from "zod"
import { orderResources } from "./dependencies.ts"

const key = z.string().regex(/^[a-z][a-z0-9._-]*$/)
const reference = z.strictObject({ $ref: key, field: z.enum(["id", "url"]).optional() })

const value: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z
      .string()
      .refine((text) => !text.startsWith("gid://shopify/"), "Use a manifest reference instead of a store-specific ID."),
    z.number(),
    z.boolean(),
    z.null(),
    reference,
    z.array(value),
    z.record(z.string(), value).refine((object) => !("$ref" in object), "Invalid resource reference.")
  ])
)

export const manifestSchema = z.strictObject({
  name: key,
  resources: z
    .array(
      z.strictObject({
        key,
        kind: key,
        dependsOn: z.array(key).optional(),
        data: z.record(z.string(), value)
      })
    )
    .min(1)
})

export function parseManifest(input: unknown) {
  const manifest = manifestSchema.parse(input)
  return { ...manifest, resources: orderResources(manifest.resources) }
}
