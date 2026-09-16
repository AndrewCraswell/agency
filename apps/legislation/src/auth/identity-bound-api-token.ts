import { LegislationError } from "../legislation/errors.js"
import { getRequestContext } from "./request-context.js"
import type { WorkosIdentity } from "./workos.js"

/** A shared service credential cannot borrow an MCP caller's organization or user authority. */
export function createIdentityBoundApiAccessTokenProvider(dependencies: {
  getToken: () => Promise<string>
  authenticateApiToken: (authorization: string) => Promise<WorkosIdentity>
}) {
  return async () => {
    const caller = getRequestContext()?.identity
    if (!caller?.organizationId || !caller.userId) {
      throw new LegislationError("forbidden", "Access denied")
    }
    let token: string
    try {
      token = await dependencies.getToken()
    } catch (error) {
      throw new LegislationError("dependency_unavailable", "API credentials are unavailable", { cause: error })
    }
    let principal: WorkosIdentity
    try {
      principal = await dependencies.authenticateApiToken(`Bearer ${token}`)
    } catch (error) {
      throw new LegislationError("dependency_unavailable", "API credentials could not be verified", { cause: error })
    }
    if (principal.organizationId !== caller.organizationId || principal.userId !== caller.userId) {
      throw new LegislationError("forbidden", "Access denied")
    }
    return token
  }
}
