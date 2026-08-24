import { AsyncLocalStorage } from "node:async_hooks"

export type RequestIdentity = Readonly<{
  organizationId?: string
  userId: string
}>

export type RequestContext = Readonly<{
  bearerToken?: string
  correlationId: string
  identity?: RequestIdentity
}>

const requestContext = new AsyncLocalStorage<RequestContext>()

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore()
}

export function runWithRequestContext<T>(context: RequestContext, operation: () => T): T {
  return requestContext.run(context, operation)
}
