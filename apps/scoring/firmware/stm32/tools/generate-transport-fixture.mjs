import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const fixtureUrl = new URL("../../../fixtures/transport-frame-golden.json", import.meta.url)
const codecUrl = new URL("../../../dist/transport-frame.js", import.meta.url)
const outputUrl = new URL("../generated/stm32_transport_golden_frames.h", import.meta.url)
const mode = process.argv[2] ?? "write"

if (mode !== "write" && mode !== "--check") {
  throw new Error("Usage: node firmware/stm32/tools/generate-transport-fixture.mjs [--check]")
}

function assert(value, message) {
  if (!value) {
    throw new Error(message)
  }
}

function bytes(values) {
  return Array.from(values, (value) => `0x${value.toString(16).padStart(2, "0").toUpperCase()}U`).join(", ")
}

function cString(value) {
  assert(typeof value === "string" && /^[a-z0-9-]+$/.test(value), "Fixture name must be lowercase ASCII")
  return JSON.stringify(value)
}

function receiverValue(receiver) {
  if (receiver === "stm32") {
    return "SCORING_STM32_TRANSPORT_RECEIVER_STM32"
  }
  if (receiver === "esp32") {
    return "SCORING_STM32_TRANSPORT_RECEIVER_ESP32"
  }
  throw new Error("Fixture receiver is invalid")
}

function messageTypeValue(messageType) {
  const values = {
    "decision-record": "SCORING_STM32_TRANSPORT_DECISION_RECORD",
    request: "SCORING_STM32_TRANSPORT_REQUEST",
    response: "SCORING_STM32_TRANSPORT_RESPONSE",
    status: "SCORING_STM32_TRANSPORT_STATUS"
  }
  const value = values[messageType]
  assert(value, "Fixture message type is invalid")
  return value
}

const artifact = JSON.parse(readFileSync(fixtureUrl, "utf8"))
const { encodeTransportFrame } = await import(codecUrl.href)

assert(artifact && typeof artifact === "object" && !Array.isArray(artifact), "Fixture root must be an object")
assert(Object.keys(artifact).length === 1 && Object.hasOwn(artifact, "fixtures"), "Fixture root has unknown fields")
assert(Array.isArray(artifact.fixtures) && artifact.fixtures.length > 0, "Fixture list is required")

const fixtureNames = new Set()
const rows = artifact.fixtures.map((fixture, index) => {
  assert(fixture && typeof fixture === "object" && !Array.isArray(fixture), "Fixture must be an object")
  assert(
    Object.keys(fixture).length === 5 &&
      ["name", "receiver", "messageType", "payloadHex", "sequence"].every((field) => Object.hasOwn(fixture, field)),
    "Fixture has unknown or missing fields"
  )
  cString(fixture.name)
  assert(!fixtureNames.has(fixture.name), "Fixture names must be unique")
  fixtureNames.add(fixture.name)
  assert(typeof fixture.payloadHex === "string" && /^[0-9a-f]*$/i.test(fixture.payloadHex), "Payload must be hex")
  assert(fixture.payloadHex.length % 2 === 0, "Payload hex must contain complete bytes")
  assert(
    Number.isInteger(fixture.sequence) && fixture.sequence >= 0 && fixture.sequence <= 0xffff_ffff,
    "Sequence is invalid"
  )
  const payload = new Uint8Array(Buffer.from(fixture.payloadHex, "hex"))
  const frame = encodeTransportFrame({
    flags: 0,
    messageType: fixture.messageType,
    payload,
    sequence: fixture.sequence
  })
  const symbol = `SCORING_STM32_TRANSPORT_GOLDEN_${index}`

  const payloadDeclaration =
    payload.length === 0
      ? `static const uint8_t ${symbol}_PAYLOAD[1] = { 0U };`
      : `static const uint8_t ${symbol}_PAYLOAD[] = { ${bytes(payload)} };`

  return {
    frame,
    payload,
    rendered:
      `${payloadDeclaration}\n` +
      `static const uint8_t ${symbol}_FRAME[] = { ${bytes(frame)} };\n` +
      `  { ${cString(fixture.name)}, ${receiverValue(fixture.receiver)}, ${messageTypeValue(fixture.messageType)}, ` +
      `${fixture.sequence}U, ${symbol}_PAYLOAD, ${payload.length}U, ${symbol}_FRAME, ${frame.length}U }`
  }
})

const arrays = rows.map((row) => row.rendered.split("\n").slice(0, 2).join("\n")).join("\n\n")
const fixtures = rows.map((row) => row.rendered.split("\n")[2]).join(",\n")
const output = `/* Generated from fixtures/transport-frame-golden.json through dist/transport-frame.js. Do not edit. */
#ifndef STM32_TRANSPORT_GOLDEN_FRAMES_H
#define STM32_TRANSPORT_GOLDEN_FRAMES_H

#include "stm32_transport.h"

typedef struct scoring_stm32_transport_golden_fixture {
  const char *name;
  scoring_stm32_transport_receiver_t receiver;
  scoring_stm32_transport_message_type_t message_type;
  uint32_t sequence;
  const uint8_t *payload;
  size_t payload_length;
  const uint8_t *frame;
  size_t frame_length;
} scoring_stm32_transport_golden_fixture_t;

${arrays}

#define SCORING_STM32_TRANSPORT_GOLDEN_FIXTURE_COUNT ${rows.length}U
static const scoring_stm32_transport_golden_fixture_t SCORING_STM32_TRANSPORT_GOLDEN_FIXTURES[] = {
${fixtures}
};

#endif
`

if (mode === "--check") {
  if (readFileSync(outputUrl, "utf8") !== output) {
    throw new Error("Stale STM32 transport golden fixture translation")
  }
} else {
  mkdirSync(new URL("../generated/", import.meta.url), { recursive: true })
  writeFileSync(outputUrl, output, "utf8")
}
