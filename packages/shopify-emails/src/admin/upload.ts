import { readFile } from "node:fs/promises"
import { basename, extname } from "node:path"
import { z } from "zod"
import type { AdminClient } from "./client.ts"

/*
 * Putting an image on the store's CDN, so a template can name it by URL.
 *
 * Gmail proxies every image through its own cache and drops `data:` sources outright, so an icon
 * carried inline as base64 cannot render there however small it is. Hosting is the only fix.
 *
 * Shopify takes an upload in two steps: a staged target is asked for, the bytes are posted straight
 * to that target, and only then does the file record point at what was posted. A freshly created
 * file is still being processed, so its CDN URL is read back rather than assumed.
 */

const STAGE_MUTATION = `
  mutation StageUploads($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`

const CREATE_MUTATION = `
  mutation CreateFiles($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        alt
        ... on MediaImage { image { url width height } }
      }
      userErrors { field message }
    }
  }
`

const STATUS_QUERY = `
  query FileStatus($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on MediaImage {
        id
        fileStatus
        image { url }
      }
    }
  }
`

const userErrors = z.array(z.object({ field: z.array(z.string()).nullable(), message: z.string() }))

const stageResponse = z.object({
  stagedUploadsCreate: z.object({
    stagedTargets: z.array(
      z.object({
        url: z.string(),
        resourceUrl: z.string(),
        parameters: z.array(z.object({ name: z.string(), value: z.string() }))
      })
    ),
    userErrors
  })
})

const createResponse = z.object({
  fileCreate: z.object({
    files: z.array(
      z.object({
        id: z.string(),
        fileStatus: z.string(),
        image: z.object({ url: z.string(), width: z.number(), height: z.number() }).nullish()
      })
    ),
    userErrors
  })
})

const statusResponse = z.object({
  nodes: z.array(
    z
      .object({
        id: z.string(),
        fileStatus: z.string(),
        image: z.object({ url: z.string() }).nullish()
      })
      .nullable()
  )
})

export type UploadedAsset = {
  readonly name: string
  readonly url: string
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
}

const mimeType = (path: string): string => {
  const found = MIME_TYPES[extname(path).toLowerCase()]
  if (!found) {
    throw new Error(`${basename(path)} is not an image this can host. Use a PNG, JPEG, GIF, WebP or SVG.`)
  }
  return found
}

const reportErrors = (where: string, errors: z.infer<typeof userErrors>): void => {
  if (errors.length > 0) {
    throw new Error(`${where} was refused: ${errors.map((error) => error.message).join("; ")}`)
  }
}

/*
 * The staged target is an ordinary form post rather than anything Shopify-flavoured, and its own
 * parameters carry the authorisation. They have to be written before the file, because the bucket
 * reads the fields in order and ignores everything after the content.
 */
const postToTarget = async (
  target: z.infer<typeof stageResponse>["stagedUploadsCreate"]["stagedTargets"][number],
  file: Blob,
  name: string
): Promise<void> => {
  const form = new FormData()
  for (const parameter of target.parameters) {
    form.append(parameter.name, parameter.value)
  }
  form.append("file", file, name)

  const response = await fetch(target.url, { method: "POST", body: form })
  if (!response.ok) {
    throw new Error(`Uploading ${name} returned ${response.status} ${response.statusText}.`)
  }
}

/* Processing is quick but not instant, and a file has no URL to report until it finishes. */
const awaitReady = async (client: AdminClient, ids: readonly string[]): Promise<Map<string, string>> => {
  const ready = new Map<string, string>()

  for (let attempt = 0; attempt < 20 && ready.size < ids.length; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const { nodes } = await client({ query: STATUS_QUERY, variables: { ids: [...ids] }, schema: statusResponse })
    for (const node of nodes) {
      if (node?.image?.url && node.fileStatus === "READY") {
        ready.set(node.id, node.image.url)
      }
    }
  }
  return ready
}

/** Hosts each image and answers with the CDN URL a template should name it by. */
export const uploadAssets = async (
  client: AdminClient,
  paths: readonly string[]
): Promise<readonly UploadedAsset[]> => {
  const files = paths.map((path) => ({ path, name: basename(path), type: mimeType(path) }))

  const staged = await client({
    query: STAGE_MUTATION,
    variables: {
      input: files.map((file) => ({
        filename: file.name,
        mimeType: file.type,
        httpMethod: "POST",
        resource: "FILE"
      }))
    },
    schema: stageResponse
  })
  reportErrors("The upload", staged.stagedUploadsCreate.userErrors)

  const targets = staged.stagedUploadsCreate.stagedTargets
  if (targets.length !== files.length) {
    throw new Error(`Asked to host ${files.length} images but the store staged ${targets.length}.`)
  }

  await Promise.all(
    files.map(async (file, index) => {
      const target = targets[index]
      if (!target) {
        throw new Error(`The store staged no target for ${file.name}.`)
      }
      await postToTarget(target, new Blob([await readFile(file.path)], { type: file.type }), file.name)
    })
  )

  const created = await client({
    query: CREATE_MUTATION,
    variables: {
      files: files.map((file, index) => ({
        alt: file.name,
        contentType: "IMAGE",
        originalSource: targets[index]?.resourceUrl
      }))
    },
    schema: createResponse
  })
  reportErrors("The file", created.fileCreate.userErrors)

  const ids = created.fileCreate.files.map((file) => file.id)
  const ready = await awaitReady(client, ids)

  return created.fileCreate.files.map((file, index) => {
    const url = ready.get(file.id) ?? file.image?.url
    if (!url) {
      throw new Error(`${files[index]?.name} was stored but is still processing. Read its URL from Content, Files.`)
    }
    return { name: files[index]?.name ?? file.id, url }
  })
}
