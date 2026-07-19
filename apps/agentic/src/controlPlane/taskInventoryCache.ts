import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { z } from "zod"
import { LinearTaskGraphNodeSchema } from "../contracts/linear"

const CachedTaskInventorySchema = z
  .object({
    schemaVersion: z.literal("1"),
    savedAt: z.iso.datetime({ offset: true }),
    tasks: z.array(LinearTaskGraphNodeSchema)
  })
  .strict()

export type TaskInventory = z.infer<typeof CachedTaskInventorySchema>["tasks"]

export interface TaskInventoryCache {
  load(): Promise<TaskInventory | null>
  save(tasks: TaskInventory): Promise<void>
}

export class FileTaskInventoryCache implements TaskInventoryCache {
  readonly #path: string

  constructor(path: string) {
    this.#path = z.string().trim().min(1).parse(path)
  }

  async load(): Promise<TaskInventory | null> {
    try {
      const cached = CachedTaskInventorySchema.parse(JSON.parse(await readFile(this.#path, "utf8")))
      return cached.tasks
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null
      }
      throw error
    }
  }

  async save(tasks: TaskInventory): Promise<void> {
    const cached = CachedTaskInventorySchema.parse({
      schemaVersion: "1",
      savedAt: new Date().toISOString(),
      tasks
    })
    await mkdir(dirname(this.#path), { recursive: true })
    const temporaryPath = `${this.#path}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(cached, null, 2)}\n`, "utf8")
    await rename(temporaryPath, this.#path)
  }
}
