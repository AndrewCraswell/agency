import { init, winterCGFetchIntegration } from "@sentry/nextjs"
import { assertEdgeTelemetryRuntime, createEdgeSentryOptions } from "./edgeSentryOptions"

assertEdgeTelemetryRuntime()
init(createEdgeSentryOptions(process.env, winterCGFetchIntegration))
