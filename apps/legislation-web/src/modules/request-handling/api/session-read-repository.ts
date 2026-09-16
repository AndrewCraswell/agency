import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { jurisdictions } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { eq } from "drizzle-orm"
import {
  getSession,
  listJurisdictionSessions,
  type JurisdictionSessionListInput,
  type SessionPage,
  type SessionRead
} from "../../legislation/persistence/queries/session-read.js"

export type SessionListInput = JurisdictionSessionListInput
export type SessionListPage = SessionPage

export interface SessionReadRepository {
  assertJurisdictionExists(jurisdictionId: string): Promise<void>
  getSession(sessionId: string): Promise<SessionRead>
  listJurisdictionSessions(input: SessionListInput): Promise<SessionListPage>
}

type SessionReadStore = {
  getSession(sessionId: string): Promise<SessionRead | undefined>
  jurisdictionExists(jurisdictionId: string): Promise<boolean>
  listJurisdictionSessions(input: SessionListInput): Promise<SessionListPage>
}

export class SessionRepository implements SessionReadRepository {
  readonly #store: SessionReadStore

  constructor(store: SessionReadStore) {
    this.#store = store
  }

  async assertJurisdictionExists(jurisdictionId: string): Promise<void> {
    const id = requiredInputText(jurisdictionId, "jurisdictionId")
    if (!(await this.#store.jurisdictionExists(id))) {
      throw new LegislationError("not_found", `Jurisdiction ${id} was not found`)
    }
  }

  async getSession(sessionId: string): Promise<SessionRead> {
    const id = requiredInputText(sessionId, "sessionId")
    const session = await this.#store.getSession(id)
    if (session === undefined) {
      throw new LegislationError("not_found", `Session ${id} was not found`)
    }
    return session
  }

  async listJurisdictionSessions(input: SessionListInput): Promise<SessionListPage> {
    return await this.#store.listJurisdictionSessions({
      ...input,
      jurisdictionId: requiredInputText(input.jurisdictionId, "jurisdictionId")
    })
  }
}

export function createSessionRepository(database: LegislationDatabase): SessionReadRepository {
  return new SessionRepository({
    getSession: async (sessionId) => await getSession(database, sessionId),
    jurisdictionExists: async (jurisdictionId) => {
      const rows = await database
        .select({ id: jurisdictions.id })
        .from(jurisdictions)
        .where(eq(jurisdictions.id, jurisdictionId))
        .limit(1)
      return rows[0] !== undefined
    },
    listJurisdictionSessions: async (input) => await listJurisdictionSessions(database, input)
  })
}

function requiredInputText(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}
