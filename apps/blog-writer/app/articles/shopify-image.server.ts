import { z } from "zod"

type Graphql = (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>

/** Shopify rejects anything larger, and a featured image this size already costs a reader real bandwidth. */
const maximumImageBytes = 20 * 1024 * 1024
/** The formats Shopify Files accepts, mapped to the extension a downloaded image is named with. */
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp"
}

const stagedUploadMutation = `#graphql
  mutation StageArticleImage($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }`

const fileCreateMutation = `#graphql
  mutation CreateArticleImage($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id fileStatus ... on MediaImage { image { url } } }
      userErrors { field message }
    }
  }`

const fileStatusQuery = `#graphql
  query ArticleImageStatus($id: ID!) {
    node(id: $id) {
      ... on MediaImage { id fileStatus image { url } }
    }
  }`

const fileDetailsQuery = `#graphql
  query ArticleImageDetails($id: ID!) {
    node(id: $id) {
      ... on MediaImage { id fileStatus alt image { url altText } }
    }
  }`

const StagedTargetSchema = z.object({
  url: z.string(),
  resourceUrl: z.string(),
  parameters: z.array(z.object({ name: z.string(), value: z.string() }))
})
const UserErrorsSchema = z.array(z.object({ field: z.array(z.string()).nullable(), message: z.string() }))
const MediaImageSchema = z.object({
  id: z.string(),
  fileStatus: z.string(),
  image: z.object({ url: z.string() }).nullable()
})
const MediaImageDetailsSchema = MediaImageSchema.extend({
  alt: z.string().nullable(),
  image: z.object({ url: z.string(), altText: z.string().nullable() }).nullable()
})

/** Matches the identifier the admin's file picker hands back, so a hand-crafted request cannot probe other nodes. */
const mediaImageGid = /^gid:\/\/shopify\/MediaImage\/\d+$/

/** Raised when an image cannot be stored, so the merchant reads what to fix instead of a generic failure. */
export class ArticleImageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArticleImageUploadError"
  }
}

async function readPayload<Schema extends z.ZodType>(response: Response, schema: Schema): Promise<z.output<Schema>> {
  const payload = z
    .object({ data: z.unknown(), errors: z.array(z.object({ message: z.string() })).optional() })
    .parse(await response.json())
  if (payload.errors?.length) {
    throw new ArticleImageUploadError(payload.errors.map(({ message }) => message).join("; "))
  }
  return schema.parse(payload.data)
}

function rejectUserErrors(userErrors: z.output<typeof UserErrorsSchema>) {
  if (userErrors.length > 0) {
    throw new ArticleImageUploadError(userErrors.map(({ message }) => message).join("; "))
  }
}

/** Shopify reports a new file as `UPLOADED` and only serves a URL once processing reaches `READY`. */
async function waitForReadyImage(graphql: Graphql, fileGid: string, attempts: number, delayMs: number) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    const payload = await readPayload(
      await graphql(fileStatusQuery, { variables: { id: fileGid } }),
      z.object({ node: MediaImageSchema.nullable() })
    )
    if (payload.node === null) {
      throw new ArticleImageUploadError("Shopify lost track of the uploaded image")
    }
    if (payload.node.fileStatus === "FAILED") {
      throw new ArticleImageUploadError("Shopify could not process that image")
    }
    if (payload.node.fileStatus === "READY" && payload.node.image !== null) {
      return payload.node.image.url
    }
  }
  throw new ArticleImageUploadError("That image is still processing. Try adding it again in a moment.")
}

/**
 * Stores an image in Shopify Files and returns the address the storefront can serve.
 * The bytes go through a staged target rather than the Admin API, which is how Shopify accepts binary uploads.
 */
export async function uploadArticleImage(
  graphql: Graphql,
  input: { file: File; altText: string },
  options: { attempts?: number; delayMs?: number } = {}
): Promise<{ url: string; altText: string }> {
  if (!Object.hasOwn(imageExtensions, input.file.type)) {
    throw new ArticleImageUploadError("Choose a JPEG, PNG, GIF, or WebP image")
  }
  if (input.file.size > maximumImageBytes) {
    throw new ArticleImageUploadError("Choose an image smaller than 20 MB")
  }

  const staged = await readPayload(
    await graphql(stagedUploadMutation, {
      variables: {
        input: [
          {
            filename: input.file.name,
            mimeType: input.file.type,
            fileSize: String(input.file.size),
            httpMethod: "POST",
            resource: "FILE"
          }
        ]
      }
    }),
    z.object({
      stagedUploadsCreate: z.object({ stagedTargets: z.array(StagedTargetSchema), userErrors: UserErrorsSchema })
    })
  )
  rejectUserErrors(staged.stagedUploadsCreate.userErrors)
  const target = staged.stagedUploadsCreate.stagedTargets[0]
  if (target === undefined) {
    throw new ArticleImageUploadError("Shopify did not offer anywhere to store the image")
  }

  const upload = new FormData()
  for (const parameter of target.parameters) {
    upload.append(parameter.name, parameter.value)
  }
  upload.append("file", input.file, input.file.name)
  const uploadResponse = await fetch(target.url, { method: "POST", body: upload })
  if (!uploadResponse.ok) {
    throw new ArticleImageUploadError("The image could not be uploaded to Shopify")
  }

  const created = await readPayload(
    await graphql(fileCreateMutation, {
      variables: {
        files: [{ originalSource: target.resourceUrl, contentType: "IMAGE", alt: input.altText }]
      }
    }),
    z.object({ fileCreate: z.object({ files: z.array(MediaImageSchema), userErrors: UserErrorsSchema }) })
  )
  rejectUserErrors(created.fileCreate.userErrors)
  const file = created.fileCreate.files[0]
  if (file === undefined) {
    throw new ArticleImageUploadError("Shopify did not return the stored image")
  }
  if (file.fileStatus === "READY" && file.image !== null) {
    return { url: file.image.url, altText: input.altText }
  }

  const url = await waitForReadyImage(graphql, file.id, options.attempts ?? 8, options.delayMs ?? 750)
  return { url, altText: input.altText }
}

/**
 * Resolves a file the merchant chose in the admin's own image picker to the address the storefront can serve.
 * The picker hands back a `MediaImage` identifier and never a URL, so the address has to be read back here.
 */
export async function resolveArticleImage(
  graphql: Graphql,
  imageGid: string
): Promise<{ url: string; altText: string }> {
  if (!mediaImageGid.test(imageGid)) {
    throw new ArticleImageUploadError("That file is not an image")
  }

  const payload = await readPayload(
    await graphql(fileDetailsQuery, { variables: { id: imageGid } }),
    z.object({ node: MediaImageDetailsSchema.nullable() })
  )
  if (payload.node === null) {
    throw new ArticleImageUploadError("Shopify could not find that image")
  }
  if (payload.node.image === null) {
    throw new ArticleImageUploadError("That image is still processing. Try adding it again in a moment.")
  }
  return { url: payload.node.image.url, altText: payload.node.image.altText ?? payload.node.alt ?? "" }
}
