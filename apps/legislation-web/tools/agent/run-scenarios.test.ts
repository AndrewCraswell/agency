import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runInNewContext } from "node:vm"
import { APICallError } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { chromium } from "playwright"
import invariant from "tiny-invariant"
import { expect, it, vi } from "vitest"
import { z } from "zod"
import { planAdaptiveTurn } from "./adaptive-planner"
import { runScenario } from "./run-scenarios"
import { scenarioBrowser } from "./scenario-browser"
import { adaptiveDecisionSchema, scenarioSchema, snapshotSchema } from "./scenario-policy"
import { ScenarioSession } from "./scenario-session"
import { createScenarioCoordinator } from "./serve-scenarios"

const scenario = scenarioSchema.parse({
  id: "adaptive-fixture",
  objective: "Understand a selected education proposal and its limitations.",
  jurisdictions: ["California", "New York"],
  adaptive: {
    persona: "A reporter",
    constraints: ["Use California and New York; do not invent missing proposals."]
  },
  steps: [
    { id: "discover", prompt: "Find an education proposal in California and New York." },
    { id: "explain", prompt: "Explain its obligations and evidence gaps." }
  ]
})

async function fixture(stall = false) {
  const submissions: unknown[] = []
  const server = createServer(async (request, response) => {
    if (request.url === "/chat") {
      const chunks: Buffer[] = []
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk))
      }
      submissions.push(JSON.parse(Buffer.concat(chunks).toString()))
      response.writeHead(200, { "content-type": "application/json" }).end("{}")
      return
    }
    response.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html><body>
<div role="log" aria-label="Conversation"></div><textarea aria-label="Your question"></textarea><button id="send">Send question</button><button id="stop" hidden>Stop response</button>
<script>
const log = document.querySelector('[role="log"]'); const box = document.querySelector('textarea'); let turn = 0;
const messages = []; const outcomes = []; const calls = [];
function answer(text, status) {
  const id = 'answer-' + turn;
  log.insertAdjacentHTML('beforeend', '<article aria-label="Rostra response">' + text + '</article>');
  messages.push({id, role:'assistant', parts:[{type:'text',text}]});
  outcomes.push({messageId:id,status,finishReason:status==='completed'?'stop':null,hasAnswer:status==='completed',pendingToolCalls:[],failedToolCalls:[]});
  calls.push({messageId:id,toolCallId:'hidden-'+turn,toolName:'search_bills',state:'output-available',output:{resultSet:{items:[{id:'bill:unselected-secret',kind:'bill',title:'Hidden discovery inventory'}]}}});
}
async function send(text, body) {
  turn++; log.insertAdjacentHTML('beforeend','<article aria-label="Your question"></article>'); log.lastChild.textContent=text;
  messages.push({id:'user-'+turn,role:'user',parts:[{type:'text',text}]});
  await fetch('/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body || {messages:[{role:'user',content:text}]})});
  if (${stall}) { document.querySelector('#stop').hidden=false; return; }
  if (turn===1) {
    log.insertAdjacentHTML('beforeend','<form aria-label="Clarification"><fieldset><legend>Which states?</legend><label for="answer">Your answer</label><input type="text" id="answer"><button type="submit">Continue</button></fieldset></form>');
    document.querySelector('form').onsubmit=async event=>{ event.preventDefault(); const value=document.querySelector('#answer').value; await fetch('/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'answer-clarification',response:{requestId:'11111111-1111-4111-8111-111111111111'}})}); document.querySelector('form').remove(); await send(value,{messages:[],clarificationId:'11111111-1111-4111-8111-111111111111'}); };
    answer('Which states?', 'clarification');
  } else if (turn===2) { answer('California proposal Alpha is selected. New York evidence is unavailable.', 'completed'); }
  else if (turn===3 || turn===5) { answer('Incomplete response', 'failed'); }
  else { answer('Alpha requires annual reports. New York remains unresolved.', 'completed'); }
}
document.querySelector('#send').onclick=async()=>{
  if(box.value==='/export'){
    const snapshot={format:'rostra-conversation',schemaVersion:1,conversationId:'browser-fixture',interactionStatus:'ready',messages,responseOutcomes:outcomes,toolCalls:calls};
    document.querySelector('[data-conversation-export]')?.remove();
    const region=document.createElement('section'); region.setAttribute('aria-label','Conversation export'); region.setAttribute('data-conversation-export','');
    const pre=document.createElement('pre'); pre.setAttribute('aria-label','Conversation export JSON'); const code=document.createElement('code'); code.textContent=JSON.stringify(snapshot,null,2); pre.append(code); region.append(pre); log.append(region); box.value=''; return;
  }
  const text=box.value; box.value=''; await send(text);
};
document.querySelector('#stop').onclick=()=>{document.querySelector('#stop').hidden=true; answer('Incomplete response','failed');};
</script></body></html>`)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  invariant(address && typeof address !== "string")
  return {
    url: `http://127.0.0.1:${address.port}`,
    submissions,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

it("drives more than eight exchanges and multiple recoveries using only visible text", async () => {
  const app = await fixture()
  const output = await mkdtemp(join(tmpdir(), "adaptive-browser-"))
  const inputs: string[] = []
  const decisions = [
    { action: "clarify", text: "California and New York", reason: "Answer the visible state question." },
    {
      action: "follow-up",
      text: "What does Alpha require? Keep New York's gap explicit.",
      reason: "Follow the selected proposal, not every discovery."
    },
    {
      action: "follow-up",
      text: "Start with just Alpha's reporting obligation, keeping the New York gap explicit.",
      reason: "Recover from the incomplete answer."
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      action: "follow-up",
      text: `Clarify a distinct remaining obligation ${index}.`,
      reason: "Resolve the next part of the objective."
    })),
    {
      action: "finish",
      text: "",
      reason: "The objective is addressed with a documented gap."
    }
  ].map((decision) => adaptiveDecisionSchema.parse({ ...decision, optionLabels: [] }))
  let index = 0
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      inputs.push(JSON.stringify(prompt))
      const decision = decisions[index++]
      invariant(decision)
      return {
        content: [{ type: "text", text: JSON.stringify(decision) }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 }
        },
        warnings: []
      }
    }
  })
  try {
    const result = await runScenario(
      { ...scenario, id: "long-scenario-name".repeat(30) },
      app.url + "/research",
      output,
      { model, adaptiveModel: "fixture", waitMs: 5000 }
    )
    expect(result).toMatchObject({
      state: "finished-unassessed",
      reason: "The objective is addressed with a documented gap."
    })
    const report = JSON.parse(await readFile(join(result.directory, "report.json"), "utf8"))
    expect(report.exchangeCounts).toEqual({ submitted: 10, captured: 10 })
    expect(report.correctness).toBe("unassessed")
    expect(inputs).toHaveLength(10)
    expect(inputs.join("\n")).not.toContain("Hidden discovery inventory")
    expect(inputs.join("\n")).not.toContain("bill:unselected-secret")
    expect(JSON.stringify(app.submissions)).not.toContain("bill:unselected-secret")
    expect(JSON.stringify(app.submissions)).not.toContain("Approved jurisdictions:")
    const persisted = await ScenarioSession.open(result.directory)
    expect(persisted.summary.submissions.map((submission) => submission.text)).toEqual([
      scenario.steps[0]!.prompt,
      ...decisions.filter((decision) => decision.action !== "finish").map((decision) => decision.text)
    ])
    expect(persisted.summary.scenario.jurisdictions).toEqual(["California", "New York"])
    expect(app.submissions).toHaveLength(11)
  } finally {
    await app.close()
    await rm(output, { recursive: true, force: true })
  }
}, 60_000)

it("keeps observing across checkpoints until cancellation then resumes without resending", async () => {
  const app = await fixture(true)
  const output = await mkdtemp(join(tmpdir(), "timeout-browser-"))
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({ action: "finish", text: "", optionLabels: [], reason: "Objective addressed." })
        }
      ],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 }
      },
      warnings: []
    })
  })
  try {
    const result = await runScenario(scenario, app.url, output, {
      waitMs: 100,
      model,
      page,
      signal: AbortSignal.timeout(1500)
    })
    const report = JSON.parse(await readFile(join(result.directory, "report.json"), "utf8"))
    expect(result.state).toBe("checkpoint")
    expect(report.resumable).toBe(true)
    const journal = (await readFile(join(result.directory, "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    expect(
      journal.filter((event) => event.event === "checkpoint" && event.data.reason.includes("Continuing to observe"))
        .length
    ).toBeGreaterThan(1)
    expect(await page.getByRole("button", { name: "Stop response", exact: true }).isVisible()).toBe(true)
    expect(app.submissions).toHaveLength(1)
    const restarted = await ScenarioSession.open(result.directory)
    await expect(restarted.next(model)).rejects.toThrow("Unconfirmed")
    await page.evaluate(
      "document.querySelector('#stop').hidden=true; answer('Completed after checkpoint', 'completed')"
    )
    const resumed = await runScenario(scenario, app.url, output, {
      waitMs: 5000,
      model,
      page,
      resume: result.directory
    })
    expect(resumed).toMatchObject({ state: "finished-unassessed", reason: "Objective addressed." })
    expect(app.submissions).toHaveLength(1)
    expect((await readdir(result.directory)).some((name) => name.startsWith("capture-"))).toBe(true)
  } finally {
    await browser.close()
    await app.close()
    await rm(output, { recursive: true, force: true })
  }
}, 60_000)

it("plans with long history and repairs an invalid candidate without research submission", async () => {
  const inputs: string[] = []
  let attempt = 0
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      inputs.push(JSON.stringify(prompt))
      const text = attempt++ < 3 ? "" : "Which implementation costs remain unknown?"
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              action: "follow-up",
              text,
              optionLabels: [],
              reason: "Resolve the remaining objective."
            })
          }
        ],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 }
        },
        warnings: []
      }
    }
  })
  const result = await planAdaptiveTurn({
    model,
    scenario,
    visible: { transcript: "Evidence ".repeat(20_000), clarification: null, hasFailure: true },
    previous: [],
    exchange: 14
  })
  expect(result.decision.text).toBe("Which implementation costs remain unknown?")
  expect(inputs).toHaveLength(4)
  expect(inputs[0]!.length).toBeGreaterThan(80_000)
  expect(inputs[1]).toContain("requires text")
})

function decisionModel(text: string, action = "follow-up") {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            action,
            text: action === "finish" ? "" : text,
            optionLabels: [],
            reason: "Investigate the remaining objective."
          })
        }
      ],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 }
      },
      warnings: []
    })
  })
}
const visible = { transcript: "Evidence is incomplete.", clarification: null, hasFailure: false }
function captured(texts: string[], sessionId = "fixture-session", hasAnswer = true) {
  return snapshotSchema.parse({
    format: "rostra-conversation",
    schemaVersion: 1,
    conversationId: sessionId,
    interactionStatus: "ready",
    messages: texts.flatMap((text, index) => {
      const question = { id: `question-${index}`, role: "user", parts: [{ type: "text", text }] }
      if (index === texts.length - 1 && !hasAnswer) {
        return [question]
      }
      return [
        question,
        { id: `answer-${index}`, role: "assistant", parts: [{ type: "text", text: "Evidence is incomplete." }] }
      ]
    }),
    responseOutcomes: texts.flatMap((_, index) =>
      index === texts.length - 1 && !hasAnswer
        ? []
        : [
            {
              messageId: `answer-${index}`,
              status: "completed",
              finishReason: "stop",
              hasAnswer: true,
              pendingToolCalls: [],
              failedToolCalls: []
            }
          ]
    ),
    toolCalls: []
  })
}

it("reconciles a 503 without attributing the previous answer and rejects cross-attempt session reuse", async () => {
  const root = await mkdtemp(join(tmpdir(), "scenario-state-"))
  const directory = join(root, "first")
  const model = decisionModel("What costs remain unverified?")
  try {
    let session = await ScenarioSession.open(directory, scenario)
    await session.next(model)
    const first = await session.prepare({ empty: true, url: "http://localhost/" })
    session = await ScenarioSession.open(directory)
    await expect(session.next(model)).rejects.toThrow("Unconfirmed")
    await session.capture(captured([first.text]), visible)
    await session.next(model)
    const second = await session.prepare()
    await session.acknowledge({ status: 503, requestId: "failed-request" })
    session = await ScenarioSession.open(directory)
    await session.capture(captured([first.text, second.text], "fixture-session", false), visible)
    expect(session.summary.submissions[1]).toMatchObject({
      status: "captured",
      messageIds: [],
      request: { status: 503 }
    })
    expect(session.summary.visible?.hasFailure).toBe(true)
    const other = await ScenarioSession.open(join(root, "second"), scenario)
    await other.next(model)
    await other.prepare({ empty: true, url: "http://localhost/" })
    await expect(other.capture(captured([first.text]), visible)).rejects.toThrow("another attempt")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it("cancels repeated invalid planner output and can plan again after reopening", async () => {
  const directory = await mkdtemp(join(tmpdir(), "planner-checkpoint-"))
  const cancellation = new AbortController()
  let calls = 0
  const invalid = decisionModel("")
  const repeated = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls++
      if (calls === 4) {
        cancellation.abort(new Error("Operator cancelled planning"))
      }
      return await invalid.doGenerate(options)
    }
  })
  try {
    const session = await ScenarioSession.open(directory, scenario)
    await session.next(repeated)
    const first = await session.prepare({ empty: true, url: "http://localhost/" })
    await session.capture(captured([first.text], randomUUID()), visible)
    await expect(session.next(repeated, cancellation.signal)).rejects.toThrow("Operator cancelled")
    const resumed = await ScenarioSession.open(directory)
    expect(resumed.summary.status).toBe("active")
    expect(resumed.summary.blocker).toContain("Operator cancelled")
    expect((await resumed.next(decisionModel("What exceptions apply?"))).text).toBe("What exceptions apply?")
    expect(resumed.summary.submissions).toHaveLength(1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it("continues transient planner retries beyond the SDK default without research submissions", async () => {
  let calls = 0
  const working = decisionModel("What exceptions apply?")
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls++
      if (calls <= 4) {
        throw new APICallError({
          message: "Temporarily unavailable",
          url: "https://provider.example",
          requestBodyValues: {},
          statusCode: 503,
          responseHeaders: { "retry-after-ms": "0" },
          isRetryable: true
        })
      }
      return await working.doGenerate(options)
    }
  })
  const planned = await planAdaptiveTurn({ model, scenario, visible, previous: [], exchange: 9 })
  expect(planned.decision.text).toBe("What exceptions apply?")
  expect(calls).toBe(5)
})

it("serves the same durable session to integrated browser operations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "integrated-coordinator-"))
  const session = await ScenarioSession.open(directory, scenario)
  const { server } = createScenarioCoordinator(session, decisionModel("", "finish"), "http://127.0.0.1:3000")
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  invariant(address && typeof address !== "string")
  const base = `http://127.0.0.1:${address.port}`
  const headers = { origin: "http://127.0.0.1:3000", "content-type": "application/json" }
  const post = async (path: string, body = {}) =>
    await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) })
  try {
    expect((await fetch(base + "/state")).status).toBe(403)
    expect((await post("/next")).ok).toBe(true)
    const prepared = await (await post("/prepare", { empty: true, url: "http://127.0.0.1:3000/" })).json()
    expect((await post("/prepare", { empty: true, url: "http://127.0.0.1:3000/" })).status).toBe(503)
    expect((await post("/capture", { snapshot: captured([prepared.text], randomUUID()), visible })).ok).toBe(true)
    expect((await post("/next")).ok).toBe(true)
    expect((await ScenarioSession.open(directory)).summary.status).toBe("finished-unassessed")
    const source = await (await fetch(base + "/browser", { headers })).json()
    expect(source.source).toContain("scenarioBrowser")
    expect(source.source).not.toContain("__name")
    expect(source.source).not.toContain('Stop response", exact: true }).click')
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    await rm(directory, { recursive: true, force: true })
  }
})

it("continues an explicitly reopened finish and permits the same text as a new submission", async () => {
  const root = await mkdtemp(join(tmpdir(), "intentional-repeat-"))
  try {
    const session = await ScenarioSession.open(join(root, "attempt"), scenario)
    const model = decisionModel("", "finish")
    await session.next(model)
    const first = await session.prepare({ empty: true, url: "https://staging.example.org/research/start" })
    await session.capture(captured([first.text], randomUUID()), visible)
    await session.next(model)
    expect(session.summary.status).toBe("finished-unassessed")
    await expect(session.continueAfterBlocker("")).rejects.toThrow("reason")
    await session.continueAfterBlocker("A source was corrected; confirm the original answer again.")
    await session.next(decisionModel(first.text))
    const second = await session.prepare()
    expect(second.text).toBe(first.text)
    expect(second.id).not.toBe(first.id)
    await expect(session.prepare()).rejects.toThrow("No question")
    const events = (await readFile(join(root, "attempt", "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    expect(events.find((event) => event.event === "operator-continue").data).toMatchObject({
      previousStatus: "finished-unassessed",
      previousDecision: { action: "finish" }
    })
    await expect(session.authorizeOrigin("https://production.example.org")).rejects.toThrow(
      "different application origin"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each([400, 401, 403])("does not retry permanent planner HTTP %s failures", async (statusCode) => {
  let calls = 0
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      calls++
      throw new APICallError({
        message: "Permanent failure",
        url: "https://provider.example",
        requestBodyValues: {},
        statusCode,
        isRetryable: true
      })
    }
  })
  await expect(planAdaptiveTurn({ model, scenario, visible, previous: [], exchange: 1 })).rejects.toThrow(
    "Permanent failure"
  )
  expect(calls).toBe(1)
})

it("honors provider retry timing and supports cancellation during provider backoff", async () => {
  const controller = new AbortController()
  const events: unknown[] = []
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw new APICallError({
        message: "Rate limited",
        url: "https://provider.example",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { "retry-after": "120" },
        isRetryable: true
      })
    }
  })
  await expect(
    planAdaptiveTurn({
      model,
      scenario,
      visible,
      previous: [],
      exchange: 1,
      signal: controller.signal,
      record: (event, value) => {
        if (event === "planner-retry") {
          events.push(value)
          controller.abort()
        }
      }
    })
  ).rejects.toThrow("aborted")
  expect(events).toEqual([{ status: 429, waitMs: 120_000 }])
})

it("recovers a destroyed read context without losing the conversation", async () => {
  const app = await fixture()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(app.url)
    const fail = vi.spyOn(page, "evaluate").mockRejectedValueOnce(new Error("Execution context was destroyed"))
    const events: unknown[] = []
    const standalone = z
      .custom<typeof scenarioBrowser>((value) => typeof value === "function")
      .parse(runInNewContext(`(${scenarioBrowser.toString()})`))
    const result = await standalone(
      page,
      { action: "inspect" },
      {
        origin: app.url,
        onRecovery: async (event) => {
          events.push(event)
        }
      }
    )
    expect(result).toMatchObject({ empty: true })
    expect(events).toHaveLength(1)
    expect(app.submissions).toHaveLength(0)
    fail.mockRestore()
  } finally {
    vi.restoreAllMocks()
    await browser.close()
    await app.close()
  }
})

it("reconciles a Send error after delivery without pressing Send again", async () => {
  const app = await fixture()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(app.url)
    const send = page.getByRole("button", { name: "Send question", exact: true })
    const originalPress = send.press.bind(send)
    const press = vi.spyOn(send, "press").mockImplementationOnce(async (...args) => {
      await originalPress(...args)
      throw new Error("Execution context was destroyed after dispatch")
    })
    const originalRole = page.getByRole.bind(page)
    vi.spyOn(page, "getByRole").mockImplementation((role, options) =>
      options?.name === "Send question" ? send : originalRole(role, options)
    )
    const result = await scenarioBrowser(page, { action: "submit", text: "One question" })
    expect(result).toMatchObject({ submitted: true, delivery: "unknown" })
    await page.getByRole("form", { name: "Clarification" }).waitFor()
    expect(app.submissions).toHaveLength(1)
    expect(press).toHaveBeenCalledTimes(1)
    const snapshot = await scenarioBrowser(page, { action: "export" })
    expect(snapshot).toHaveProperty("snapshot.messages.0.parts.0.text", "One question")
    expect(app.submissions).toHaveLength(1)
  } finally {
    vi.restoreAllMocks()
    await browser.close()
    await app.close()
  }
})
