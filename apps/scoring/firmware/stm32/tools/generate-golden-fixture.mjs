import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const fixtureUrl = new URL("../../../fixtures/golden-vector-export.json", import.meta.url)
const outputUrl = new URL("../generated/stm32_golden_vectors.h", import.meta.url)
const mode = process.argv[2] ?? "write"
const HOST_FIRMWARE_DIGEST = `sha256:${"01".repeat(32)}`

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

function asEnum(value, choices, label) {
  const index = choices.indexOf(value)
  assert(index >= 0, `${label} is unsupported`)
  return index
}

function renderSideContact(weapon, contact) {
  if (weapon === "epee") {
    assert(contact.lineIntegrity === "intact", "Epee fixture line integrity must be intact")
    assert(contact.groundedMaterial === "not-grounded", "Epee fixture must not be grounded")
    const closed = contact.circuitComplete === "closed"
    assert(closed || contact.circuitComplete === "open", "Epee fixture circuit state is unsupported")
    const resistance = contact.contactResistance.resistanceMilliOhms
    const uncertainty = contact.contactResistance.resistanceUncertaintyMilliOhms
    assert(
      (closed && resistance === 10_000 && uncertainty === 0) ||
        (!closed && resistance === null && uncertainty === null),
      "Epee fixture resistance is unsupported"
    )
    return `{ ${closed ? 1 : 0}U, 0U, 0U, 0U, 0U }`
  }

  if (weapon === "foil") {
    assert(contact.integrity === "intact", "Foil fixture integrity must be intact")
    assert(contact.insulationDiagnostic === "unavailable", "Foil fixture diagnostic is unsupported")
    return `{ 0U, ${asEnum(contact.circuitBreak, ["closed", "open"], "Foil circuit break")}U, ${asEnum(contact.targetContext, ["target", "nonTarget"], "Foil target context")}U, 0U, 0U }`
  }

  assert(contact.externalPathEligibility === "eligible", "Sabre fixture external path must be eligible")
  assert(contact.ownEquipmentFault === "absent", "Sabre fixture own-equipment state is unsupported")
  return `{ 0U, 0U, ${asEnum(contact.targetContact, ["target", "nonConductiveSurface"], "Sabre target contact")}U, ${asEnum(contact.bladeContact, ["absent", "present"], "Sabre blade contact")}U, ${asEnum(contact.circuitBCFault, ["normal", "controlBreak"], "Sabre B/C state")}U }`
}

function renderSample(weapon, sample) {
  return `{ ${asUs(sample.atUs, "sample timestamp")}U, ${renderSideContact(weapon, sample.left)}, ${renderSideContact(weapon, sample.right)} }`
}

function renderHit(hit) {
  return `{ ${asEnum(hit.side, ["left", "right"], "hit side")}U, ${asEnum(hit.classification, [null, "on-target", "off-target"], "hit classification")}U, ${asUs(hit.startedAtUs, "hit start")}U, ${asUs(hit.qualifiedAtUs, "hit qualification")}U }`
}

function renderDiagnostic(diagnostic) {
  assert(diagnostic.code === "sabre-white", "Diagnostic code is unsupported")
  return `{ ${asEnum(diagnostic.side, ["left", "right"], "diagnostic side")}U, ${asEnum(diagnostic.value, ["white-off", "white-on"], "white diagnostic")}U }`
}

function recordIdentity(vector, index) {
  return {
    captureId: `${vector.id}.capture`,
    recordId: `${vector.id}.decision-${index + 1}`
  }
}

function renderRecordContext(vector, index, digest) {
  const identity = recordIdentity(vector, index)
  const first = vector.stimulus.samples[0]
  const last = vector.stimulus.samples.at(-1)
  return `{ ${cString(identity.recordId)}, ${cString(identity.captureId)}, ${cString(digest)}, ${cString(HOST_FIRMWARE_DIGEST)}, "golden-boot-1", 0U, ${vector.stimulus.samples.length - 1}U, ${asUs(first.atUs, "capture start")}U, ${asUs(last.atUs, "capture end")}U, ${vector.stimulus.samples.length}U }`
}

function renderRecord(vector, hit, index, digest, ruleSetRevision, timingTableRevision) {
  const identity = recordIdentity(vector, index)
  const first = vector.stimulus.samples[0]
  const last = vector.stimulus.samples.at(-1)
  const disposition = hit.classification === "off-target" ? 1 : 0
  return `{ 1U, ${cString(identity.recordId)}, ${asUs(hit.qualifiedAtUs, "record decision")}U, ${asUs(first.atUs, "record capture start")}U, ${asUs(last.atUs, "record capture end")}U, 0U, ${vector.stimulus.samples.length - 1}U, "stm32-scoring-core", ${cString(HOST_FIRMWARE_DIGEST)}, "golden-boot-1", "host-golden", ${cString(ruleSetRevision)}, ${cString(timingTableRevision)}, "lines-1", "calibration-1", ${cString(identity.captureId)}, ${cString(digest)}, "golden-vector-1", ${vector.stimulus.samples.length}U, 1U, 0U, ${asUs(first.atUs, "raw capture start")}U, ${asUs(last.atUs, "raw capture end")}U, 0U, ${vector.stimulus.samples.length - 1}U, ${asEnum(vector.weapon, ["epee", "foil", "sabre"], "record weapon")}U, ${asEnum(hit.side, ["left", "right"], "record side")}U, ${disposition}U, ${disposition}U, 1U, 1U, ${asUs(hit.startedAtUs, "record hit start")}U, ${asUs(hit.qualifiedAtUs, "record qualification")}U }`
}

function paddedRows(values, limit, renderValue, emptyValue) {
  assert(values.length <= limit, `Fixture array exceeds ${limit} entries`)
  return [...values.map(renderValue), ...Array.from({ length: limit - values.length }, () => emptyValue)].join(", ")
}

function renderVector(vector, digest, ruleSetRevision, timingTableRevision) {
  assert(vector && typeof vector === "object", "Vector must be an object")
  assert(vector.expected && typeof vector.expected === "object", "Vector expected result must be an object")
  assert(vector.stimulus && typeof vector.stimulus === "object", "Vector stimulus must be an object")
  assert(Array.isArray(vector.stimulus.samples), "Vector samples must be an array")
  assert(Array.isArray(vector.expected.hits), "Vector hits must be an array")
  assert(Array.isArray(vector.expected.diagnostics), "Vector diagnostics must be an array")

  assert(["epee", "foil", "sabre"].includes(vector.weapon), "Vector weapon is unsupported")
  const samples = paddedRows(
    vector.stimulus.samples,
    4,
    (sample) => renderSample(vector.weapon, sample),
    "{ 0U, { 0U, 0U, 0U, 0U, 0U }, { 0U, 0U, 0U, 0U, 0U } }"
  )
  const hits = paddedRows(vector.expected.hits, 2, renderHit, "{ 0U, 0U, 0U, 0U }")
  const diagnostics = paddedRows(vector.expected.diagnostics, 2, renderDiagnostic, "{ 0U, 0U }")
  const recordContexts = paddedRows(
    vector.expected.hits,
    2,
    (_hit, index) => renderRecordContext(vector, index, digest),
    "{ NULL, NULL, NULL, NULL, NULL, 0U, 0U, 0U, 0U, 0U }"
  )
  const records = paddedRows(
    vector.expected.hits,
    2,
    (hit, index) => renderRecord(vector, hit, index, digest, ruleSetRevision, timingTableRevision),
    "{ 0 }"
  )

  return [
    "  {",
    `    ${cString(vector.id)},`,
    `    ${asEnum(vector.weapon, ["epee", "foil", "sabre"], "weapon")}U,`,
    `    ${cString(vector.boundary)},`,
    `    ${cString(vector.position)},`,
    `    ${cString(vector.side)},`,
    `    ${asUs(vector.boundaryUs, "boundaryUs")}U,`,
    `    ${asUs(vector.elapsedUs, "elapsedUs")}U,`,
    `    ${asCount(vector.stimulus.samples.length, "sample count")}U,`,
    `    ${asCount(vector.expected.hits.length, "hit count")}U,`,
    `    ${asCount(vector.expected.diagnostics.length, "diagnostic count")}U,`,
    `    { ${samples} },`,
    `    { ${hits} },`,
    `    { ${diagnostics} },`,
    `    { ${recordContexts} },`,
    `    { ${records} }`,
    "  }"
  ].join("\n")
}

function render(checkedArtifact) {
  assert(checkedArtifact.format === "scoring-firmware-golden-vectors", "Unexpected fixture format")
  assert(checkedArtifact.schemaVersion === "1.0.0", "Unexpected fixture schema version")
  assert(checkedArtifact.source === "m1-08-runtime-boundary-vectors", "Unexpected fixture source")
  assert(checkedArtifact.ordering === "m1-08-generation-order", "Unexpected fixture ordering")
  assert(checkedArtifact.ruleSetRevision === "rules-1", "Unexpected fixture rule revision")
  assert(checkedArtifact.timingTableRevision === "timing-1", "Unexpected fixture timing revision")
  assert(checkedArtifact.timeUnit === "us", "Unexpected fixture time unit")
  assert(checkedArtifact.resistanceUnit === "milliOhm", "Unexpected fixture resistance unit")
  assert(Array.isArray(checkedArtifact.vectors) && checkedArtifact.vectors.length > 0, "Fixture has no vectors")

  const vectorRows = checkedArtifact.vectors
    .map((vector) =>
      renderVector(vector, checkedArtifact.digest, checkedArtifact.ruleSetRevision, checkedArtifact.timingTableRevision)
    )
    .join(",\n")

  return `/* Generated from fixtures/golden-vector-export.json. Do not edit. */
#ifndef STM32_GOLDEN_VECTORS_H
#define STM32_GOLDEN_VECTORS_H

#include <stddef.h>
#include <stdint.h>
#include "stm32_scoring_core.h"

typedef struct scoring_golden_vector_fixture {
  const char *id;
  uint8_t weapon;
  const char *boundary;
  const char *position;
  const char *side;
  uint32_t boundary_us;
  uint32_t elapsed_us;
  uint8_t stimulus_sample_count;
  uint8_t hit_count;
  uint8_t diagnostic_count;
  scoring_core_sample_t samples[SCORING_CORE_MAX_SAMPLES_PER_VECTOR];
  scoring_core_hit_t hits[SCORING_CORE_MAX_HITS];
  scoring_core_diagnostic_t diagnostics[SCORING_CORE_SIDE_COUNT];
  scoring_core_record_context_t record_contexts[SCORING_CORE_MAX_HITS];
  scoring_core_decision_record_t records[SCORING_CORE_MAX_HITS];
} scoring_golden_vector_fixture_t;

#define SCORING_GOLDEN_VECTOR_FORMAT ${cString(checkedArtifact.format)}
#define SCORING_GOLDEN_VECTOR_SCHEMA_VERSION ${cString(checkedArtifact.schemaVersion)}
#define SCORING_GOLDEN_VECTOR_SOURCE ${cString(checkedArtifact.source)}
#define SCORING_GOLDEN_VECTOR_ORDERING ${cString(checkedArtifact.ordering)}
#define SCORING_GOLDEN_VECTOR_RULE_SET_REVISION ${cString(checkedArtifact.ruleSetRevision)}
#define SCORING_GOLDEN_VECTOR_TIMING_TABLE_REVISION ${cString(checkedArtifact.timingTableRevision)}
#define SCORING_GOLDEN_VECTOR_TIME_UNIT ${cString(checkedArtifact.timeUnit)}
#define SCORING_GOLDEN_VECTOR_RESISTANCE_UNIT ${cString(checkedArtifact.resistanceUnit)}
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
