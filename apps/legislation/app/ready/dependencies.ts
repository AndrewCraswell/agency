import { getNextLegislationReadiness } from "../../src/server/next/runtime"

export type ReadinessLogger = Readonly<{
  error: (message: string, context?: Readonly<Record<string, unknown>>) => void
  warn: (message: string, context?: Readonly<Record<string, unknown>>) => void
}>

export type ReadinessDependencies = Readonly<{
  isReady: () => boolean | Promise<boolean>
  logger: ReadinessLogger
  readinessDetails: () => Readonly<Record<string, unknown>>
}>

export function getReadinessDependencies(): ReadinessDependencies {
  const readiness = getNextLegislationReadiness()
  return {
    isReady: async () => await readiness.check(),
    logger: consoleLogger,
    readinessDetails: () => readiness.details()
  }
}

const consoleLogger: ReadinessLogger = {
  error: (message, context) => console.error(message, context),
  warn: (message, context) => console.warn(message, context)
}
