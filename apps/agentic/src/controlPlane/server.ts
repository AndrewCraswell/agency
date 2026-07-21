import { createHash } from "node:crypto"
import { createServer, type ServerResponse } from "node:http"
import { z } from "zod"
import type { IntegrationService } from "../integrations/service"
import type { ProviderDeliveryStore } from "../persistence/providerDeliveryStore"
import { summarizeNangoWebhook, type NangoWebhookReceiver } from "../webhooks/nango"
import type { GitHubWebhookService } from "../webhooks/service"
import type { WorkflowSchemaGenerator } from "../workflows/schemaGenerator"
import type { WorkflowService } from "../workflows/service"
import { ApiErrorSchema } from "./contracts"
import type { ControlPlaneService } from "./service"
import { deliveryWorkflowTopology } from "./workflowTopology"

const MAX_REQUEST_BYTES = 65_536
const MAX_WEBHOOK_BYTES = 262_144
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])

function resolveAllowedOrigin(configuredOrigin: string, requestOrigin: string | undefined): string {
  if (requestOrigin === undefined || requestOrigin === configuredOrigin) {
    return configuredOrigin
  }
  const configured = new URL(configuredOrigin)
  const requested = new URL(requestOrigin)
  const equivalentLoopback =
    LOOPBACK_HOSTNAMES.has(configured.hostname) &&
    LOOPBACK_HOSTNAMES.has(requested.hostname) &&
    configured.protocol === requested.protocol &&
    configured.port === requested.port
  return equivalentLoopback ? requestOrigin : configuredOrigin
}

function writeJson(response: ServerResponse, status: number, body: unknown, allowedOrigin: string): void {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "DELETE,GET,PATCH,POST,PUT,OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Content-Type": "application/json; charset=utf-8"
  })
  response.end(JSON.stringify(body))
}

async function readBody(request: AsyncIterable<Buffer>, maximumBytes = MAX_REQUEST_BYTES): Promise<Buffer> {
  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of request) {
    byteLength += chunk.byteLength
    if (byteLength > maximumBytes) {
      throw new Error(`Request body exceeds ${maximumBytes} bytes`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  return JSON.parse((await readBody(request)).toString("utf8"))
}

export function createControlPlaneServer(
  service: ControlPlaneService,
  allowedOrigin: string,
  webhookService?: GitHubWebhookService,
  nangoWebhookReceiver?: NangoWebhookReceiver,
  integrationService?: IntegrationService,
  workflowService?: WorkflowService,
  workflowSchemaGenerator?: WorkflowSchemaGenerator,
  providerDeliveryStore?: ProviderDeliveryStore
) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://control-plane.local")
      const responseOrigin = resolveAllowedOrigin(allowedOrigin, request.headers.origin)
      if (request.method === "OPTIONS") {
        writeJson(response, 204, {}, responseOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        writeJson(response, 200, { status: "ok" }, responseOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/control-plane") {
        writeJson(response, 200, await service.snapshot(), responseOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/control-plane/topology") {
        writeJson(response, 200, deliveryWorkflowTopology, responseOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/control-plane/agents") {
        writeJson(response, 200, service.agents(), responseOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/control-plane/runs") {
        writeJson(response, 200, await service.runSnapshot(), responseOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/control-plane/work-items") {
        writeJson(response, 200, await service.queryWorkItems(Object.fromEntries(url.searchParams)), responseOrigin)
        return
      }
      if (url.pathname === "/api/workflows" && workflowService !== undefined) {
        if (request.method === "GET") {
          writeJson(response, 200, await workflowService.list(), responseOrigin)
          return
        }
        if (request.method === "POST") {
          writeJson(response, 201, await workflowService.create(await readJson(request)), responseOrigin)
          return
        }
      }
      const workflowDeleteRouteMatch = /^\/api\/workflows\/([0-9a-f-]+)$/u.exec(url.pathname)
      if (request.method === "DELETE" && workflowDeleteRouteMatch !== null && workflowService !== undefined) {
        writeJson(response, 200, await workflowService.delete(workflowDeleteRouteMatch[1] ?? ""), responseOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/workflows/schedules" && workflowService !== undefined) {
        writeJson(response, 200, await workflowService.schedules(), responseOrigin)
        return
      }
      const workflowScheduleRouteMatch = /^\/api\/workflows\/schedules\/([0-9a-f-]+)$/u.exec(url.pathname)
      if (request.method === "PATCH" && workflowScheduleRouteMatch !== null && workflowService !== undefined) {
        writeJson(
          response,
          200,
          await workflowService.updateSchedule(workflowScheduleRouteMatch[1] ?? "", await readJson(request)),
          responseOrigin
        )
        return
      }
      if (request.method === "GET" && url.pathname === "/api/workflows/steps" && workflowService !== undefined) {
        writeJson(response, 200, workflowService.definitions(), responseOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/workflows/models" && workflowService !== undefined) {
        writeJson(response, 200, await workflowService.modelDefinitions(), responseOrigin)
        return
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/workflows/generate-schema" &&
        workflowSchemaGenerator !== undefined
      ) {
        writeJson(
          response,
          200,
          { schemaVersion: "1", schema: await workflowSchemaGenerator(await readJson(request)) },
          responseOrigin
        )
        return
      }
      if (
        request.method === "GET" &&
        url.pathname === "/api/workflows/provider-operations" &&
        workflowService !== undefined
      ) {
        writeJson(response, 200, workflowService.providerDefinitions(), responseOrigin)
        return
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/workflows/repository-agents/discover" &&
        workflowService !== undefined
      ) {
        writeJson(
          response,
          200,
          await workflowService.repositoryAgentDefinitions(await readJson(request)),
          responseOrigin
        )
        return
      }
      if (request.method === "GET" && url.pathname === "/api/workflow-runs" && workflowService !== undefined) {
        writeJson(response, 200, await workflowService.runs(), responseOrigin)
        return
      }
      const workflowActivationRouteMatch =
        /^\/api\/workflow-runs\/([0-9a-f-]+)\/activations\/([a-f0-9]+)\/(retry|retry-from-here)$/u.exec(url.pathname)
      if (request.method === "POST" && workflowActivationRouteMatch !== null && workflowService !== undefined) {
        const runId = workflowActivationRouteMatch[1] ?? ""
        const activationId = workflowActivationRouteMatch[2] ?? ""
        const result =
          workflowActivationRouteMatch[3] === "retry-from-here"
            ? await workflowService.retryFromHere(runId, activationId)
            : await workflowService.retryActivation(runId, activationId)
        writeJson(response, 200, result, responseOrigin)
        return
      }
      const workflowEffectRouteMatch = /^\/api\/workflow-runs\/([0-9a-f-]+)\/effects\/([0-9a-f-]+)\/resolve$/u.exec(
        url.pathname
      )
      if (request.method === "POST" && workflowEffectRouteMatch !== null && workflowService !== undefined) {
        writeJson(
          response,
          200,
          await workflowService.resolveEffect(
            workflowEffectRouteMatch[1] ?? "",
            workflowEffectRouteMatch[2] ?? "",
            await readJson(request)
          ),
          responseOrigin
        )
        return
      }
      const workflowRunRouteMatch = /^\/api\/workflow-runs\/([0-9a-f-]+)(?:\/(cancel|resume|run-again))?$/u.exec(
        url.pathname
      )
      if (workflowRunRouteMatch !== null && workflowService !== undefined) {
        const runId = workflowRunRouteMatch[1] ?? ""
        if (request.method === "GET" && workflowRunRouteMatch[2] === undefined) {
          writeJson(response, 200, await workflowService.runDetail(runId), responseOrigin)
          return
        }
        if (request.method === "POST" && workflowRunRouteMatch[2] === "cancel") {
          writeJson(response, 200, await workflowService.cancelRun(runId, await readJson(request)), responseOrigin)
          return
        }
        if (request.method === "POST" && workflowRunRouteMatch[2] === "run-again") {
          writeJson(response, 201, await workflowService.runAgain(runId, await readJson(request)), responseOrigin)
          return
        }
      }
      const workflowRouteMatch = /^\/api\/workflows\/([0-9a-f-]+)\/(draft|validate|publish|runs|test)$/u.exec(
        url.pathname
      )
      if (workflowRouteMatch !== null && workflowService !== undefined) {
        const workflowId = workflowRouteMatch[1] ?? ""
        const action = workflowRouteMatch[2]
        if (request.method === "GET" && action === "draft") {
          writeJson(response, 200, await workflowService.draft(workflowId), responseOrigin)
          return
        }
        if (request.method === "PATCH" && action === "draft") {
          writeJson(
            response,
            200,
            await workflowService.updateDraft(workflowId, await readJson(request)),
            responseOrigin
          )
          return
        }
        if (request.method === "POST" && action === "validate") {
          writeJson(response, 200, await workflowService.validate(workflowId), responseOrigin)
          return
        }
        if (request.method === "POST" && action === "publish") {
          writeJson(response, 200, await workflowService.publish(workflowId), responseOrigin)
          return
        }
        if (request.method === "POST" && action === "test") {
          writeJson(response, 200, await workflowService.test(workflowId, await readJson(request)), responseOrigin)
          return
        }
        if (request.method === "POST" && action === "runs") {
          writeJson(response, 201, await workflowService.start(workflowId, await readJson(request)), responseOrigin)
          return
        }
      }
      if (request.method === "GET" && url.pathname === "/api/integrations" && integrationService !== undefined) {
        writeJson(response, 200, await integrationService.settings(), responseOrigin)
        return
      }
      if (
        request.method === "GET" &&
        url.pathname === "/api/integrations/resources" &&
        integrationService !== undefined
      ) {
        const capability = url.searchParams.get("capability")
        writeJson(
          response,
          200,
          await integrationService.inventory(capability === null ? {} : { capability }),
          responseOrigin
        )
        return
      }
      if (
        request.method === "GET" &&
        url.pathname === "/api/integrations/provider-events" &&
        integrationService !== undefined
      ) {
        writeJson(response, 200, integrationService.eventDefinitions(), responseOrigin)
        return
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/integrations/authorize" &&
        integrationService !== undefined
      ) {
        writeJson(response, 201, await integrationService.startAuthorization(await readJson(request)), responseOrigin)
        return
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/integrations/complete" &&
        integrationService !== undefined
      ) {
        writeJson(
          response,
          201,
          await integrationService.completeAuthorization(await readJson(request)),
          responseOrigin
        )
        return
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/integrations/reconnect" &&
        integrationService !== undefined
      ) {
        writeJson(response, 201, await integrationService.startReconnect(await readJson(request)), responseOrigin)
        return
      }
      if (
        request.method === "POST" &&
        url.pathname === "/api/integrations/reconcile" &&
        integrationService !== undefined
      ) {
        writeJson(response, 200, await integrationService.reconcile(), responseOrigin)
        return
      }
      const integrationImpactMatch = /^\/api\/integrations\/connections\/([0-9a-f-]+)\/impact$/u.exec(url.pathname)
      if (request.method === "GET" && integrationImpactMatch !== null && integrationService !== undefined) {
        writeJson(
          response,
          200,
          await integrationService.disconnectImpact(integrationImpactMatch[1] ?? ""),
          responseOrigin
        )
        return
      }
      const integrationConnectionMatch = /^\/api\/integrations\/connections\/([0-9a-f-]+)$/u.exec(url.pathname)
      if (integrationConnectionMatch !== null && integrationService !== undefined) {
        const connectionId = integrationConnectionMatch[1] ?? ""
        if (request.method === "POST") {
          writeJson(response, 200, await integrationService.refresh(connectionId), responseOrigin)
          return
        }
        if (request.method === "DELETE") {
          writeJson(response, 200, await integrationService.disconnect(connectionId), responseOrigin)
          return
        }
      }
      if (request.method === "POST" && url.pathname === "/api/control-plane/assign") {
        writeJson(response, 201, await service.assign(await readJson(request)), responseOrigin)
        return
      }
      if (request.method === "POST" && url.pathname === "/api/webhooks/github" && webhookService !== undefined) {
        if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") {
          writeJson(response, 415, ApiErrorSchema.parse({ error: "Expected application/json" }), responseOrigin)
          return
        }
        const result = await webhookService.receive({
          deliveryId: request.headers["x-github-delivery"] as string | undefined,
          eventName: request.headers["x-github-event"] as string | undefined,
          signature: request.headers["x-hub-signature-256"] as string | undefined,
          rawBody: await readBody(request, MAX_WEBHOOK_BYTES)
        })
        writeJson(response, 202, { accepted: true, duplicate: !result.created }, responseOrigin)
        return
      }
      if (request.method === "POST" && url.pathname === "/api/webhooks/nango" && nangoWebhookReceiver !== undefined) {
        if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") {
          writeJson(response, 415, ApiErrorSchema.parse({ error: "Expected application/json" }), responseOrigin)
          return
        }
        const rawBody = await readBody(request, MAX_WEBHOOK_BYTES)
        const body = rawBody.toString("utf8")
        const isValidSignature = nangoWebhookReceiver.verifyIncomingWebhookRequest(body, request.headers)
        if (!isValidSignature) {
          writeJson(response, 401, ApiErrorSchema.parse({ error: "Invalid Nango webhook signature" }), responseOrigin)
          return
        }
        const receipt = summarizeNangoWebhook(body)
        const deliveryKey = createHash("sha256").update(rawBody).digest("hex")
        if (providerDeliveryStore === undefined) throw new Error("Provider delivery persistence is unavailable")
        const persisted = await providerDeliveryStore.insert(receipt, deliveryKey, deliveryKey)
        try {
          nangoWebhookReceiver.onAcceptedWebhook(receipt)
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown receipt logging failure"
          process.stderr.write(`[nango-webhook] receipt logging failed: ${message}\n`)
        }
        writeJson(response, 202, { accepted: true, duplicate: !persisted.created }, responseOrigin)
        return
      }
      writeJson(response, 404, ApiErrorSchema.parse({ error: "Route not found" }), responseOrigin)
    } catch (error) {
      const status = error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 409
      const message = error instanceof Error ? error.message : "Control-plane request failed"
      const fieldErrors =
        error instanceof z.ZodError
          ? error.issues.flatMap((issue) => {
              const field = issue.path[0]
              return typeof field === "string" ? [{ field, message: issue.message }] : []
            })
          : undefined
      writeJson(
        response,
        status,
        ApiErrorSchema.parse({ error: message, ...(fieldErrors === undefined ? {} : { fieldErrors }) }),
        resolveAllowedOrigin(allowedOrigin, request.headers.origin)
      )
    }
  })
}
