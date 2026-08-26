import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { request } from "node:http"
import test from "node:test"
import { configuration, createVerificationReceiver, isRfc3339Timestamp } from "./receiver.mjs"

const now = new Date("2026-08-26T12:00:00.000Z")
const secret = "test-signing-secret"
const keyId = "webhook-key:test"
const webhookId = "webhook:test-identifier"
const path = "/Ck4VDQMZEb7dYQdyzj16sPpv1BT6G04D"

test("accepts only a current, exact signed verification challenge", async () => {
  await withReceiver(async ({ port, logs }) => {
    const response = await send(port, signedChallenge())
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers["cache-control"], "no-store")
    assert.deepEqual(JSON.parse(response.body), { challenge: "challenge-value" })
    assert.deepEqual(logs, ["webhook verification accepted"])
  })
})

test("fails closed for an invalid route, method, duplicate headers, stale timestamps, and oversized bodies", async () => {
  await withReceiver(async ({ port }) => {
    assert.equal((await send(port, signedChallenge({ path: "/wrong" }))).statusCode, 404)
    assert.equal((await send(port, signedChallenge({ body: "", method: "GET" }))).statusCode, 405)
    assert.equal(
      (
        await send(
          port,
          signedChallenge({ extraHeaders: [["legislation-signature", "v1;kid=other;sig=0".repeat(64)]] })
        )
      ).statusCode,
      400
    )
    assert.equal((await send(port, signedChallenge({ timestamp: "2026-08-26T11:54:59.999Z" }))).statusCode, 401)
    assert.equal((await send(port, signedChallenge({ body: "x".repeat(8 * 1024 + 1) }))).statusCode, 413)
  })
})

test("rejects malformed payloads and signatures without logging protected values", async () => {
  await withReceiver(async ({ port, logs }) => {
    const body = JSON.stringify({
      challenge: "challenge-value",
      expiresAt: "2026-08-26T12:01:00Z",
      extra: true,
      type: "webhook-verification",
      webhookId
    })
    const malformed = await send(port, signedChallenge({ body }))
    assert.equal(malformed.statusCode, 400)
    const wrongWebhook = await send(
      port,
      signedChallenge({
        body: JSON.stringify({
          challenge: "challenge-value",
          expiresAt: "2026-08-26T12:01:00Z",
          type: "webhook-verification",
          webhookId: "webhook:other"
        })
      })
    )
    assert.equal(wrongWebhook.statusCode, 400)
    const badSignature = await send(
      port,
      signedChallenge({ signature: "v1;kid=webhook-key:test;sig=" + "0".repeat(64) })
    )
    assert.equal(badSignature.statusCode, 401)
    const wrongKey = await send(port, signedChallenge({ signature: `v1;kid=other;sig=${"0".repeat(64)}` }))
    assert.equal(wrongKey.statusCode, 401)
    const output = logs.join("\n")
    assert.equal(output.includes(secret), false)
    assert.equal(output.includes(webhookId), false)
    assert.equal(output.includes("challenge-value"), false)
  })
})

test("validates strict RFC3339 calendar values and receiver configuration", () => {
  assert.equal(isRfc3339Timestamp("2026-02-28T12:00:00Z"), true)
  assert.equal(isRfc3339Timestamp("2026-02-30T12:00:00Z"), false)
  assert.equal(isRfc3339Timestamp("2026-08-26T24:00:00Z"), false)
  assert.throws(() => configuration({}), /PATH is required/u)
  assert.throws(
    () => configuration({ ...environment(), WEBHOOK_VERIFICATION_RECEIVER_PATH: "/predictable" }),
    /unguessable/u
  )
})

function environment() {
  return {
    PORT: "8123",
    WEBHOOK_VERIFICATION_RECEIVER_KEY_ID: keyId,
    WEBHOOK_VERIFICATION_RECEIVER_PATH: path,
    WEBHOOK_VERIFICATION_RECEIVER_SECRET: secret,
    WEBHOOK_VERIFICATION_RECEIVER_WEBHOOK_ID: webhookId
  }
}

async function withReceiver(run) {
  const logs = []
  const receiver = createVerificationReceiver(configuration(environment()), {
    logger: (outcome) => logs.push(outcome),
    now: () => now
  })
  await new Promise((resolve) => receiver.listen(0, "127.0.0.1", resolve))
  try {
    const address = receiver.address()
    assert.notEqual(address, null)
    await run({ logs, port: address.port })
  } finally {
    await new Promise((resolve, reject) => receiver.close((error) => (error === undefined ? resolve() : reject(error))))
  }
}

function signedChallenge({
  body,
  extraHeaders = [],
  method = "POST",
  path: requestPath = path,
  signature,
  timestamp = now.toISOString()
} = {}) {
  const requestBody =
    body === undefined
      ? JSON.stringify({
          challenge: "challenge-value",
          expiresAt: "2026-08-26T12:01:00.000Z",
          type: "webhook-verification",
          webhookId
        })
      : body
  const signed =
    signature ??
    `v1;kid=${keyId};sig=${createHmac("sha256", secret).update(`${timestamp}.${requestBody}`).digest("hex")}`
  return {
    extraHeaders,
    headers: {
      "content-type": "application/json",
      "legislation-event-type": "webhook-verification",
      "legislation-signature": signed,
      "legislation-timestamp": timestamp
    },
    method,
    path: requestPath,
    body: requestBody
  }
}

async function send(port, input) {
  return await new Promise((resolve, reject) => {
    const client = request(
      { headers: input.headers, host: "127.0.0.1", method: input.method, path: input.path, port },
      (response) => {
        const chunks = []
        response.on("data", (chunk) => chunks.push(chunk))
        response.once("end", () =>
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
            statusCode: response.statusCode
          })
        )
      }
    )
    client.once("error", reject)
    for (const [name, value] of input.extraHeaders) {
      client.appendHeader(name, value)
    }
    client.end(input.body)
  })
}
