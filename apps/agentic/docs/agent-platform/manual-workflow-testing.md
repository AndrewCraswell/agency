# Manual Workflow Testing

Status: Working acceptance guide

Last reviewed: 2026-07-20

This guide defines the product work needed to test saved workflow drafts through real server execution and the small
workflows used to manually exercise the task library. It supplements the authoritative platform roadmap; it does not
replace milestone acceptance or automated coverage.

## Intended test behavior

**Test draft** means executing the saved draft through the normal durable server runtime. It is not a fixture-based
simulation.

A draft test must:

- seal the saved draft revision into an immutable, non-published execution package;
- resolve and pin the same model, agent, resource, and operation snapshots required for publication;
- create a durable run in PostgreSQL and execute it through the normal worker;
- call real configured resources, including OpenRouter, repository reads, provider reads, and provider mutations;
- persist normal attempts, effects, artifacts, usage, evidence, waits, child runs, and terminal results;
- accept synthetic input for manual, webhook, and schedule triggers; and
- identify the run as a draft test and link it to the workflow and tested draft revision.

Costs, external mutations, long-running execution, and provider connectivity failures are expected consequences of a
functional test. The interface should describe the affected resources before starting the run, but it must not replace
them with fixtures or block mutations merely because the run tests a draft.

Draft tests do not activate external subscriptions. A draft webhook test injects a normalized provider event after
ingress, and a draft schedule test injects a schedule fire. Testing webhook signatures, Nango forwarding,
normalization, matching, deduplication, or automatic schedule dispatch requires publishing the workflow and causing the
real external event or scheduled fire.

## Product work

- [x] Replace the fixture-based draft simulation endpoint and editor result model with a durable **Test draft** command.
- [x] Save and validate before testing, then reject the test if the client revision is stale.
- [x] Build an immutable test execution package without changing the workflow's active published version.
- [x] Resolve and pin model, agent, provider operation, and resource snapshots exactly as publication does.
- [x] Give every draft test a unique trigger identity while retaining stable effect identities within that run.
- [x] Support synthetic manual input, normalized provider events, and schedule fires without registering draft triggers
      in the published webhook or schedule catalogs.
- [x] Require the user to select the exact trigger step when a draft contains more than one eligible trigger.
- [x] Record run provenance that distinguishes draft tests from published runs and includes the tested draft revision
      and package digest.
- [x] Navigate from the editor to the normal run details surface so long-running, waiting, and child workflows remain
      observable after navigation or refresh.
- [x] Persist Markdown and model artifacts through the same artifact store used by published runs.
- [x] Remove workflow fixtures, fixture selection, and simulation result contracts from workflow definitions and product
      APIs after live testing replaces simulation.
- [x] Keep deterministic executor tests and provider fakes as automated engineering tests; do not expose them as the
      product's workflow Test action.
- [x] Explain in the trigger input UI that synthetic webhook and schedule inputs begin after external ingress.
- [x] Describe affected resources, live model calls, and external mutations before starting the run.
- [x] Prove that editing a draft during a test cannot change its sealed package or execution history.
- [x] Prove that draft tests never receive real webhook deliveries or automatic schedule fires.
- [x] Require an explicit JSON Schema for every structured model output, send it to the model provider, and
      validate the returned JSON locally. Add a **Generate schema** option that derives an editable schema from the
      prompt or example output, validates it as a supported schema, and requires user review before saving it.
- [ ] Last: decide how Daytona-backed repository-agent tests acquire, retain, and clean up workspaces before enabling
      that step in this manual suite.

The execution-package schema was fixed forward in the original journal migration. Existing prototype databases created
from the earlier migration shape must be reset; there is no compatibility rewrite for unreleased package content.

## Manual workflow suite

Every workflow is created against a dedicated GitHub test repository. Provider mutations use dedicated GitHub or
Linear test resources whose changes may be discarded. Each workflow should remain small enough that its run graph and
evidence make a failure attributable to one capability.

Run `pnpm db:seed` after database migration to create or update the example workflow drafts. Each example has
a stable seed-owned workflow ID. Rerunning the command leaves unchanged drafts alone and advances the draft revision
only when the canonical example definition or metadata changes.

### 1. Manual data and validation

Graph: **Manual trigger -> Set fields -> Map fields -> Validate -> Condition -> branch Set fields -> Exclusive merge ->
Compose Markdown -> Success**

Normalize a manual request, validate its required identity and priority fields, and route urgent and normal requests
through differently configured Set fields steps before merging them into one report. Run both condition outcomes and a
missing-field case. Confirm mapped values, validation failure details, one selected branch, the persisted Markdown
artifact, and the terminal result.

Tools: `manual_trigger`, `set_fields`, `map_fields`, `validate`, `condition`, `exclusive_merge`, `compose_markdown`,
`success`.

### 2. Parallel collection and routing

Graph: **Manual trigger -> three parallel Set fields steps -> Collect -> Validate -> Switch -> branch Set fields ->
Exclusive merge -> Compose Markdown -> Success or Failure**

Build three independently labeled sections from the same input and collect them into a keyed object. Validate the
assembled object, switch on the requested report format, and merge the selected formatting branch. Exercise every
switch case, the default case, a duplicate collection key, and the configured collection limit.

Tools: parallel activation, `collect`, `validate`, `switch`, `exclusive_merge`, `failure`.

### 3. OpenRouter JSON triage

Graph: **Manual trigger -> Map fields -> AI model structured output -> Validate -> Condition -> branch Set fields ->
Exclusive merge -> Compose Markdown -> Success**

Ask a selected OpenRouter model to return `{category, score, summary, tags}` under a strict JSON schema. Validate the
unwrapped `response.value`, branch on the numeric score, annotate high-risk and normal results differently, then merge
and render the complete triage report. Use several inputs around the condition boundary and one deliberately
constrained-output configuration to observe a model execution failure. Separately select an incompatible model and
confirm that sealing the test package rejects it before a run starts.

Confirm the requested and resolved model, schema-valid JSON, logic over model fields, token usage, estimated cost,
provider request evidence, and persisted report artifact.

Tools: `ai_model` structured output, `validate`, `condition`, mappings, merge, and artifact creation.

### 4. AI-generated list review

Graph: **Manual trigger -> AI model structured output -> Map fields -> For each -> Structured judgment -> Condition ->
branch Set fields -> Exclusive merge -> Join -> Compose Markdown -> Success**

Have the first model return an array of candidate objects with stable IDs and evidence. Map that array into For each,
run a structured judgment for every candidate, branch each item on its judgment decision, annotate accepted and rejected
items, merge each item branch, and join all item results into one report. Configure concurrency below the candidate
count so deferred item release is visible.

Confirm JSON array validation, one scoped activation and model call per item, bounded concurrency, judgment schemas,
per-item branch selection, deterministic joined order, aggregate usage, and the maximum-item failure path. Assertions
cover schema and routing correctness rather than exact model wording.

Tools: `ai_model`, `for_each`, `structured_judgment`, `condition`, `exclusive_merge`, `join`, and artifact creation.

### 5. Model-driven bounded repeat

Graph: **Manual trigger -> Set fields -> Repeat -> AI model structured output -> Map fields -> Validate -> loop back ->
Compose Markdown -> Success**

Initialize state with a bounded `remaining` count and a notes array. On each iteration, ask the model for strict JSON
containing the next lower count and an updated note, map and validate that state, then send it back to Repeat. Run once
to normal completion, once with a model response that leaves the condition true until exhaustion, and once under each
exhaustion policy.

Confirm repeated live OpenRouter calls, JSON validation on every iteration, loop scopes, increasing iteration numbers,
activation budgets, final state, aggregate usage, and deterministic exhaustion. The configured maximum remains the
safety boundary if the model fails to decrement correctly.

Tools: `bounded_loop`, repeated `ai_model` structured output, `map_fields`, `validate`, and loop-back routing.

### 6. Published webhook classification

Graph: **Provider event -> Map fields -> Repository data -> AI model structured output -> Validate -> Switch -> branch
Set fields -> Exclusive merge -> Compose Markdown -> Success**

First use **Test draft** with a synthetic normalized event to exercise the downstream workflow and real OpenRouter call.
Enrich the event with bounded data from the inherited repository, classify it into `ignore`, `review`, or `urgent`, and
route the structured result through three branches before producing a report. Then publish it and cause harmless events
on the bound resource.

Confirm resource-specific matching, one run for a duplicate delivery, no run for another resource, normalized event
fields, the repository read, schema-valid model output, every switch branch, and persisted provider/model evidence.

Tools: `provider_event`, `repository_data`, `ai_model`, `validate`, `switch`, merge, and artifact creation.

### 7. Scheduled AI digest

Graph: **Schedule -> Repository data -> AI model structured output -> Validate -> Condition -> branch Set fields ->
Exclusive merge -> AI model Markdown output -> Success**

First inject a schedule fire through **Test draft**. Then publish with a short interval on the local test environment.
Read bounded repository activity, ask one model for a structured digest and `hasNotableChanges` decision, validate and
branch on that decision, then ask a second model to render the selected result as Markdown. Confirm two separately
pinned model steps and both structured and Markdown output modes.

Confirm durable schedule projection, one claimed fire, one completed run, the next run time, model usage and artifacts,
both condition paths, and continued dispatch after a controlled worker restart.

Tools: `schedule`, `repository_data`, two `ai_model` modes, `validate`, `condition`, merge, and model artifact creation.

### 8. Cross-provider comparison

Graph: **Manual trigger -> Repository data and Provider data in parallel -> Join -> AI model structured output ->
Validate -> Switch -> branch Set fields -> Exclusive merge -> Compose Markdown -> Success**

Read bounded GitHub repository data and connected task-provider data in parallel, join both results, and ask a model to
compare their status under a strict `{alignment, gaps, recommendation}` schema. Route aligned, drifting, and blocked
results through separate branches and produce a combined report.

Confirm parallel provider calls, all-branch join behavior, inherited and explicit bindings, JSON validation, switch
routing, provider/model evidence, and the absence of credentials from persisted records.

Tools: `repository_data`, `provider_data`, `join`, `ai_model`, `validate`, `switch`, merge, and artifact creation.

### 9. Judgment-approved provider mutation

Graph: **Manual trigger -> Provider data -> AI model structured output -> Validate -> Structured judgment -> Condition ->
Provider action or Failure -> Compose Markdown -> Success**

Read a disposable issue or task, have one model draft a mutation payload, validate it, and use a second structured
judgment to decide whether the payload satisfies explicit safety criteria. Require the judgment schema to return both
the decision and the approved request payload. Apply that payload through the real provider mutation only on the
approved branch; terminate the rejected branch with its judgment evidence. Render the confirmed provider result.

Confirm two model schemas, judgment-based logic, the rejected path without an effect, the approved external result,
reserved and confirmed effect records, stable effect identity, and operator-visible handling of an intentionally
indeterminate outcome.

Tools: `provider_data`, `ai_model`, `structured_judgment`, `condition`, `provider_action`, `failure`, and effect
journaling.

### 10. Wait, enrich, and route

Graph: **Manual trigger -> Set fields -> Wait -> Map fields -> Provider data -> AI model structured output -> Validate ->
Switch -> branch Set fields -> Exclusive merge -> Compose Markdown -> Success**

Build a correlation context, suspend the run, and resume it with a matching normalized event. Enrich the resumed event
with a provider read, classify it with strict JSON, route the classification, and render the result. Start another run
with a nonmatching event and allow it to expire.

Confirm persisted suspension, correlation matching, refresh-safe run state, real provider and OpenRouter execution only
after resume, switch routing, artifact output, and timeout failure.

Tools: `wait`, `provider_data`, `ai_model`, `validate`, `switch`, merge, and durable resume.

### 11. AI child workflow

Child graph: **Manual trigger -> Map fields -> AI model structured output -> Validate -> Condition -> branch Set fields ->
Exclusive merge -> Success**

Parent graph: **Manual trigger -> Validate -> Invoke workflow -> Structured judgment -> Condition -> Compose Markdown and
Success or Failure**

Publish the child, pin its package and interface digests in the parent, and test the parent draft. The child classifies
and annotates its input; the parent judges the complete child result against separate criteria before accepting or
rejecting it. Publish a second child version that intentionally fails validation.

Confirm the child run link, parent suspension, model evidence on both runs, child branch selection, completion
propagation, parent judgment routing, immutable child version selection, and failure propagation.

Tools: `child_workflow`, `ai_model`, `structured_judgment`, logic, and durable parent-child coordination.

### 12. Model output modes and failure evidence

Graph: **Manual trigger -> AI model text output -> AI model structured output -> Validate -> AI model Markdown output ->
Compose Markdown -> Success**

Pass one subject through all three model output modes. Use the text result as context for a strict JSON extraction, use
the validated JSON as context for Markdown generation, and create a final manifest artifact referencing the result.
Repeat with a low output limit, a refusal-inducing request, and output that cannot satisfy the schema. Separately select
an unavailable or incompatible model and confirm that test-package sealing fails before execution.

Confirm separate usage and provider evidence for every executed call, text preservation, local JSON validation, both
Markdown artifacts, distinct runtime errors for refusal, truncation, invalid JSON, and schema mismatch when the selected
provider/model produces those outcomes, and a distinct pre-run package-resolution error for an unavailable model.

Tools: all `ai_model` output modes, `validate`, prompt mappings, artifact persistence, and model error evidence.

## AI coverage matrix

The suite deliberately exercises model behavior in different graph positions:

| Coverage | Workflows |
| --- | --- |
| Structured object used by Condition or Switch | 3, 6, 7, 8, 10 |
| Structured array used by For each | 4 |
| Structured state used by Repeat and loop-back | 5 |
| Structured judgment used before routing or mutation | 4, 9, 11 |
| Multiple model calls in one run | 7, 9, 11, 12 |
| Model calls inside fan-out or loops | 4, 5 |
| Text output | 12 |
| Markdown output and persisted model artifacts | 7, 12 |
| Usage, cost, resolved-model, and request evidence | 3 through 12 |
| Refusal, truncation, invalid JSON, and schema failure evidence | 3, 5, 12 |

## Deferred workflow

The `repository_agent` step is excluded from this initial suite because it requires a Daytona workspace. Add a focused
workflow after the workspace lifecycle TODO above is resolved; do not hide that dependency behind a fixture.

## Recommended order

Implement live draft testing first, then create workflows 1 through 3 to establish deterministic and structured
OpenRouter execution. Add workflows 4 and 5 for model-driven fan-out and loops, workflows 6 and 7 for real trigger
ingress, workflows 8 and 9 for connected provider behavior, and workflows 10 through 12 for durable orchestration and
model failure evidence. A workflow is useful as manual acceptance evidence only when its run details expose enough
persisted input, output, usage, artifacts, effects, and errors to explain the result.
