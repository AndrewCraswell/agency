import { createNextLegislationApplication, type NextLegislationApplication } from "./composition.js"
import type { NextDatabaseReadiness } from "./readiness.js"

declare global {
  var __legislationNextRuntime: NextLegislationRuntime<NextLegislationApplication> | undefined
}

export interface NextLegislationRuntimeApplication {
  readonly readiness: NextDatabaseReadiness
  close(): Promise<void>
}

export interface NextLegislationReadiness {
  check(): Promise<boolean>
  details(): Readonly<Record<string, unknown>>
}

export interface NextLegislationRuntime<Application extends NextLegislationRuntimeApplication> {
  close(): Promise<void>
  getApplication(): Application
  getReadiness(): NextLegislationReadiness
}

export function createNextLegislationRuntime<Application extends NextLegislationRuntimeApplication>(
  createApplication: () => Application
): NextLegislationRuntime<Application> {
  let application: Application | undefined

  function getApplication(): Application {
    application ??= createApplication()
    return application
  }

  return {
    close: async () => {
      const current = application
      application = undefined
      await current?.close()
    },
    getApplication,
    getReadiness: () => ({
      check: async () => {
        try {
          return await getApplication().readiness.check()
        } catch {
          return false
        }
      },
      details: () => {
        try {
          return getApplication().readiness.details()
        } catch {
          return {}
        }
      }
    })
  }
}

/**
 * Returns the one application composition for this Node.js process. The
 * global cache prevents development reloads from creating extra pg.Pool instances.
 */
export function getNextLegislationApplication(): NextLegislationApplication {
  return getNextLegislationRuntime().getApplication()
}

/**
 * A readiness facade that converts composition and database errors to an
 * unavailable result. A health route can therefore return HTTP 503 safely.
 */
export function getNextLegislationReadiness(): NextLegislationReadiness {
  return getNextLegislationRuntime().getReadiness()
}

/**
 * Releases the process-wide pool during host shutdown or test cleanup. It
 * must not be called from an individual route request.
 */
export async function closeNextLegislationApplication(): Promise<void> {
  const runtime = globalThis.__legislationNextRuntime
  globalThis.__legislationNextRuntime = undefined
  await runtime?.close()
}

function getNextLegislationRuntime(): NextLegislationRuntime<NextLegislationApplication> {
  globalThis.__legislationNextRuntime ??= createNextLegislationRuntime(createNextLegislationApplication)
  return globalThis.__legislationNextRuntime
}
