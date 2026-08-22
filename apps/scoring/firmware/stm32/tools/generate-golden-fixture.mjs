import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const fixtureUrl = new URL("../../../fixtures/golden-vector-export.json", import.meta.url)
const outputUrl = new URL("../generated/stm32_golden_vectors.h", import.meta.url)
const mode = process.argv[2] ?? "write"

if (mode !== "write" && mode !== "--check") {
  throw new Error("Usage: node firmware/stm32/tools/generate-golden-fixture.mjs [--check]")
}

const artifact = JSON.parse(readFileSync(fixtureUrl, "utf8"))

function assert(value, message) {
  if (!value) {
    throw new Error(message)
  }
}

function cString(value) {
  assert(typeof value === "string", "Fixture value must be a string")
  assert(/^[\x20-\x7e]+$/.test(value), "Fixture string must be printable ASCII")
  return JSON.stringify(value)
}

function asCount(value, label) {
  assert(Number.isSafeInteger(value) && value >= 0 && value <= 255, `${label} must fit uint8_t`)
  return value
}

function asUs(value, label) {
  assert(Number.isSafeInteger(value) && value >= 0 && value <= 4_294_967_295, `${label} must fit uint32_t`)
  return value
}

function renderVector(vector) {
  assert(vector && typeof vector === "object", "Vector must be an object")
  assert(vector.expected && typeof vector.expected === "object", "Vector expected result must be an object")
  assert(vector.stimulus && typeof vector.stimulus === "object", "Vector stimulus must be an object")
  assert(Array.isArray(vector.stimulus.samples), "Vector samples must be an array")
  assert(Array.isArray(vector.expected.hits), "Vector hits must be an array")
  assert(Array.isArray(vector.expected.diagnostics), "Vector diagnostics must be an array")

  return [
    "  {",
    `    ${cString(vector.id)},`,
    `    ${cString(vector.weapon)},`,
    `    ${cString(vector.boundary)},`,
    `    ${cString(vector.position)},`,
    `    ${cString(vector.side)},`,
    `    ${asUs(vector.boundaryUs, "boundaryUs")}U,`,
    `    ${asUs(vector.elapsedUs, "elapsedUs")}U,`,
    `    ${asCount(vector.stimulus.samples.length, "sample count")}U,`,
    `    ${asCount(vector.expected.hits.length, "hit count")}U,`,
    `    ${asCount(vector.expected.diagnostics.length, "diagnostic count")}U`,
    "  }"
  ].join("\n")
}

function render(checkedArtifact) {
  assert(checkedArtifact.format === "scoring-firmware-golden-vectors", "Unexpected fixture format")
  assert(checkedArtifact.schemaVersion === "1.0.0", "Unexpected fixture schema version")
  assert(checkedArtifact.ruleSetRevision === "rules-1", "Unexpected fixture rule revision")
  assert(checkedArtifact.timingTableRevision === "timing-1", "Unexpected fixture timing revision")
  assert(checkedArtifact.timeUnit === "us", "Unexpected fixture time unit")
  assert(checkedArtifact.resistanceUnit === "milliOhm", "Unexpected fixture resistance unit")
  assert(Array.isArray(checkedArtifact.vectors) && checkedArtifact.vectors.length > 0, "Fixture has no vectors")

  const vectorRows = checkedArtifact.vectors.map(renderVector).join(",\n")

  return `/* Generated from fixtures/golden-vector-export.json. Do not edit. */
#ifndef STM32_GOLDEN_VECTORS_H
#define STM32_GOLDEN_VECTORS_H

#include <stddef.h>
#include <stdint.h>

typedef struct scoring_golden_vector_fixture {
  const char *id;
  const char *weapon;
  const char *boundary;
  const char *position;
  const char *side;
  uint32_t boundary_us;
  uint32_t elapsed_us;
  uint8_t stimulus_sample_count;
  uint8_t hit_count;
  uint8_t diagnostic_count;
} scoring_golden_vector_fixture_t;

#define SCORING_GOLDEN_VECTOR_FORMAT ${cString(checkedArtifact.format)}
#define SCORING_GOLDEN_VECTOR_SCHEMA_VERSION ${cString(checkedArtifact.schemaVersion)}
#define SCORING_GOLDEN_VECTOR_RULE_SET_REVISION ${cString(checkedArtifact.ruleSetRevision)}
#define SCORING_GOLDEN_VECTOR_TIMING_TABLE_REVISION ${cString(checkedArtifact.timingTableRevision)}
#define SCORING_GOLDEN_VECTOR_DIGEST ${cString(checkedArtifact.digest)}
#define SCORING_GOLDEN_VECTOR_COUNT ${checkedArtifact.vectors.length}U

static const scoring_golden_vector_fixture_t SCORING_GOLDEN_VECTORS[SCORING_GOLDEN_VECTOR_COUNT] = {
${vectorRows}
};

#endif
`
}

const output = render(artifact)

if (mode === "--check") {
  if (readFileSync(outputUrl, "utf8") !== output) {
    throw new Error("Stale STM32 golden fixture translation")
  }
} else {
  mkdirSync(new URL("../generated/", import.meta.url), { recursive: true })
  writeFileSync(outputUrl, output, "utf8")
}
