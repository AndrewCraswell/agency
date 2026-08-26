import { createHmac, timingSafeEqual } from "node:crypto"
import { createServer } from "node:http"
import { pathToFileURL } from "node:url"

const maxBodyBytes = 8 * 1024

export function configuration(environment = process.env) {
  const path = required(environment, "WEBHOOK_VERIFICATION_RECEIVER_PATH")
  if (!/^\/[A-Za-z0-9_-]{32,}$/.test(path)) {
    throw new Error(
      "WEBHOOK_VERIFICATION_RECEIVER_PATH must be an unguessable single path segment of at least 32 characters."
    )
  }

  const maxAgeSeconds = optionalPositiveInteger(environment.WEBHOOK_VERIFICATION_RECEIVER_MAX_AGE_SECONDS, 300)
  const port = optionalPositiveInteger(environment.PORT, 8080)
  if (port > 65_535) {
    throw new Error("PORT must be between 1 and 65535.")
  }

  return Object.freeze({
    keyId: required(environment, "WEBHOOK_VERIFICATION_RECEIVER_KEY_ID"),
    maxAgeMs: maxAgeSeconds * 1000,
    path,
    port,
    secret: required(environment, "WEBHOOK_VERIFICATION_RECEIVER_SECRET"),
    webhookId: required(environment, "WEBHOOK_VERIFICATION_RECEIVER_WEBHOOK_ID")
  })
}

export function createVerificationReceiver(config, { logger = defaultLogger, now = () => new Date() } = {}) {
  const receiver = createServer(async (request, response) => {
    const finish = (statusCode, body = "") => {
      response.writeHead(statusCode, {
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(body),
        "content-type": "application/json; charset=utf-8"
      })
      response.end(body)
    }

    if (request.method !== "POST") {
      await discard(request)
      response.setHeader("allow", "POST")
      logger("webhook verification rejected: method")
      finish(405)
      return
    }
    if (request.url !== config.path) {
      await discard(request)
      logger("webhook verification rejected: path")
      finish(404)
      return
    }

    const headers = verificationHeaders(request.rawHeaders)
    if (headers === undefined) {
      await discard(request)
      logger("webhook verification rejected: headers")
      finish(400)
      return
    }
    if (!isFreshRfc3339(headers.timestamp, now(), config.maxAgeMs)) {
      await discard(request)
      logger("webhook verification rejected: timestamp")
      finish(401)
      return
    }

    const body = await rawBody(request)
    if (body === undefined) {
      logger("webhook verification rejected: body-size")
      finish(413)
      return
    }

    let challenge
    try {
      challenge = verificationChallenge(body, config.webhookId, now())
    } catch {
      logger("webhook verification rejected: payload")
      finish(400)
      return
    }
    if (!validSignature(headers.signature, headers.timestamp, body, config.keyId, config.secret)) {
      logger("webhook verification rejected: signature")
      finish(401)
      return
    }

    logger("webhook verification accepted")
    finish(200, JSON.stringify({ challenge }))
  })
  receiver.requestTimeout = 10_000
  return receiver
}

export function isRfc3339Timestamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(value)
  if (match === null) {
    return false
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText)
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText)
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate() &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  )
}

function required(environment, name) {
  const value = environment[name]
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required.`)
  }
  return value
}

function optionalPositiveInteger(value, fallback) {
  if (value === undefined) {
    return fallback
  }
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("Configured numeric values must be positive integers.")
  }
  return Number(value)
}

function verificationHeaders(rawHeaders) {
  const values = new Map()
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = rawHeaders[index]
    const value = rawHeaders[index + 1]
    if (name === undefined || value === undefined) {
      return undefined
    }
    const normalized = name.toLowerCase()
    const existing = values.get(normalized)
    values.set(normalized, existing === undefined ? [value] : [...existing, value])
  }
  const contentType = oneHeader(values, "content-type")
  const eventType = oneHeader(values, "legislation-event-type")
  const signature = oneHeader(values, "legislation-signature")
  const timestamp = oneHeader(values, "legislation-timestamp")
  if (
    contentType !== "application/json" ||
    eventType !== "webhook-verification" ||
    signature === undefined ||
    timestamp === undefined
  ) {
    return undefined
  }
  return { signature, timestamp }
}

function oneHeader(values, name) {
  const value = values.get(name)
  return value?.length === 1 ? value[0] : undefined
}

async function rawBody(request) {
  const contentLength = request.headers["content-length"]
  if (contentLength !== undefined && (!/^\d+$/u.test(contentLength) || Number(contentLength) > maxBodyBytes)) {
    await discard(request)
    return undefined
  }
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.byteLength
    if (size <= maxBodyBytes) {
      chunks.push(chunk)
    }
  }
  if (size > maxBodyBytes) {
    return undefined
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))
  } catch {
    return undefined
  }
}

async function discard(request) {
  for await (const _ of request) {
    // Consume a rejected request so the caller receives its fail-closed response rather than a reset socket.
  }
}

function verificationChallenge(body, webhookId, now) {
  const value = JSON.parse(body)
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["challenge", "expiresAt", "type", "webhookId"]) ||
    value.type !== "webhook-verification" ||
    value.webhookId !== webhookId ||
    typeof value.challenge !== "string" ||
    value.challenge.length === 0 ||
    !isRfc3339Timestamp(value.expiresAt) ||
    Date.parse(value.expiresAt) < now.getTime()
  ) {
    throw new Error("Invalid verification payload.")
  }
  return value.challenge
}

function validSignature(signatureHeader, timestamp, body, keyId, secret) {
  const match = /^v1;kid=([^;,\s]+);sig=([a-f0-9]{64})$/u.exec(signatureHeader)
  if (match === null || match[1] !== keyId) {
    return false
  }
  const supplied = Buffer.from(match[2], "hex")
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest()
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

function isFreshRfc3339(value, now, maxAgeMs) {
  return isRfc3339Timestamp(value) && Math.abs(now.getTime() - Date.parse(value)) <= maxAgeMs
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, expected) {
  const keys = Object.keys(value).sort()
  return keys.length === expected.length && keys.every((key, index) => key === expected[index])
}

function defaultLogger(outcome) {
  process.stdout.write(
    `${JSON.stringify({ event: "webhook-verification-receiver", outcome, timestamp: new Date().toISOString() })}\n`
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = configuration()
  const receiver = createVerificationReceiver(config)
  receiver.listen(config.port, "0.0.0.0", () => {
    process.stdout.write(
      `${JSON.stringify({ event: "webhook-verification-receiver", outcome: "listening", timestamp: new Date().toISOString() })}\n`
    )
  })
}
