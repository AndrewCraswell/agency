import { createLogger } from "@repo/legislation-core/observability/logger"
import { createLegislationResearchTools } from "@repo/legislation-core/research/tools"
import { z } from "zod"
import { getResearchRuntime } from "../search/research-runtime"
import type { ResultPersistence } from "./resultStore"
import { researchSnapshotPersistence } from "./snapshotPersistence.server"

export const resultPersistence: ResultPersistence = {
  save: researchSnapshotPersistence.save,
  read: researchSnapshotPersistence.read,
  async load(tool, input, signal) {
    return await getResearchRuntime().run(async (service) => {
      const definition = createLegislationResearchTools(
        service,
        createLogger({ service: "result-recovery", level: "warn" })
      ).find((item) => item.name === tool)
      if (!definition) {
        throw new Error("Stored result tool is unavailable")
      }
      const result = await definition.execute(input)
      return z.object({ structuredContent: z.object({ data: z.unknown() }) }).parse(result).structuredContent.data
    }, signal)
  }
}
