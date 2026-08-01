import { setupServer } from "msw/node"
import { createApiMock } from "./createApiMock"
import { handlers } from "./handlers"

/** MSW node server seeded with the default handlers. */
export const server = setupServer(...handlers)

/** Ergonomic per-test endpoint mocking bound to the MSW server. */
export const ApiMock = createApiMock(server)
