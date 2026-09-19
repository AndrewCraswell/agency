import { createHash } from "node:crypto"
import { LangfuseSpanProcessor } from "@langfuse/otel"
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk"
import { context, propagation, trace, TraceFlags } from "@opentelemetry/api"
import {
  BasicTracerProvider,
  SamplingDecision,
  type ReadableSpan,
  type Sampler,
  type Span,
  type SpanProcessor
} from "@opentelemetry/sdk-trace-base"
// oxlint-disable-next-line import/default -- The SDK's node condition is CommonJS; native ESM needs its default namespace.
import Sentry, { type NodeOptions } from "@sentry/nextjs"
import {
  SentryAsyncLocalStorageContextManager,
  SentryPropagator,
  SentrySampler,
  SentrySpanProcessor
} from "@sentry/opentelemetry"
import { registerTelemetry } from "ai"
import { PHASE_PRODUCTION_BUILD } from "next/constants"
import { langfuseSettings } from "../langfuse/client"
import { sentryOptions } from "./sentryOptions"
import { telemetryPropagationTarget } from "./telemetryPropagation"

type LangfuseOptions = ConstructorParameters<typeof LangfuseSpanProcessor>[0]
type RuntimeOptions = Readonly<{
  sentry?: NodeOptions
  langfuse?: LangfuseOptions
  lifecycleTimeoutMs?: number
}>
type RuntimeHandle = Readonly<{
  flush: () => Promise<void>
  shutdown: () => Promise<void>
}>
type Owner = { key: string; handle: RuntimeHandle; isClosing: boolean }

declare global {
  var __rostraNodeTelemetryOwner: Owner | undefined
}

function snapshotForLangfuse(span: ReadableSpan): ReadableSpan {
  return {
    name: span.name,
    kind: span.kind,
    spanContext: () => ({ ...span.spanContext(), traceFlags: TraceFlags.SAMPLED, traceState: undefined }),
    parentSpanContext: span.parentSpanContext ? { ...span.parentSpanContext } : undefined,
    startTime: [...span.startTime],
    endTime: [...span.endTime],
    status: { ...span.status },
    attributes: structuredClone(span.attributes),
    links: span.links.map((link) => ({ ...link, attributes: structuredClone(link.attributes) })),
    events: span.events.map((event) => ({ ...event, attributes: structuredClone(event.attributes) })),
    duration: [...span.duration],
    ended: span.ended,
    resource: span.resource,
    instrumentationScope: { ...span.instrumentationScope },
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount
  }
}

async function boundedLifecycle(operation: () => Promise<unknown>, timeout: number, name: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Node telemetry ${name} timed out`)), timeout)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export function startNodeTelemetry(options: RuntimeOptions): RuntimeHandle {
  if (globalThis.__rostraNodeTelemetryOwner) {
    throw new Error("Node telemetry already has an owner; use runtime registration")
  }
  const timeout = options.lifecycleTimeoutMs ?? 5000
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 30000) {
    throw new Error("Node telemetry lifecycle timeout must be between 1 and 30000 milliseconds")
  }
  const contextManager = new SentryAsyncLocalStorageContextManager().enable()
  let hasContext = false
  let hasPropagator = false
  let hasProvider = false
  let provider: BasicTracerProvider | undefined
  let closeClient: (() => Promise<boolean>) | undefined
  function releaseRegistration() {
    if (hasProvider) {
      trace.disable()
    }
    if (hasPropagator) {
      propagation.disable()
    }
    if (hasContext) {
      context.disable()
    }
    hasProvider = false
    hasPropagator = false
    hasContext = false
  }

  try {
    hasContext = context.setGlobalContextManager(contextManager)
    if (!hasContext) {
      throw new Error("A conflicting OpenTelemetry context manager is already registered")
    }
    hasPropagator = propagation.setGlobalPropagator(new SentryPropagator())
    if (!hasPropagator) {
      throw new Error("A conflicting OpenTelemetry propagator is already registered")
    }
    const client = Sentry.init({
      ...sentryOptions,
      enabled: Boolean(options.sentry?.dsn),
      registerEsmLoaderHooks: true,
      ...options.sentry,
      skipOpenTelemetrySetup: true,
      traceLifecycle: "static",
      streamGenAiSpans: false
    })
    if (!client) {
      throw new Error("Sentry did not create the Node telemetry client")
    }
    closeClient = async () => client.close(timeout)
    const sentrySampler = new SentrySampler(client)
    const sentryProcessor = new SentrySpanProcessor({ client })
    const langfuse = options.langfuse ? new LangfuseSpanProcessor(options.langfuse) : undefined
    const sampler: Sampler = {
      shouldSample(...args) {
        const decision = sentrySampler.shouldSample(...args)
        return langfuse && decision.decision === SamplingDecision.NOT_RECORD
          ? { ...decision, decision: SamplingDecision.RECORD }
          : decision
      },
      toString: () => "RostraSinkSampler"
    }
    const processor: SpanProcessor = {
      onStart(span, parent) {
        sentryProcessor.onStart(span, parent)
        langfuse?.onStart(span, parent)
      },
      onEnd(span: ReadableSpan & Span) {
        if (client.getOptions().enabled !== false && span.spanContext().traceFlags === TraceFlags.SAMPLED) {
          sentryProcessor.onEnd(span)
        }
        langfuse?.onEnd(snapshotForLangfuse(span))
      },
      async forceFlush() {
        await Promise.all([sentryProcessor.forceFlush(), langfuse?.forceFlush()])
        if (!(await client.flush(timeout))) {
          throw new Error("Sentry telemetry did not flush")
        }
      },
      async shutdown() {
        await Promise.all([sentryProcessor.shutdown(), langfuse?.shutdown()])
      }
    }
    provider = new BasicTracerProvider({ sampler, spanProcessors: [processor] })
    hasProvider = trace.setGlobalTracerProvider(provider)
    if (!hasProvider) {
      throw new Error("A conflicting OpenTelemetry tracer provider is already registered")
    }
    Sentry.validateOpenTelemetrySetup()
    if (langfuse) {
      registerTelemetry(new LangfuseVercelAiSdkIntegration())
    }
    const ownedProvider = provider
    let shutdown: Promise<void> | undefined
    const handle: RuntimeHandle = {
      flush: () =>
        shutdown
          ? Promise.reject(new Error("Node telemetry is shutting down"))
          : boundedLifecycle(() => processor.forceFlush(), timeout, "flush"),
      shutdown() {
        if (!shutdown) {
          const owner = globalThis.__rostraNodeTelemetryOwner
          if (owner?.handle === handle) {
            owner.isClosing = true
          }
          const stopping = (async () => {
            try {
              await processor.forceFlush()
            } finally {
              await Promise.all([ownedProvider.shutdown(), client.close(timeout)])
            }
          })().finally(() => {
            releaseRegistration()
            if (globalThis.__rostraNodeTelemetryOwner?.handle === handle) {
              globalThis.__rostraNodeTelemetryOwner = undefined
            }
          })
          shutdown = boundedLifecycle(() => stopping, timeout, "shutdown")
        }
        return shutdown
      }
    }
    globalThis.__rostraNodeTelemetryOwner = { key: "", handle, isClosing: false }
    return handle
  } catch (error) {
    releaseRegistration()
    void provider?.shutdown().catch(() => console.warn("Node telemetry provider cleanup failed"))
    void closeClient?.().catch(() => console.warn("Node telemetry client cleanup failed"))
    throw error
  }
}

export function registerNodeTelemetry(
  environment: Readonly<Record<string, string | undefined>>,
  mask: NonNullable<LangfuseOptions>["mask"]
) {
  if (environment.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    return undefined
  }
  const publicKey = environment.LANGFUSE_PUBLIC_KEY?.trim()
  const secretKey = environment.LANGFUSE_SECRET_KEY?.trim()
  if (Boolean(publicKey) !== Boolean(secretKey)) {
    throw new Error("Langfuse telemetry requires both public and secret keys")
  }
  const langfuseConfiguration = publicKey && secretKey ? langfuseSettings(environment) : undefined
  const configuration = {
    dsn: environment.NEXT_PUBLIC_SENTRY_DSN?.trim(),
    environment: environment.NODE_ENV,
    release: environment.SENTRY_RELEASE,
    publicKey,
    secretKey,
    baseUrl: langfuseConfiguration?.baseUrl,
    apiBaseUrl: environment.LEGISLATION_PUBLIC_API_BASE_URL
  }
  const key = createHash("sha256")
    .update(JSON.stringify({ ...configuration, mask: mask?.toString() }))
    .digest("hex")
  const owner = globalThis.__rostraNodeTelemetryOwner
  if (owner) {
    if (owner.isClosing) {
      throw new Error("Node telemetry is shutting down; restart the runtime")
    }
    if (owner.key !== key) {
      throw new Error("Node telemetry configuration changed; restart the runtime")
    }
    return owner.handle
  }
  const target = configuration.dsn
    ? telemetryPropagationTarget(configuration.apiBaseUrl, environment.NODE_ENV)
    : undefined
  const handle = startNodeTelemetry({
    sentry: {
      dsn: configuration.dsn,
      enabled: Boolean(configuration.dsn),
      environment: configuration.environment,
      release: configuration.release,
      tracesSampler: () => 0,
      tracePropagationTargets: target ? [target] : [],
      integrations: [
        ...sentryOptions.integrations,
        Sentry.httpIntegration({
          spans: false,
          breadcrumbs: false,
          trackIncomingRequestsAsSessions: false,
          ignoreIncomingRequestBody: () => true,
          maxIncomingRequestBodySize: "none"
        }),
        Sentry.nativeNodeFetchIntegration({ breadcrumbs: false })
      ]
    },
    langfuse:
      publicKey && secretKey
        ? {
            publicKey,
            secretKey,
            baseUrl: configuration.baseUrl,
            environment: configuration.environment,
            mediaUploadEnabled: false,
            mask
          }
        : undefined
  })
  globalThis.__rostraNodeTelemetryOwner = { key, handle, isClosing: false }
  return handle
}

export async function flushNodeTelemetry() {
  await globalThis.__rostraNodeTelemetryOwner?.handle.flush()
}
