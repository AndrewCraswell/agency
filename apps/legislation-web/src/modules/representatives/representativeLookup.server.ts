import { createDatabase } from "@repo/legislation-core/database/database"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createGeocodioClient } from "../../services/geocodio/geocodio"
import { loadConfig } from "../configuration/config"
import { createRepresentativeDirectoryReader } from "./representativeDirectory"
import { createRepresentativeLookup } from "./representativeLookup"

type Lookup = ReturnType<typeof createRepresentativeLookup>
declare global {
  var __rostraRepresentativeLookup: Lookup | undefined
}

export function getRepresentativeLookup(): Lookup {
  if (process.env.NODE_ENV !== "development") {
    throw new LegislationError("not_found", "Not found")
  }
  if (globalThis.__rostraRepresentativeLookup) {
    return globalThis.__rostraRepresentativeLookup
  }
  const config = loadConfig()
  if (!config.geocodio.apiKey) {
    throw new LegislationError("dependency_unavailable", "Configure GEOCODIO_API_KEY to enable representative lookup.")
  }
  // Like snapshot persistence, this bounded reader uses transaction-local deadlines
  // so it also works with transaction poolers that reject startup session settings.
  const { pool } = createDatabase({ ...config.database, maxConnections: 1 })
  const lookup = createRepresentativeLookup(
    createGeocodioClient({ apiKey: config.geocodio.apiKey, baseUrl: config.geocodio.baseUrl }),
    createRepresentativeDirectoryReader(pool)
  )
  globalThis.__rostraRepresentativeLookup = lookup
  return lookup
}
