import type { SmokeFixture } from "./smoke-harness.js"

export type SmokeRunnerEnvironment = Readonly<Record<string, string | undefined>>

function fixture(environment: SmokeRunnerEnvironment, name: keyof SmokeFixture): string | undefined {
  const environmentName = `LEGISLATION_SMOKE_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`
  return environment[environmentName]?.trim() || undefined
}

export function parseSmokeFixtures(environment: SmokeRunnerEnvironment): SmokeFixture {
  return {
    amendmentId: fixture(environment, "amendmentId"),
    billId: fixture(environment, "billId"),
    billSearchQuery: fixture(environment, "billSearchQuery"),
    changeId: fixture(environment, "changeId"),
    documentId: fixture(environment, "documentId"),
    documentIdB: fixture(environment, "documentIdB"),
    documentSectionId: fixture(environment, "documentSectionId"),
    jurisdictionId: fixture(environment, "jurisdictionId"),
    materialId: fixture(environment, "materialId"),
    materialSectionId: fixture(environment, "materialSectionId"),
    materialSearchQuery: fixture(environment, "materialSearchQuery"),
    meetingId: fixture(environment, "meetingId"),
    organizationId: fixture(environment, "organizationId"),
    personId: fixture(environment, "personId"),
    sessionId: fixture(environment, "sessionId"),
    subscriptionId: fixture(environment, "subscriptionId"),
    voteId: fixture(environment, "voteId"),
    webhookId: fixture(environment, "webhookId")
  }
}

export function parseSmokeToken(environment: SmokeRunnerEnvironment): string | undefined {
  return environment.LEGISLATION_SMOKE_TOKEN?.trim() || undefined
}
