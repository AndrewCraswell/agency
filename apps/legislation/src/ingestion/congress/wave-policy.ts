import type { LegislationConfig } from "../../config/config.js"

/**
 * Every Congress child can hold an operation connection while its ingestion-job
 * heartbeat renews a lease, so give it an independent heartbeat connection.
 */
export const CONGRESS_WAVE_CHILD_DATABASE_CONNECTIONS = 2

export function congressWaveChildDatabaseConfig(config: LegislationConfig): LegislationConfig["database"] {
  return {
    ...config.database,
    maxConnections: CONGRESS_WAVE_CHILD_DATABASE_CONNECTIONS
  }
}
