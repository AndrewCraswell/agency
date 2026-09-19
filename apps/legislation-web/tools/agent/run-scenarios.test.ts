import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { MockLanguageModelV4 } from "ai/test"
import invariant from "tiny-invariant"
import { expect, it } from "vitest"
import { runScenario } from "./run-scenarios"
import { adaptiveDecisionSchema, scenarioSchema } from "./scenario-policy"

const scenario = scenarioSchema.parse({
  id: "adaptive-fixture",
  objective: "Understand a selected education proposal and its limitations.",
  jurisdictions: ["California", "New York"],
  maximumExchanges: 6,
  adaptive: {
    persona: "A reporter",
    constraints: ["Use California and New York; do not invent missing proposals."],
    maximumRecoveries: 1
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
    log.insertAdjacentHTML('beforeend','<form aria-label="Clarification"><fieldset><legend>Which states?</legend><label for="answer">Your answer</label><input id="answer" aria-label="Your answer"><button type="submit">Continue</button></fieldset></form>');
    document.querySelector('form').onsubmit=async event=>{ event.preventDefault(); const value=document.querySelector('#answer').value; await fetch('/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'answer-clarification',response:{requestId:'11111111-1111-4111-8111-111111111111'}})}); document.querySelector('form').remove(); await send(value,{messages:[],clarificationId:'11111111-1111-4111-8111-111111111111'}); };
    answer('Which states?', 'clarification');
  } else if (turn===2) { answer('California proposal Alpha is selected. New York evidence is unavailable.', 'completed'); }
  else if (turn===3) { answer('Incomplete response', 'failed'); }
  else { answer('Alpha requires annual reports. New York remains unresolved.', 'completed'); }
}
document.querySelector('#send').onclick=async()=>{
  if(box.value==='/export'){
    const snapshot={format:'rostra-conversation',schemaVersion:1,conversationId:'browser-fixture',interactionStatus:'ready',messages,responseOutcomes:outcomes,toolCalls:calls};
    const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([JSON.stringify(snapshot)],{type:'application/json'})); link.download='export.json'; link.click(); URL.revokeObjectURL(link.href); box.value=''; return;
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

it("drives clarification, a grounded follow-up, bounded recovery and early finish using only visible text", async () => {
  const app = await fixture()
  const output = await mkdtemp(join(tmpdir(), "adaptive-browser-"))
  const inputs: string[] = []
  const decisions = [
    { action: "clarify", text: "California and New York", reason: "Answer the visible state question.", goals: [] },
    {
      action: "follow-up",
      text: "What does Alpha require? Keep New York's gap explicit.",
      reason: "Follow the selected proposal, not every discovery.",
      goals: []
    },
    {
      action: "recover",
      text: "Start with just Alpha's reporting obligation, keeping the New York gap explicit.",
      reason: "Recover from the incomplete answer once.",
      goals: []
    },
    {
      action: "finish",
      text: "",
      reason: "The bounded objective is addressed with a documented gap.",
      goals: [
        { id: "discover", status: "addressed", quote: "California proposal Alpha is selected." },
        { id: "explain", status: "unresolved", quote: "Alpha requires annual reports. New York remains unresolved." }
      ]
    }
  ].map((decision) =>
    adaptiveDecisionSchema.parse({ ...decision, optionLabels: [], jurisdictions: scenario.jurisdictions })
  )
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
    const result = await runScenario(scenario, app.url, output, { model, adaptiveModel: "fixture", waitMs: 5000 })
    expect(result.state).toBe("finished-unassessed")
    const report = JSON.parse(await readFile(join(result.directory, "report.json"), "utf8"))
    expect(report.exchangeCounts).toEqual({ submitted: 4, captured: 4, answered: 2 })
    expect(report.exchanges[1].requestPattern).toBe("confirmation-resume")
    expect(report.exchanges[2].delivery).toBe("failed")
    expect(report.decisions.map((decision: { action: string }) => decision.action)).toEqual([
      "clarify",
      "follow-up",
      "recover",
      "finish"
    ])
    expect(report.goalAssessment.verified).toBe(false)
    expect(report.coverage.unassessed).toEqual(["discover", "explain"])
    expect(inputs).toHaveLength(4)
    expect(inputs.join("\n")).not.toContain("Hidden discovery inventory")
    expect(inputs.join("\n")).not.toContain("bill:unselected-secret")
    expect(JSON.stringify(app.submissions)).not.toContain("bill:unselected-secret")
    expect(app.submissions).toHaveLength(5)
  } finally {
    await app.close()
    await rm(output, { recursive: true, force: true })
  }
}, 60_000)

it("captures the last exchange after its wait expires without resubmitting research", async () => {
  const app = await fixture(true)
  const output = await mkdtemp(join(tmpdir(), "timeout-browser-"))
  try {
    const result = await runScenario(scenarioSchema.parse({ ...scenario, adaptive: undefined }), app.url, output, {
      waitMs: 1000
    })
    const report = JSON.parse(await readFile(join(result.directory, "report.json"), "utf8"))
    expect(result.state).toBe("paused")
    expect(report.exchanges[0]).toMatchObject({ driverTimedOut: true, delivery: "failed" })
    expect(JSON.parse(await readFile(join(result.directory, "exchange-1.json"), "utf8")).conversationId).toBe(
      "browser-fixture"
    )
    expect((await readFile(join(result.directory, "final.png"))).length).toBeGreaterThan(0)
    expect(app.submissions).toHaveLength(1)
  } finally {
    await app.close()
    await rm(output, { recursive: true, force: true })
  }
}, 60_000)
