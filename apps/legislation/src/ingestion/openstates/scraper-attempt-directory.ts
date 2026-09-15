import { lstat, readFile } from "node:fs/promises"
import { resolve } from "node:path"

/** Read only portable, regular attempt files. Never follow paths supplied by the scraper manifest. */
export function scraperAttemptDirectory(directory: string) {
  const root = resolve(directory)
  return {
    async read(path: string) {
      if (path !== "attempt.json" && !/^_data\/(nc|ak)\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.json$/.test(path)) {
        throw new Error("Invalid attempt artifact path")
      }
      let current = root
      for (const part of ["", ...path.split("/")]) {
        current = resolve(current, part)
        if ((await lstat(current)).isSymbolicLink()) {
          throw new Error("Linked attempt artifact")
        }
      }
      const info = await lstat(current)
      if (!info.isFile() || info.size > 64 * 1024 * 1024) {
        throw new Error("Invalid attempt artifact size or type")
      }
      return new Uint8Array(await readFile(current))
    }
  }
}
