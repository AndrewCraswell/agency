import { z } from "zod"

const handle = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/)
const reference = z.strictObject({ $ref: z.string(), field: z.enum(["id", "url"]).optional() })
const textOrReference = z.union([z.string(), reference])
const validation = z.strictObject({ name: z.string(), value: textOrReference })
export const definitionSchema = z.strictObject({
  type: handle,
  name: z.string().min(1),
  displayNameKey: z.string().optional(),
  access: z.strictObject({ storefront: z.literal("PUBLIC_READ") }),
  capabilities: z
    .strictObject({
      publishable: z.strictObject({ enabled: z.boolean() }).optional(),
      translatable: z.strictObject({ enabled: z.boolean() }).optional(),
      renderable: z
        .strictObject({
          enabled: z.boolean(),
          data: z.strictObject({ metaTitleKey: z.string(), metaDescriptionKey: z.string().optional() }).optional()
        })
        .optional(),
      onlineStore: z
        .strictObject({ enabled: z.boolean(), data: z.strictObject({ urlHandle: handle }).optional() })
        .optional()
    })
    .optional(),
  fieldDefinitions: z
    .array(
      z.strictObject({
        key: handle,
        name: z.string().min(1),
        type: z.string().min(1),
        required: z.boolean().optional(),
        validations: z.array(validation).optional()
      })
    )
    .min(1)
})
export const fieldDefinitionSchema = z.strictObject({
  namespace: handle,
  key: handle,
  name: z.string().min(1),
  type: z.string().min(1),
  ownerType: z.literal("PRODUCT"),
  validations: z.array(validation).optional(),
  access: z.strictObject({ storefront: z.literal("PUBLIC_READ") }).optional()
})
export const entrySchema = z.strictObject({
  type: handle,
  handle,
  fields: z.record(z.string(), z.unknown()),
  status: z.enum(["ACTIVE", "DRAFT"]).optional()
})
export const pageSchema = z.strictObject({
  handle,
  title: z.string().min(1),
  body: z.string().default(""),
  templateSuffix: z.string().default(""),
  isPublished: z.boolean().default(false)
})
export type MenuItem = {
  title: string
  type: "HTTP" | "PAGE" | "COLLECTION" | "PRODUCT" | "BLOG" | "ARTICLE" | "FRONTPAGE" | "CATALOG"
  url?: z.infer<typeof textOrReference>
  resourceId?: z.infer<typeof textOrReference>
  items?: MenuItem[]
}
const menuItem: z.ZodType<MenuItem> = z.lazy(() =>
  z.strictObject({
    title: z.string().min(1),
    type: z.enum(["HTTP", "PAGE", "COLLECTION", "PRODUCT", "BLOG", "ARTICLE", "FRONTPAGE", "CATALOG"]),
    url: textOrReference.optional(),
    resourceId: textOrReference.optional(),
    items: z.array(menuItem).optional()
  })
)
export const menuSchema = z.strictObject({ handle, title: z.string().min(1), items: z.array(menuItem).min(1) })
export const fileSchema = z.strictObject({
  filename: z.string().regex(/^[a-z0-9][a-z0-9._-]*\.(png|jpg|jpeg|webp|pdf)$/),
  path: z.string().min(1),
  alt: z.string()
})
export const assignmentSchema = z.strictObject({
  productHandle: handle,
  namespace: handle,
  key: handle,
  value: textOrReference
})

export const remoteSchema = z.object({ id: z.string().min(1) }).passthrough()
export const resultSchema = z.object({
  result: z.object({
    resource: remoteSchema.nullable(),
    userErrors: z.array(z.object({ message: z.string(), field: z.array(z.string()).nullable().optional() }))
  })
})
