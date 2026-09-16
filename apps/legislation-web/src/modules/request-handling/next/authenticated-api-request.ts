import { AuthenticationError, createWorkosAuthenticator } from "@repo/legislation-core/auth/workos"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { LegislationConfig } from "../../configuration/config.js"
import { getNextLegislationApplication } from "../../legislation/runtime/runtime.js"
import type { HttpApiHandler } from "../api/http.js"
import { apiErrorResponse } from "../api/next/http.js"
import { executeNextHttpApiHandler } from "../api/next/node-handler.js"

type WorkosConfig = Extract<LegislationConfig["auth"], { mode: "workos" }>
type Authenticator = ReturnType<typeof createWorkosAuthenticator>
type AuthenticationApplication = Readonly<{
  config: Readonly<{ auth: LegislationConfig["auth"] }>
}>

export type AuthenticatedApiRequestDependencies = Readonly<{
  createAuthenticator?: (config: WorkosConfig) => Authenticator
  execute?: typeof executeNextHttpApiHandler
  getApplication?: () => AuthenticationApplication
}>

const authenticators = new WeakMap<object, Authenticator>()

/**
 * Authenticates one documented API operation before adapting it to the
 * framework-independent Node handler. Health, readiness, and unknown-method
 * fallbacks do not use this boundary and remain public.
 */
export async function executeAuthenticatedApiRequest(
  request: Request,
  handler: HttpApiHandler,
  dependencies: AuthenticatedApiRequestDependencies = {}
): Promise<Response> {
  const application = (dependencies.getApplication ?? getNextLegislationApplication)()
  const execute = dependencies.execute ?? executeNextHttpApiHandler
  if (application.config.auth.mode === "disabled") {
    return await execute(request, handler)
  }

  try {
    const identity = await authenticatorFor(
      application,
      application.config.auth,
      dependencies.createAuthenticator
    )(request.headers.get("authorization") ?? undefined)
    const requestIdentity = { organizationId: identity.organizationId, userId: identity.userId }
    return await execute(request, handler, { requestContext: { identity: requestIdentity } })
  } catch (error) {
    if (!(error instanceof AuthenticationError)) {
      throw error
    }
    return authenticationFailure(request)
  }
}

function authenticatorFor(
  application: AuthenticationApplication,
  config: WorkosConfig,
  factory: ((config: WorkosConfig) => Authenticator) | undefined
): Authenticator {
  const cached = authenticators.get(application)
  if (cached !== undefined) {
    return cached
  }
  const authenticator = (factory ?? createApiAuthenticator)(config)
  authenticators.set(application, authenticator)
  return authenticator
}

function createApiAuthenticator(config: WorkosConfig): Authenticator {
  return createWorkosAuthenticator({
    m2m: { audience: config.apiAudience, issuer: config.issuer, jwksUrl: config.jwksUrl },
    userSession: config.userSession
  })
}

function authenticationFailure(request: Request): Response {
  const headers = new Headers({
    "cache-control": "private, no-store",
    "www-authenticate": 'Bearer realm="legislation", error="invalid_token"'
  })
  return apiErrorResponse(request, new LegislationError("unauthorized", "Bearer token is absent or invalid"), {
    headers
  })
}
