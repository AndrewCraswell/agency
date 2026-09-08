import { createHash } from "node:crypto"
import { readFileSync, realpathSync } from "node:fs"
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path"
import { setTimeout } from "node:timers/promises"
import { z } from "zod"
import type { AdminClient } from "./client.ts"
import type { InstalledResource, ResourceAdapter } from "./installer.ts"
import { createFile, filesQuery, fileStatus, stageFile } from "./queries.ts"
import { fileSchema } from "./schemas.ts"

const fileResult = z.object({
  id: z.string(),
  fileStatus: z.string(),
  url: z.string().nullable().optional(),
  image: z.object({ url: z.string() }).nullable().optional()
})
const errors = z.array(z.object({ message: z.string() }))

export function localFile(input: Record<string, unknown>, directory: string) {
  const data = fileSchema.parse(input)
  const root = realpathSync(directory)
  const path = realpathSync(resolve(root, data.path))
  const within = relative(root, path)
  if (isAbsolute(within) || within === ".." || within.startsWith(`..${sep}`)) {
    throw new Error("Content files must be inside the manifest directory.")
  }
  const bytes = readFileSync(path)
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
    throw new Error("Content files must be between 1 byte and 20 MB.")
  }
  const extension = extname(data.filename)
  const hash = createHash("sha256").update(bytes).digest("hex")
  const filename = `${basename(data.filename, extension)}-${hash.slice(0, 16)}${extension}`
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf"
  }
  return {
    ...data,
    bytes,
    filename,
    hash,
    mimeType: mimeTypes[extension],
    contentType: extension === ".pdf" ? "FILE" : "IMAGE"
  }
}

function readyFile(input: unknown): InstalledResource {
  const file = fileResult.parse(input)
  if (file.fileStatus !== "READY") {
    throw new Error(`Shopify file ${file.id} is ${file.fileStatus}. Wait for processing and plan again.`)
  }
  const url = file.url ?? file.image?.url
  if (!url) {
    throw new Error("Ready file has no download URL.")
  }
  return { id: file.id, url, state: file }
}

export function createFileAdapter(
  client: AdminClient,
  directory: string,
  upload: typeof fetch = fetch,
  pause: (milliseconds: number) => Promise<unknown> = setTimeout
): ResourceAdapter {
  return {
    validate: (data) => {
      localFile(data, directory)
    },
    identity: (data) => localFile(data, directory).filename,
    find: async (data) => {
      const local = localFile(data, directory)
      const result = z
        .object({
          resources: z.object({ nodes: z.array(fileResult), pageInfo: z.object({ hasNextPage: z.boolean() }) })
        })
        .parse(await client(filesQuery, { query: `filename:${local.filename}` })).resources
      if (result.nodes.length > 1 || result.pageInfo.hasNextPage) {
        throw new Error(`Multiple files match ${local.filename}.`)
      }
      const found = result.nodes[0]
      if (!found) {
        return undefined
      }
      const resource = readyFile(found)
      if (basename(new URL(resource.url!).pathname) !== local.filename) {
        throw new Error(`File search returned a different filename for ${local.filename}.`)
      }
      return resource
    },
    create: async (data) => {
      const local = localFile(data, directory)
      const staged = z
        .object({
          stagedUploadsCreate: z.object({
            stagedTargets: z.array(
              z.object({
                url: z.url(),
                resourceUrl: z.url(),
                parameters: z.array(z.object({ name: z.string(), value: z.string() }))
              })
            ),
            userErrors: errors
          })
        })
        .parse(
          await client(
            stageFile,
            {
              input: [
                {
                  filename: local.filename,
                  mimeType: local.mimeType,
                  resource: local.contentType,
                  httpMethod: "POST",
                  fileSize: String(local.bytes.length)
                }
              ]
            },
            true
          )
        ).stagedUploadsCreate
      if (staged.userErrors.length) {
        throw new Error(staged.userErrors.map((error) => error.message).join("; "))
      }
      const target = staged.stagedTargets[0]
      if (!target || new URL(target.url).protocol !== "https:") {
        throw new Error("Shopify returned no secure upload target.")
      }
      const form = new FormData()
      for (const parameter of target.parameters) {
        form.append(parameter.name, parameter.value)
      }
      form.append("file", new Blob([new Uint8Array(local.bytes)], { type: local.mimeType }), local.filename)
      const response = await upload(target.url, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) })
      if (!response.ok) {
        throw new Error(`File upload failed with HTTP ${response.status}.`)
      }
      const created = z.object({ fileCreate: z.object({ files: z.array(fileResult), userErrors: errors }) }).parse(
        await client(
          createFile,
          {
            input: [
              {
                originalSource: target.resourceUrl,
                filename: local.filename,
                contentType: local.contentType,
                alt: local.alt,
                duplicateResolutionMode: "RAISE_ERROR"
              }
            ]
          },
          true
        )
      ).fileCreate
      if (created.userErrors.length) {
        throw new Error(created.userErrors.map((error) => error.message).join("; "))
      }
      let file = created.files[0]
      if (!file) {
        throw new Error("Shopify returned no file.")
      }
      for (let attempt = 0; attempt < 12; attempt++) {
        if (file.fileStatus === "READY") {
          return readyFile(file)
        }
        if (file.fileStatus === "FAILED") {
          throw new Error(`Shopify could not process file ${file.id}.`)
        }
        await pause(1000)
        file = z.object({ node: fileResult }).parse(await client(fileStatus, { id: file.id })).node
      }
      throw new Error(`File ${file.id} is still processing. Plan again to resume without uploading a duplicate.`)
    }
  }
}
