import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { createServer, type ServerResponse } from "node:http"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import invariant from "tiny-invariant"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { responseOutcomeSchema } from "../../src/modules/conversations/responseOutcome"
import { snapshotSchema } from "./scenario-policy"

const appDirectory = fileURLToPath(new URL("../../", import.meta.url))
const cli = fileURLToPath(new URL("./run-scenarios.ts", import.meta.url))
const serverRequestId = "11111111-1111-4111-8111-111111111111"
const runId = "22222222-2222-4222-8222-222222222222"
const traceId = "33333333333333333333333333333333"
const secret = "sk-or-v1-fixtureprivate"
const sampleFollowUp = "Compare only the 2-3 proposals you identified, keeping the same sample."
const selectedAnswer =
  "Selected sample: Federal candidate 0, California web-only proposal, and New York web-only proposal."
const discoveredCandidates = Array.from({ length: 8 }, (_, index) => ({
  id: `bill:federal-candidate-${index}`,
  kind: "bill",
  title: index === 0 ? "Federal candidate 0" : `Unrelated federal candidate ${index}`
}))
type Mode =
  | "late-completion"
  | "cancelled-stream"
  | "blocked-stop"
  | "missing-download"
  | "invalid-download"
  | "no-metadata"
  | "http-error"
  | "prior-answer"
  | "completed"
  | "selected-sample"
  | "reordered-sample"

const requestSchema = z.object({
  id: z.string(),
  serverRequestId: z.string().nullable(),
  kind: z.string(),
  status: z.number().nullable(),
  terminal: z.string().nullable(),
  failure: z.string().nullable()
})
const receiptSchema = z.object({
  exchange: z.number(),
  failure: z.object({ kind: z.string(), message: z.string() }).nullable(),
  stop: z.object({ status: z.string(), error: z.string().nullable() }),
  capture: z.object({ status: z.string(), file: z.string().nullable(), error: z.string().nullable() }),
  conversationId: z.string().nullable(),
  requests: z.array(requestSchema),
  outcome: responseOutcomeSchema.extend({ messageId: z.string() }).nullable(),
  messages: snapshotSchema.shape.messages.nullable(),
  messageIds: z.array(z.string()).nullable(),
  calls: snapshotSchema.shape.toolCalls.nullable(),
  delivery: z.string(),
  answered: z.boolean(),
  hasAnswer: z.boolean().nullable(),
  failedToolCalls: z.array(z.string()).nullable(),
  pendingToolCalls: z.array(z.string()).nullable()
})
const reportSchema = z.object({
  state: z.string(),
  reason: z.string(),
  exchanges: z.array(receiptSchema),
  requests: z.array(requestSchema),
  events: z.array(z.object({ event: z.string(), exchange: z.number(), data: z.record(z.string(), z.unknown()) })),
  progress: z.array(
    z.object({
      id: z.string(),
      records: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string() }))
    })
  ),
  coverage: z.object({
    executed: z.array(z.object({ stepId: z.string(), requestIds: z.array(z.string()) })),
    answered: z.array(z.object({ stepId: z.string() }))
  })
})

function snapshot(mode: Mode, isComplete = false, messageNumber = 1) {
  const messageId = `assistant-${messageNumber}`
  if ((mode === "selected-sample" || mode === "reordered-sample") && messageNumber === 1) {
    return {
      format: "rostra-conversation",
      schemaVersion: 1,
      conversationId: "synthetic-conversation",
      interactionStatus: "ready",
      messages: [{ id: messageId, role: "assistant", parts: [{ type: "text", text: selectedAnswer }] }],
      responseOutcomes: [
        {
          messageId,
          status: "completed",
          finishReason: "stop",
          hasAnswer: true,
          failedToolCalls: [],
          pendingToolCalls: []
        }
      ],
      toolCalls: [
        {
          messageId,
          toolCallId: "discovery",
          toolName: "search_bills",
          state: "output-available",
          output: {
            resultSet: {
              items: mode === "selected-sample" ? discoveredCandidates : discoveredCandidates.toReversed()
            }
          }
        },
        {
          messageId,
          toolCallId: "state-sources",
          toolName: "web_search",
          state: "output-available",
          output: { text: selectedAnswer, evidence: [{ id: "california-source" }, { id: "new-york-source" }] }
        }
      ]
    }
  }
  return {
    format: "rostra-conversation",
    schemaVersion: 1,
    conversationId: "synthetic-conversation",
    interactionStatus: isComplete ? "ready" : "streaming",
    messages: [
      {
        id: messageId,
        role: "assistant",
        ...(mode === "no-metadata"
          ? {}
          : { metadata: { runId, traceId, requestId: serverRequestId, sessionKey: secret } }),
        parts: [{ type: "text", text: isComplete ? "Synthetic final answer" : "Synthetic partial answer" }]
      }
    ],
    responseOutcomes:
      mode === "no-metadata"
        ? []
        : [
            {
              messageId,
              status: isComplete ? "completed" : "partial",
              finishReason: isComplete ? "stop" : null,
              hasAnswer: true,
              failedToolCalls: ["failed-read"],
              pendingToolCalls: isComplete ? [] : ["pending-read"]
            }
          ],
    toolCalls: [
      {
        messageId,
        toolCallId: "failed-read",
        toolName: "get_bill",
        state: "output-error",
        error: `Synthetic read failure ${secret}`,
        measurement: { runId, durationMs: 12, enrichedResultBytes: null }
      },
      {
        messageId,
        toolCallId: "pending-read",
        toolName: "search_bills",
        state: isComplete ? "output-available" : "input-available",
        measurement: null
      }
    ]
  }
}

function fixturePage(mode: Mode) {
  return `<!doctype html>
<html lang="en"><title>Scenario driver fixture</title>
<body>
<textarea aria-label="Your question"></textarea>
<button id="send" type="button">Send question</button>
<button id="stop" type="button" hidden>Stop response</button>
<script>
const mode = ${JSON.stringify(mode)};
const question = document.querySelector("textarea");
const stop = document.querySelector("#stop");
let controller;
let streaming;
let current = { format: "rostra-conversation", schemaVersion: 1,
  conversationId: "synthetic-conversation", interactionStatus: "ready",
  messages: [], responseOutcomes: [], toolCalls: [] };
stop.disabled = mode === "blocked-stop";
stop.addEventListener("click", () => {
  controller.abort();
  stop.hidden = true;
  current.interactionStatus = "ready";
  current.responseOutcomes = current.responseOutcomes.map(outcome => ({
    ...outcome, status: "cancelled", finishReason: null
  }));
});
document.querySelector("#send").addEventListener("click", async () => {
  if (question.value === "/export") {
    await fetch("/capture", { method: "POST" });
    if (mode === "late-completion") await streaming;
    if (mode === "missing-download") return;
    const text = mode === "invalid-download" ? '{"private":"${secret}"' : JSON.stringify(current);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    link.download = "conversation.json";
    link.click();
    return;
  }
  controller = new AbortController();
  stop.hidden = mode === "late-completion";
  streaming = (async () => {
    const response = await fetch("/chat", { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: question.value }], sessionKey: "${secret}" }) });
    if (!response.ok) { stop.hidden = true; return; }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
      let newline;
      while ((newline = text.indexOf("\\n")) >= 0) {
        current = JSON.parse(text.slice(0, newline));
        text = text.slice(newline + 1);
      }
    }
    stop.hidden = true;
  })().catch(error => {
    if (!controller.signal.aborted) document.body.append(String(error));
  });
});
</script></body></html>`
}

async function runFixture(mode: Mode) {
  await mkdir(join(appDirectory, "tmp"), { recursive: true })
  const directory = await mkdtemp(join(appDirectory, "tmp", "scenario-timeout-"))
  let generationCount = 0
  let captureCount = 0
  const isSample = mode === "selected-sample" || mode === "reordered-sample"
  const submittedPrompts: string[] = []
  let delayed: ServerResponse | undefined
  const server = createServer((request, response) => {
    if (request.url === "/chat") {
      generationCount++
      let body = ""
      request.setEncoding("utf8")
      request.on("data", (chunk: string) => (body += chunk))
      request.once("end", () => {
        const input = z
          .object({ messages: z.array(z.object({ role: z.string(), content: z.string() })) })
          .parse(JSON.parse(body))
        const message = input.messages.at(-1)
        invariant(message)
        submittedPrompts.push(message.content)
      })
      response.setHeader("x-rostra-request-id", serverRequestId)
      if (mode === "http-error" || (mode === "prior-answer" && generationCount > 1)) {
        response.writeHead(500).end("Synthetic upstream failure")
        return
      }
      response.writeHead(200, { "Content-Type": "application/x-ndjson" })
      const isComplete = mode === "completed" || mode === "prior-answer" || isSample
      response.write(JSON.stringify(snapshot(mode, isComplete, generationCount)) + "\n")
      if (isComplete || mode === "no-metadata") {
        response.end()
      } else {
        delayed = response
      }
    } else if (request.url === "/capture") {
      captureCount++
      request.resume()
      if (mode === "late-completion") {
        delayed?.end(JSON.stringify(snapshot(mode, true)) + "\n")
      }
      response.end()
    } else {
      response.writeHead(200, { "Content-Type": "text/html" }).end(fixturePage(mode))
    }
  })
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(0, "127.0.0.1", resolve)
    })
    const address = server.address()
    invariant(address && typeof address !== "string")
    const started = Date.now()
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        cli,
        "--scenario",
        "-",
        "--execute",
        "--base-url",
        `http://127.0.0.1:${address.port}`,
        "--output",
        directory,
        "--wait-ms",
        isSample || ["http-error", "no-metadata", "prior-answer", "completed"].includes(mode) ? "1800" : "600",
        "--capture-ms",
        mode === "missing-download" ? "500" : "3000"
      ],
      {
        cwd: appDirectory,
        env: { ...process.env, OPENROUTER_API_KEY: "", LANGFUSE_SECRET_KEY: "", SENTRY_DSN: "" },
        stdio: ["pipe", "pipe", "pipe"]
      }
    )
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8").on("data", (value: string) => (stdout += value))
    child.stderr.setEncoding("utf8").on("data", (value: string) => (stderr += value))
    const result = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject)
      child.once("close", resolve)
    })
    const watchdog = setTimeout(() => child.kill("SIGKILL"), 20_000)
    child.stdin.end(
      JSON.stringify({
        id: mode,
        objective: "Preserve a synthetic response without model or external network calls.",
        jurisdictions: isSample ? ["U.S. federal", "California", "New York"] : ["U.S. federal"],
        maximumExchanges: 2,
        steps: [
          { id: "first", prompt: isSample ? "Identify 2-3 relevant proposals total." : "Synthetic first question" },
          isSample
            ? { id: "second", prompt: sampleFollowUp, requiresRecordsFrom: { stepId: "first", kind: "bill" } }
            : { id: "second", prompt: "Synthetic dependent question" }
        ]
      })
    )
    let code: number | null
    try {
      code = await result
    } finally {
      clearTimeout(watchdog)
      if (child.exitCode === null) {
        child.kill("SIGKILL")
      }
    }
    expect(stderr).toBe("")
    expect(Date.now() - started).toBeLessThan(20_000)
    const output = z.object({ directory: z.string() }).parse(JSON.parse(stdout))
    const files = await readdir(output.directory)
    const contents = await Promise.all(
      files.map(async (file) => ({ file, text: await readFile(join(output.directory, file), "utf8") }))
    )
    for (const { text } of contents) {
      expect(text).not.toContain(secret)
    }
    const reportText = contents.find(({ file }) => file === "report.json")?.text
    invariant(reportText)
    const report = reportSchema.parse(JSON.parse(reportText))
    const receipts = contents
      .filter(({ file }) => file.endsWith(".receipt.json"))
      .map(({ text }) => receiptSchema.parse(JSON.parse(text)))
      .sort((left, right) => left.exchange - right.exchange)
    expect(receipts).toEqual(report.exchanges)
    return { code, report, receipts, contents, generationCount, captureCount, submittedPrompts }
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    await rm(directory, { recursive: true, force: true })
  }
}

describe("scenario CLI final observation", () => {
  it("captures an idle response that completes only after the driver deadline without retrying", async () => {
    const result = await runFixture("late-completion")
    expect(result.code).toBe(1)
    expect(result.generationCount).toBe(1)
    expect(result.captureCount).toBe(1)
    const receipt = result.receipts[0]
    expect(receipt).toMatchObject({
      failure: { kind: "driver-timeout" },
      stop: { status: "not-visible" },
      capture: { status: "succeeded", file: "exchange-1.json" },
      outcome: { status: "completed", finishReason: "stop" },
      delivery: "completed",
      answered: true,
      requests: [{ serverRequestId, status: 200, terminal: "finished" }],
      messages: [{ metadata: { runId, traceId }, parts: [{ text: "Synthetic final answer" }] }]
    })
    expect(result.report.state).toBe("paused")
    const deadline = result.report.events.findIndex((event) => event.event === "driver-timeout")
    expect(deadline).toBeGreaterThan(-1)
    expect(result.report.events.findIndex((event) => event.event === "request-finished")).toBeGreaterThan(deadline)
    expect(result.report.coverage.executed.map((step) => step.stepId)).toEqual(["first"])
  }, 25_000)

  it("preserves cancelled partial text, failed and pending calls, measurements and correlations", async () => {
    const result = await runFixture("cancelled-stream")
    expect(result.generationCount).toBe(1)
    expect(result.captureCount).toBe(1)
    expect(result.receipts[0]).toMatchObject({
      stop: { status: "clicked" },
      capture: { status: "succeeded" },
      delivery: "cancelled",
      answered: false,
      outcome: { finishReason: null },
      pendingToolCalls: ["pending-read"],
      failedToolCalls: ["failed-read"],
      calls: [
        { state: "output-error", measurement: { durationMs: 12, enrichedResultBytes: null } },
        { state: "input-available", measurement: null }
      ],
      messages: [{ metadata: { runId, traceId }, parts: [{ text: "Synthetic partial answer" }] }]
    })
    expect(result.report.requests[0]).toMatchObject({ terminal: "failed", serverRequestId })
    expect(result.contents.some(({ file }) => file === "exchange-1.json")).toBe(true)
  }, 25_000)

  it("still captures when a visible Stop control cannot be clicked within its budget", async () => {
    const result = await runFixture("blocked-stop")
    expect(result.receipts[0]).toMatchObject({
      failure: { kind: "driver-timeout" },
      stop: { status: "timed-out" },
      capture: { status: "succeeded" },
      outcome: { status: "partial", finishReason: null }
    })
    expect(result.generationCount).toBe(1)
  }, 25_000)

  it.each(["missing-download", "invalid-download"] as const)(
    "retains an independent sanitized failure receipt for %s",
    async (mode) => {
      const result = await runFixture(mode)
      expect(result.code).toBe(1)
      expect(result.report.state).toBe("harness-error")
      expect(result.generationCount).toBe(1)
      expect(result.captureCount).toBe(1)
      expect(result.receipts[0]).toMatchObject({
        failure: { kind: "driver-timeout" },
        capture: { status: mode === "missing-download" ? "timed-out" : "failed", file: null },
        requests: [{ serverRequestId, status: 200 }],
        outcome: null,
        calls: null,
        messages: null,
        hasAnswer: null,
        failedToolCalls: null,
        pendingToolCalls: null,
        delivery: "unknown"
      })
      expect(result.contents.some(({ file }) => file === "exchange-1.json")).toBe(false)
    },
    25_000
  )

  it("keeps missing assistant metadata unknown even when text and tool calls were captured", async () => {
    const result = await runFixture("no-metadata")
    expect(result.receipts[0]).toMatchObject({
      capture: { status: "succeeded" },
      outcome: null,
      delivery: "unknown",
      hasAnswer: null,
      failedToolCalls: null,
      pendingToolCalls: null
    })
    const message = result.receipts[0]?.messages?.[0]
    expect(message).toBeDefined()
    expect(message).not.toHaveProperty("metadata")
    expect(result.generationCount).toBe(1)
  }, 25_000)

  it.each(["http-error", "prior-answer"] as const)(
    "does not borrow an earlier outcome or trace for %s before an assistant response",
    async (mode) => {
      const result = await runFixture(mode)
      expect(result.receipts.at(-1)).toMatchObject({
        capture: { status: "succeeded" },
        requests: [{ serverRequestId, status: 500, terminal: "finished" }],
        outcome: null,
        messages: [],
        messageIds: [],
        calls: [],
        delivery: "unknown",
        hasAnswer: null,
        failedToolCalls: null,
        pendingToolCalls: null
      })
      expect(result.generationCount).toBe(mode === "prior-answer" ? 2 : 1)
      expect(result.report.coverage.answered).toHaveLength(mode === "prior-answer" ? 1 : 0)
    },
    25_000
  )

  it("preserves ordinary completion and executes the authored follow-up", async () => {
    const result = await runFixture("completed")
    expect(result.code).toBe(0)
    expect(result.report.state).toBe("finished-unassessed")
    expect(result.report.coverage.answered).toHaveLength(2)
    expect(result.generationCount).toBe(2)
    expect(result.captureCount).toBe(2)
    expect(result.receipts[0]).toMatchObject({
      failure: null,
      stop: { status: "not-requested" },
      capture: { status: "succeeded" },
      delivery: "completed"
    })
  }, 25_000)

  it.each(["selected-sample", "reordered-sample"] as const)(
    "submits the authored sample-scoped follow-up without injecting the %s inventory",
    async (mode) => {
      const result = await runFixture(mode)
      expect(result.code).toBe(0)
      expect(result.submittedPrompts).toEqual([
        "Identify 2-3 relevant proposals total.\n\nApproved jurisdictions: U.S. federal, California, New York.",
        `${sampleFollowUp}\n\nApproved jurisdictions: U.S. federal, California, New York.`
      ])
      expect(result.report.progress[0]?.records).toEqual(
        mode === "selected-sample" ? discoveredCandidates : discoveredCandidates.toReversed()
      )
      expect(result.receipts[0]?.messages?.[0]?.parts).toEqual([{ type: "text", text: selectedAnswer }])
      expect(result.report.coverage.answered.map((step) => step.stepId)).toEqual(["first", "second"])
    },
    25_000
  )
})
