# Reference-machine comparison capture contract

M1-10 defines a portable evidence record for comparing a Favero FA-15 or another
scoring machine with the project apparatus. The machine-readable contract is
[`reference-machine-comparison-capture.schema.json`](reference-machine-comparison-capture.schema.json),
and the schema-valid example is
[`reference-machine-comparison-capture.example.json`](reference-machine-comparison-capture.example.json).

This format stores what was observed during a bounded run. It does not define a
scoring rule, analog threshold, acceptance limit, golden expected result, FIE
approval, or product claim. A comparison capture may be evidence for a later
review, but it cannot promote an observation into a rule automatically.

## Contract boundary

The capture references an M0-07 golden scenario by scenario ID, path, schema
revision, digest, and selected input IDs. The golden scenario remains the only
place where replay inputs and expected results are expressed. The capture does
not copy `expect`, add an expected-result field, or reinterpret a scenario's
expected decision.

An output may optionally reference a separately stored M0-05 decision record by
record ID, schema version, and content digest. That reference identifies an
already-produced authority record; it does not make a front-panel observation
into a decision record. The capture's `reportedDisposition` uses the M0-05
vocabulary only to label what the machine reported. It is not a scoring
decision and does not replace the immutable record's provenance or outcome.

Consumers accept only `format: scoring-reference-machine-comparison-capture`
and `schemaVersion: 1.0.0`. Unknown versions fail closed. A published capture,
its source references, observations, and artifact references are immutable;
corrections are a new capture ID.

## Provenance and bounded storage

Every source document has an authority, SHA-256 digest, locator, and declared
use. The authority values reuse the existing scoring vocabulary:

- `fie` is normative context only when the cited article or Annex B paragraph
  supports the claim.
- `prior-art` identifies Favero or another commercial machine. It is comparison
  context, never authority for the project's rule table.
- `implementation` identifies committed project contracts such as the golden
  scenario and decision-record contracts.
- `fixture` identifies a fixture description or procedure.

Each machine records manufacturer, model, serial number, hardware revision, and
firmware identity status. Unknown or not-applicable values are explicit nulls
and statuses, not silently omitted fields. Instruments record model, serial
number, firmware version, and calibration status. Measurements use integer
portable units and must carry an uncertainty kind and value (or an explicit
`unknown` uncertainty). Measured values are signed safe integers by default so
voltage, temperature, and comparison deltas can be below zero; resistance,
elapsed `us`, and counts remain non-negative. The session's
`wallClockUncertaintyUs` and all observation timestamps use integer microseconds.

The schema bounds machines, instruments, source references, observations,
artifact references, strings, and comparison annotations. Raw video, scope, and
logic-analyzer data are not embedded. They are content-addressed by a lowercase
`sha256:` digest, with byte length, format, UTC capture time, and monotonic
coverage stored in the bounded `artifacts` list.

## Setup, inputs, and outputs

`setup` records the weapon, run mode, fixture identity, declared logical-line
connections, environment readings, and operator notes. A connection endpoint is
descriptive evidence, not a new seven-line topology contract.

Each input observation records its source, monotonic timestamp and uncertainty,
the corresponding golden input IDs (which may be empty for setup-only stimuli),
channel, observed electrical state, optional measured quantity, and artifact
digests. State vocabulary matches the golden scenario contract, including
`indeterminate` and `not-applicable`; an absent resistance measurement is not
treated as zero.

Each output observation records the machine, timestamp and uncertainty,
observation quality, optional reported M0-05 disposition, visible or audible
indication, optional measured quantity, and supporting artifact IDs. A clear
output and an uncertain output are both preserved; uncertainty is never silently
collapsed into a hit or no-hit.

## Comparison annotations are descriptive

Comparisons pair two observed input or output IDs and state only a descriptive
relationship: `same`, `different`, `left-only`, `right-only`, `inconclusive`,
`not-observed`, or `not-comparable`. A `delta` is an observed measurement with
its own uncertainty, not a tolerance. The format has no `pass`, `fail`,
`threshold`, `expected`, `promote`, or `normative` comparison status. An
annotation can explain what was seen and which artifact supports it, but cannot
authorize a rule change.

Before using a capture in a review, a validator must additionally check rules
that JSON Schema cannot express:

1. IDs are unique within each collection; every source ID, machine ID,
   instrument ID, observation ID, artifact ID, and decision-record reference is
   resolvable in its declared scope.
2. `scenarioRef.contentDigest` matches the committed golden scenario, its
   schema version is supported, and every selected input ID exists in that
   scenario. The validator never imports `expect` into the capture.
3. Observation and artifact intervals are ordered, bounded by the session, and
   use the declared `us` clock. An instrument referenced by a measurement
   exists, and its calibration status is retained as evidence rather than
   converted into a pass/fail result.
4. A decision-record reference resolves to an immutable M0-05 record whose
   schema version is supported. The capture must not alter, complete, or
   reclassify that record.
5. Every comparison pair refers to the intended two observations, and the
   relationship and delta are supported by the listed artifacts. No comparison
   annotation is copied into a timing table, golden scenario, or decision record
   without an independent reviewed change.

## Local source context

The example uses the committed local references listed in
[`apps/scoring/docs/README.md`](README.md):

- FIE Material Rules, Book 3, August 2026, Annex B, p. 80, SHA-256
  `1489d28ed6f3c91e27ecdf75bb29b4ed65c688a012f544d37d946a9da81afc26`.
  This is the normative context for the epee behavior; it is not replaced by a
  machine observation.
- Favero FA-15 T2016 specifications, p. 1, SHA-256
  `f575c8a7630fbf104ca8afa4cd28544cb2d75a35a4ff4c5716a19c31513db72f`.
  The published timing profile is prior art for choosing a comparison run, not
  a project timing table.
- Favero FA-15 FIE homologation, p. 1, SHA-256
  `1314e203ed3e0b5890b1ee9ff826778ddf6a6e4345439534128342ad2e0ee529`.
  The certificate's model, serial, three-weapon, and 5 V statements are machine
  identity context only.
- Favero FA-15 User Manual, pp. 11-12, SHA-256
  `c4ac240f4e81795d966ede9909450cae8ad9fcc7a19e138c83ab999664d33d20`.
  Published supply, acoustic, environmental, and connection details are prior
  art and fixture context only.

The local FIE matrix states the same authority order: FIE text is normative,
project contracts choose deterministic points inside an FIE tolerance, and
bench or homologation observations provide evidence without changing the rule.

## Validation

Validation is documentation-only and requires no runtime package or service.
From the repository root, the following focused check parses both JSON files,
compiles the Draft 2020-12 schema with Ajv, and validates the example:

```powershell
node -e "const fs=require('node:fs'); const Ajv2020=require('ajv/dist/2020').default; const addFormats=require('ajv-formats').default; const schema=JSON.parse(fs.readFileSync('apps/scoring/docs/reference-machine-comparison-capture.schema.json','utf8')); const example=JSON.parse(fs.readFileSync('apps/scoring/docs/reference-machine-comparison-capture.example.json','utf8')); const ajv=new Ajv2020({strict:true}); addFormats(ajv); if (!ajv.compile(schema)(example)) { console.error(ajv.errors); process.exit(1) } console.log('reference-machine comparison capture: schema and example valid')"
```

The measurement unit guard is also intentional. This focused check accepts a
negative millivolt reading and rejects a negative resistance reading:

```powershell
node -e "const fs=require('node:fs'); const Ajv2020=require('ajv/dist/2020').default; const addFormats=require('ajv-formats').default; const schema=JSON.parse(fs.readFileSync('apps/scoring/docs/reference-machine-comparison-capture.schema.json','utf8')); const ajv=new Ajv2020({strict:true}); addFormats(ajv); ajv.addSchema(schema); const `$ref=ajv.compile({`$ref:schema.`$id+'#/`$defs/measurement'}); const base={uncertainty:{kind:'absolute',value:1},instrumentId:null,method:'signed-unit check'}; if (!`$ref({...base,value:-1,unit:'milliVolt'}) || `$ref({...base,value:-1,unit:'milliOhm'})) process.exit(1); console.log('signed measurement guard valid')"
```

The example is intentionally synthetic: artifact digests identify bounded
evidence placeholders, and the scope/camera calibration status is explicit.
Replace those values with the real files and instrument certificates for a
bench run; do not copy the example's observations into a golden vector.
