# Full-Featured Workflow Editor Plan

Status: Active design plan; expert-reviewed, implementation has not started

Last reviewed: 2026-07-19

This plan refines the workflow authoring, data handoff, repository-agent, and execution model in the
[integration-driven workflow platform plan](integration-workflow-platform-plan.md). Where the plans differ on workflow
resource selection, editor layout, or agent snapshot timing, this focused plan is authoritative.

## 1. Product objective

Build a workflow editor that lets an operator compose durable software-delivery automations from typed triggers, data
operations, repository agents, direct model inference, provider actions, deterministic logic, and terminal outcomes.
The same immutable graph must support authoring, execution, restart recovery, and historical inspection.

The critical product proof is a workflow in which one node emits a schema-validated value and an immutable artifact, a
second node receives only its declared projection, and the complete handoff remains reproducible after process restart.

## 2. Confirmed decisions

1. Connecting an integration authorizes access and discovers data. It does not select a repository, team, or project.
2. A workflow may be created without a repository. Agency asks for a repository when the author adds a
  repository-dependent step or starter, and publication blocks only while a required binding remains unresolved.
  GitHub is the first repository implementation, but workflow contracts use provider-neutral references.
3. Repositories, teams, projects, and other resources are selected when configuring the step or workflow input that
  needs them. One workflow may use multiple resources.
4. Repository agents are discovered from `.github/**/*.agent.md` in a bound repository and selected by stable
   source reference.
5. Publication pins the reviewed agent content and source reference. Run preparation seals the exact content-addressed
  snapshots used by that run. All attempts and retries use the sealed run manifest; published behavior never follows
  later repository changes implicitly.
6. Workflows are typed dataflow graphs. Steps declare inputs and outputs; connections explicitly map source fields to
   destination fields.
7. The Agency PostgreSQL run journal is authoritative for observable execution facts. LangGraph provides scheduling,
  checkpoint mechanics, interrupts, and resume algorithms; a checkpoint cannot independently establish completion or
  historical truth.
8. Publication produces one content-addressed executable package that pins schemas, step executors, mappings, compiler
  semantics, and the compiled plan. Run preparation verifies and instantiates that package instead of reinterpreting
  the draft through the current registry.
9. One graph step may create many activation instances across branches, collection items, and loop iterations. Attempts
  belong to an activation. A successful selected output becomes immutable once committed and downstream input pins it.
10. Small values live in the durable run journal. Large or file-like content lives in artifact storage and moves through
   the graph as immutable typed references.
11. Mutating provider operations use a durable effect ledger. Agency never retries an operation with an unknown outcome
   until reconciliation establishes whether the effect occurred.
12. Direct model inference is a first-class step. It calls OpenRouter without provisioning a Daytona workspace.
13. Arbitrary JavaScript, mutable global variables, unbounded loops, and model-selected graph routing are not supported.
14. React Flow is an authoring and projection surface, never executable state. An ordered workflow outline is an
   equivalent authoring surface for keyboard, screen-reader, and small-screen use.
15. Customer-facing UX uses steps, inputs, outputs, files, documents, connections, and versions. Schemas, activation
   identities, checkpoint cursors, provider payloads, storage locations, and orchestration internals remain in
   permissioned diagnostics.
16. Desktop uses a collapsible settings dock that is closed by default and remembers the author's preference. Selection
   commands appear near the selected object when space permits and in a stable command area otherwise. Mobile is
   list-first. A minimap may be enabled for large workflows but is off by default and is never the only navigation aid.

## 3. Information architecture

### 3.1 Workflows list

The list shows workflow name, bound repositories and services where applicable, draft and published state, readiness,
enabled triggers, and last run. Operators can create, search, duplicate, archive, open, and run workflows.

Creating a workflow is a short resumable flow:

1. Enter name and optional description.
2. Optionally choose a starter, repository, or blank workflow.
3. Create the draft and open the editor.

Connection and repository setup may open from this flow without losing entered metadata. Search, refresh, request-access,
reconnect, expired-access, no-results, and permission-denied states explain the next action. Adding a repository-dependent
step prompts for a binding at that point. Changing or removing a binding previews invalidated agent references, provider
steps, test fixtures, and mappings before applying the change.

### 3.2 Editor shell

The editor has one underlying workflow representation and two synchronized authoring views:

- The visual canvas is the desktop default and fills the available workspace.
- The ordered outline can find, add, configure, connect, reorder, and delete every step without canvas interaction. It
  is the mobile default and is always available on desktop.
- The header contains workflow identity, bindings, save and publication state, Undo, Redo, Review issues, Test draft,
  Publish, and Run published version.
- A collapsible settings dock is closed by default, remembers the desktop preference, and never overlays the selected
  step. Full-screen dialogs or sheets replace it on constrained layouts.
- The circular Add step FAB remains a stable entry point. Dragging from a compatible output may open the same Add step
  surface already filtered to valid next steps.
- React Flow provides zoom, fit all, fit selection, fit active path, search, and issue navigation. An optional minimap is
  off by default and appears only for sufficiently large workflows.

A compact selection toolbar appears adjacent to the selected step or connection when collision and viewport rules allow.
On constrained layouts, during keyboard navigation, or when the selection is offscreen, the same commands appear in a
stable selection bar. It identifies the selection in text, never relies on proximity alone, and must not cover the Add
step FAB, graph controls, focused content, or mobile safe area. Familiar commands use Fluent icon buttons with accessible
labels and tooltips.

For a selected step, the initial commands are:

- Edit
- Test step
- Duplicate
- Enable or disable when the step kind supports it
- Open in GitHub for a repository-agent step
- Delete

For a selected connection, which React Flow renders as a path, the initial commands are:

- Edit mappings
- Edit branch outcome when applicable
- Insert compatible step
- Delete

For a multi-selection, only commands valid for every selected object appear. Delete is available; alignment and grouping
may be added later. Pressing Enter or double-clicking a single step or connection invokes Edit. Escape clears selection and
returns focus to the canvas.

The dock and dialogs use staged Apply and Cancel behavior, preserve invalid input while open, warn before discarding
changes, and return focus to the originating object. Applying one configuration change is one undoable authoring action.
Configuration never requires editing raw workflow JSON.

An on-demand issue navigator groups blocking errors and warnings by step, connection, binding, and workflow setting.
Selecting an issue focuses the affected object and exact field. Blank workflows show a small set of relevant starts,
not instructional prose spread across the canvas.

The ordered outline represents graph structure without relying on geometry:

- Triggers and terminal outcomes are named landmarks.
- Branches are expandable groups labeled by outcome; authors add, rename, and reorder outcomes through commands.
- Parallel branches show their shared fan-out and exclusive merge or join as explicit rows.
- Loop and for-each bodies are nested groups with item, accumulator, exit, and failure connections.
- Connection editing chooses a source step, named output, destination step, named input, and mappings through searchable
  lists. Only valid targets are offered.
- Reordering changes presentation order only unless an explicit connection command changes execution dependencies.
- Move, connect, disconnect, indent into a body, move out, and focus parent/child commands are keyboard operable and
  announce the resulting relationship. Focus returns to the affected row after every dialog or mutation.

### 3.3 Add step

The FAB opens a searchable, keyboard-accessible Add step surface. It shows compatible next steps when invoked from a
connection, recent items, recommended starts for a blank workflow, and setup or repair actions for unavailable
integrations. Nested category menus may remain as a fast path, but they are not the complete discovery model. Items are
generated from the step registry, connected capabilities, repository-agent catalog, and workflow context.

| Category  | Initial nodes                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Triggers  | Manual run, Schedule, GitHub event, Linear event, Child workflow event                                     |
| Data      | Repository data, Pull request data, Task data, Set fields, Map fields, Compose Markdown, Validate, Collect |
| AI        | Repository agent, AI model, Structured judgment                                                        |
| Actions   | GitHub actions, Linear actions, Invoke child workflow, Wait                                             |
| Logic     | Condition, Switch, Exclusive merge, Bounded loop, For each, Join                                         |
| Terminal  | Success, Failure, Cancelled, Abandoned                                                                  |

Provider-specific entries are contributed by the integration capability catalog. The graph executor sees generic
`provider-trigger`, `provider-data`, and `provider-action` contracts rather than branching on provider names.

Approval is absent from the production Add step surface until recipient authorization, evidence, decisions, feedback,
expiry, escalation, timeout races, audit identity, and durable resume semantics are designed and implemented. An
intentional preview program may expose it separately, but a disabled production item must not imply near-term support.

### 3.4 Workflow settings

The settings dialog contains:

- General metadata
- Repository and service bindings
- Workflow inputs
- Constants
- Runtime defaults and budgets
- Referenced resource bindings
- Repository agent catalog and refresh state
- Version history

Secrets never appear as editable workflow variables. Settings can bind an opaque secret capability where an authorized
step type explicitly requires one.

### 3.5 Authoring tests

Testing is a first-class authoring loop:

- **Test step** runs one selected step with editable simulated input.
- **Run to here** evaluates the smallest valid ancestor path needed to produce the selected step's input.
- **Test draft** evaluates the current saved draft without activating published triggers.
- Named test fixtures may start from manual samples, redacted provider samples, or a copy of historical run input.
- Fixtures record provenance, redaction, creation time, sample artifacts, and the workflow revision they target. They are
  never relabeled as historical evidence and never mutate a prior run.
- Fixtures may assert expected output fields, schema-valid success or classified error, and artifact metadata or digest.
  Scenario history records the fixture revision and package or draft digest used for each result.
- Authors can run all selected scenarios. Workflow policy may require named scenarios to pass before publication, but a
  copied historical input never becomes a mutable historical run.
- Paid model and workspace tests show estimated limits and require confirmation above policy thresholds.
- Provider reads use test credentials and bounded requests. Mutating actions simulate and preview their request by
  default; a separately authorized real test names the target, effect, and idempotency behavior before execution.

Test results show validated input, output, files, timing, cost, logs, and classified failure alongside the fixture. A
successful test does not bypass publication validation.

### 3.6 Publication and execution

The editor distinguishes saved draft, valid draft, unpublished changes, published version, and active triggers.

- **Review issues** runs continuously and on demand; warnings remain visible without blocking unrelated editing.
- **Publish** shows changed steps, inputs and outputs, service bindings, agent versions, triggers, expected external
  changes, and the immutable workflow version it will create. Trigger activation is an explicit consequence. Package
  digests and schema details remain in permissioned technical details.
- **Test draft** always uses the saved draft and simulation policy.
- **Run published version** opens a generated input form, names the exact version and bindings, warns when visible draft
  changes are excluded, estimates paid work, and prevents duplicate submission.

### 3.7 Run projection

Live and historical runs render the exact published graph read-only. Selecting a node opens its run details in a dialog
or subordinate page containing attempts, validated inputs, selected output, artifact previews, usage, cost, logs,
failures, and evidence. A chronological event view provides an accessible alternative to the graph.

Failure-first navigation focuses the first actionable failed or waiting step without moving graph geometry. The run
surface distinguishes **Retry step**, **Retry from here**, **Resume**, and **Run again**. Before acting, it identifies the
version, affected descendants, repeated paid work, known or unknown provider effects, required permission, and whether a
new run is safer. Disconnected live updates show their last confirmed sequence and reconnect without affecting execution.

- **Retry step** is available only for a failed activation whose successful output has never been selected. It creates
  another attempt for that activation.
- **Retry from here** is available only when no consumed successful output would be replaced. It retries the failed
  activation and descendants that never committed output; otherwise Agency requires **Run again**.
- **Resume** supplies the one authorized event or decision needed by a waiting activation. Terminal runs cannot resume.
- **Run again** creates a new run from an explicitly selected published version and input, preserving the prior run.
- **Cancel** increments the run's cancellation generation, prevents new leases, and requests active work to stop. It
  never claims that a dispatched external change was undone.

An external action with an unknown outcome enters **Needs confirmation**. The operator sees the intended change, target,
request time, provider evidence, reconciliation attempts, and affected downstream steps. An authorized operator can
**Check again** or record **Change occurred**, **Change did not occur**, or **Cannot determine**, with a required reason
and immutable audit event. Confirmed occurrence records the external result and continues only when output can be
validated. Confirmed absence permits retry. An indeterminate outcome cannot continue descendants or repeat the action;
Agency requires cancellation or a new run after manual provider cleanup.

## 4. Node model

Every node type is registered through a versioned definition rather than added directly to one growing discriminated
union:

```ts
type NodeTypeDefinition = {
  kind: string
  version: number
  category: "trigger" | "data" | "ai" | "action" | "logic" | "terminal"
  configSchema: JsonSchema
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  errorSchema: JsonSchema
  capabilities: string[]
  executionClass: "control" | "provider" | "model" | "workspace"
}
```

- `configSchema` controls author-time configuration.
- `inputSchema` defines the runtime values and references the node accepts.
- `outputSchema` defines successful output.
- `errorSchema` defines classified failure output.
- `executionClass` determines whether the node runs in-process, calls a provider, invokes OpenRouter, or provisions an
  isolated workspace.

Published versions snapshot the node definition version and schemas used for validation. A later registry update cannot
change an existing run.

### 4.1 Trigger nodes

| Node                   | Key configuration                                                     | Principal output                        |
| ---------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| Manual run             | JSON-schema input form                                                 | Validated workflow input                |
| Schedule               | Interval or CRON, timezone, overlap and misfire policy, stored input   | Schedule fire and validated input       |
| Provider event         | Connection, resource, event key, deterministic filters, input mapping | Normalized event and resource refs      |
| Child workflow event   | Invoking workflow/version policy and accepted schema                   | Parent run and invocation input         |

Provider webhooks are integration-specific at ingress but normalized before trigger matching. Trigger nodes never
receive raw credentials or unbounded raw webhook bodies.

### 4.2 Data nodes

Repository-capability nodes include repository metadata, file content, repository search, commit details, pull request,
pull request files, checks, reviews, and comments. Task-capability nodes include task, task query, comments, team,
project, and workflow-state metadata.

General data nodes include:

- Set fields from constants or mapped inputs.
- Map and rename fields without arbitrary code.
- Compose Markdown or text from typed template inputs.
- Validate a value against JSON Schema.
- Collect parallel outputs into an ordered array or keyed object.

Data reads return bounded provider-neutral records plus typed external resource references. Large bodies become
artifacts.

### 4.3 Repository-agent node

The repository-agent node executes one discovered `.agent.md` definition in an isolated workspace. Its configuration
contains the agent source reference, instructions specific to this workflow step, input schema, expected output schema,
workspace policy, tools, budgets, validation commands, and artifact hydration policy.

Standard outputs include status, summary, resulting commit, changed files, validation evidence, workspace reference,
usage, and artifact references. Agent-authored structured output is validated before downstream nodes can resolve it.

Agents do not directly invoke one another. They receive only their mapped inputs and immutable run context and return a
validated output patch.

### 4.4 AI model node

The AI model node handles analysis, extraction, summarization, classification, drafting, and structured judgment that
does not require a repository workspace.

#### Model catalog

Agency queries and caches the OpenRouter model catalog, including stable model ID, display name, context limits,
pricing, architecture, and advertised supported parameters. The initial model picker supports search and filters for
structured output, reasoning, and context size. Tool filters appear only after model-tool binding is released. A
published node stores the exact model ID, not only a display name.

Publication rejects a model configuration whose required features are no longer advertised. Run records retain the
requested model, resolved provider/model, catalog observation time, and exact effective parameter snapshot.

#### Prompt construction

The node supports ordered system, developer where supported, and user message blocks. Authors insert values with a
schema-aware variable picker rather than typing unchecked object paths. Each token identifies a declared node input,
workflow input, constant, trigger field, or artifact hydration request.

The editor provides:

- A message and prompt builder.
- A searchable variable picker.
- Input and artifact chips with type information.
- A rendered prompt preview using safe sample values.
- Token estimates and context-limit warnings.
- Markdown preview for Markdown message blocks.

Artifact inputs declare one hydration mode: metadata only, bounded excerpt, full text under a configured limit, or a
named attachment when the selected model supports it. Truncation is explicit and recorded.

#### Parameters

The step editor has Guided and Advanced sections over one configuration. Guided shows model, messages, response length,
output format, and safe recommended defaults. Advanced exposes every applicable semantic parameter advertised by the
selected model:

- Temperature
- Top P, Top K, Min P, and Top A
- Frequency, presence, and repetition penalties
- Seed
- Maximum completion tokens
- Stop sequences
- Log probabilities and top log probabilities
- Reasoning configuration and reasoning effort
- Verbosity
- Web search options when supported and explicitly enabled

Unsupported settings are omitted or disabled with an explanation. Agency must not silently drop a requested parameter.
Provider-specific passthrough parameters require a typed catalog definition and cannot be entered as arbitrary JSON.
Provider routing is an organization policy or permissioned governance control rather than an ordinary authoring field.
Run evidence shows the requested model, resolved provider and model, effective parameters, and any policy decision without
exposing provider payloads or credentials.

Tool execution is a later capability. The initial model node has no tool controls and cannot mutate external systems.
When tool binding is released, Advanced adds tool choice and parallel-call controls only for explicitly selected
read-only workflow tools. Mutating tools require a separate security design.

#### Output modes

The node supports three output modes:

1. Text, emitted as a bounded string or text artifact.
2. Markdown, emitted as a Markdown artifact with an optional bounded summary value.
3. Structured JSON, emitted as a schema-validated JSON value.

Structured JSON stores an author-defined JSON Schema. Agency sends OpenRouter:

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "workflow_node_output",
      "strict": true,
      "schema": {}
    }
  },
  "provider": {
    "require_parameters": true
  }
}
```

Agency validates the completed response against the same schema again before committing node output. Provider success
is not sufficient. Invalid schema, unsupported structured output, refusal, empty output, truncation, local validation
failure, timeout, and provider failure are distinct classified outcomes. Invalid output never reaches downstream nodes.

Guided mode calls this **Structured output fields** and starts with a form-based object/array builder plus sample preview.
Advanced mode offers a reversible JSON Schema view. Switching views must not discard unsupported constructs silently;
the UI explains which fields require Advanced mode. The supported subset and validator must be explicit. Ajv is the
likely runtime validator for user-authored JSON Schema, but adding it requires the repository's normal dependency review
before implementation.

Usage records include input, cached input, reasoning, and output tokens when available, elapsed time, and provider cost.
Raw prompts and responses are sensitive evidence and follow retention and redaction policy.

### 4.5 Provider action nodes

GitHub repository actions initially include:

- Create or update pull request
- Add pull request comment
- Submit pull request review
- Request reviewers
- Add or remove labels
- Set check status
- Merge or close pull request

Linear task actions initially include:

- Update task fields
- Change status, priority, or assignee
- Add comment
- Add or remove labels
- Create task
- Link a pull request or run

Every action uses a stable logical effect key independent of attempt number and records request digest, provider
idempotency data, external resource identity, result, and provider-safe error. Effect state advances through
`prepared`, `dispatched`, `confirmed`, or `unknown`. An ambiguous timeout becomes `unknown`; Agency reconciles it before
retry and never repeats an unsupported mutation blindly. Action steps accept typed inputs rather than prompt prose.

### 4.6 Logic and control nodes

| Step            | Semantics                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------- |
| Condition       | One deterministic boolean expression over declared scalar inputs                                 |
| Switch          | One deterministic branch selected from typed cases plus an optional default                       |
| Exclusive merge | Accepts exactly one activated upstream branch and normalizes its result to one output contract     |
| Bounded loop    | Repeats one explicit subgraph while a condition is true and a maximum iteration count remains     |
| For each        | Dynamic fan-out over a bounded collection with configured concurrency                             |
| Join            | Waits over a sealed parallel cohort using explicit all, any, or quorum completion                 |
| Wait            | Durable delay or wait for one correlated provider event                                           |

Ordinary graph edges already provide static fan-out. A separate parallel-split node is unnecessary. Arbitrary cycles
remain invalid; only a bounded-loop construct may compile a cycle. Retry belongs to node execution policy rather than a
visible loop node.

For-each assigns a deterministic item key and stable source order to every activation. It defines maximum collection
size, concurrency, per-item timeout, and one of fail-fast, continue-with-error, or stop-after-threshold behavior. Results
retain item correspondence even when one item fails.

A join seals its expected activation cohort before accepting completion. Its policy defines whether branch errors count
toward completion, how partial results are represented, whether unfinished branches are cancelled after `any` or quorum,
and how late completion is recorded without changing the selected join output. Exclusive merge is distinct: publication
proves that at most one of its incoming branches can be active for one scope.

A bounded loop declares initial accumulator and item schemas, whether its condition is evaluated before or after the
body, maximum iterations, maximum total activations, and the terminal outcome when the bound is exhausted. Each
iteration receives a new activation scope. Retry creates another attempt in the same activation and never consumes a
loop iteration.

Wait steps persist an explicit correlation identity, accepted event schema, expiry, and deterministic timeout-versus-
event race rule. One event wins and resumes the run exactly once. Approval remains deferred and absent from production
until the same durable wait semantics plus recipient authorization, decision schema, evidence, feedback, escalation,
and responder audit are complete.

Terminal nodes record Success, Failure, Cancelled, or Abandoned outcomes. Every reachable branch must end in a terminal
node or rejoin a path that does.

### 4.7 Failure routing

Every executable step has a typed failure outcome backed by its `errorSchema`. Authors choose one deterministic policy:

- Stop the run with a mapped terminal failure.
- Retry under the step's bounded policy, then stop or route the final error.
- Route the final error through a named failure connection to a compatible fallback step.

The failure connection maps classified error fields into the fallback input using the same typed mapping rules as
success. A fallback cannot observe partial uncommitted output. Publication rejects a failure cycle, an incompatible error
mapping, a route that can bypass an unresolved unknown external effect, or a fallback whose own terminal behavior is
ambiguous. Compensation is an explicit provider action with its own effect identity, not an automatic rollback claim.

## 5. Typed ports and edge mappings

Steps expose named inputs and outputs backed by JSON Schema. Connections join compatible handles and contain explicit
field mappings:

```ts
type WorkflowEdge = {
  id: string
  sourceNodeId: string
  sourcePort: string
  targetNodeId: string
  targetPort: string
  outcome?: string
  mappings: Array<{
    sourcePath: string
    targetPath: string
    transform?: MappingTransform
  }>
}
```

The connection editor says **Use data from** and presents step names, output labels, destination fields, type information,
and safe sample values. It suggests exact-name and compatible-type mappings, marks required destination fields, explains
why unavailable data cannot be selected, and previews the projected input. Internal step IDs, JSON paths, and schema
trees appear only in Advanced diagnostics. Initial transforms are deterministic and bounded:

- Rename or select field
- Constant or default
- String template
- Scalar comparison
- Boolean composition
- Null coalescing
- Array item projection

There is no arbitrary expression evaluator. Publication rejects incompatible ports, missing required mappings,
references to non-ancestor output, ambiguous fan-in, and inaccessible branch output.

## 6. Runtime context and variables

### 6.1 Authoring references

The authoring UI exposes a searchable **Use data from** picker organized by Workflow inputs, Trigger, Resources,
Previous steps, Current loop item, Run information, and Constants. It shows only data available on the current path.
Internal compilation uses these read-only namespaces:

- `inputs.*`: immutable workflow input.
- `trigger.*`: normalized triggering event.
- `resources.*`: published resource bindings and the primary repository.
- `nodes.<nodeId>.outputs.*`: immutable selected-attempt output from an ancestor.
- `loop.item`, `loop.index`, and `loop.accumulator`: values scoped to a loop body.
- `run.*`: immutable run ID, workflow version, timestamps, and correlation metadata.
- `constants.*`: non-secret values snapshotted with the published version.
- `secrets.*`: opaque capability handles available only to authorized executors.

Raw namespaces are not the default customer vocabulary. The compiler resolves each selected reference into the step's
declared input projection. A step cannot read the entire graph state or mutate another step's output.

### 6.2 Persisted datum model

Every persisted input or output is one discriminated datum with schema identity and provenance:

```ts
type PersistedDatum =
  | { kind: "value"; schemaId: string; value: CanonicalJson }
  | { kind: "artifact"; schemaId: string; reference: ArtifactRef }
  | { kind: "external-resource"; schemaId: string; reference: ExternalResourceRef }
  | { kind: "observation"; schemaId: string; reference: ArtifactRef; observedAt: string }
  | { kind: "secret-capability"; schemaId: string; capabilityId: string }
```

- Values are immutable canonical JSON.
- Artifacts are immutable byte objects addressed by Agency references.
- External resource references identify mutable provider entities.
- Observations preserve immutable evidence of provider state seen by one attempt.
- Secret capabilities are opaque handles resolved only inside an authorized attempt. Secret values never enter the run
  journal, fixtures, templates, logs, or artifacts.

Workspace and provider lifecycle handles are operational references, not reproducible business values.

### 6.3 Inline values

Small JSON-compatible values remain in checkpointed state. Initial limits should be explicit, such as 64 KB serialized
output per node attempt and bounded collection lengths. Values include IDs, statuses, decisions, summaries, counters,
booleans, and compact structured results.

### 6.4 Artifacts

Large or file-like output is stored outside graph state and represented by an immutable reference:

```ts
type ArtifactRef = {
  artifactId: string
  kind: string
  mediaType: string
  sha256: string
  byteLength: number
  producerActivationId: string
  producerAttemptId: string
  classification: "internal" | "sensitive"
}
```

Artifacts include Markdown reports, plans, reviews, patches, diffs, logs, command output, validation reports, file
bundles, model output, and agent context bundles. Storage URIs and filesystem paths do not become workflow variables.
The API authorizes bounded previews and short-lived downloads by artifact ID.

Artifact bytes are staged before an attempt commit. Their references become visible atomically with the selected output;
uncommitted uploads are quarantined and garbage-collected after the recovery window.

### 6.5 External resources

Mutable provider entities use typed references such as `RepositoryRef`, `TaskRef`, `PullRequestRef`, and `CommitRef`.
When reproducibility matters, a node also records the immutable provider response snapshot or evidence artifact observed
at execution time.

Every value, artifact, observation, and resource retains provenance: run, activation, attempt, source, digest where
applicable, and creation time.

## 7. Repository-agent discovery and snapshots

After a repository is bound, Agency searches `.github/**/*.agent.md` at the selected repository ref. Discovery is
paginated, bounded, cached, and refreshable. It parses the supported frontmatter subset and returns:

```ts
type RepositoryAgentReference = {
  connectionId: string
  repositoryId: string
  repositoryName: string
  ref: string
  path: string
  observedCommitSha: string
  blobSha: string
  contentDigest: string
  sourceUrl: string
  name: string
  description: string
  requestedModel?: string
  requestedTools: string[]
}
```

The step stores the reference, not an editable copy. The editor has explicit loading, empty, stale, inaccessible, and
changed-source states and shows name, description, path, observed commit, and refresh state. **Open in GitHub** opens the
provider source URL. A Markdown preview uses Agency's renderer but does not replace the provider link.

Publication resolves and validates every referenced agent, applies the effective tool and model policy, and stores a
content-addressed approved snapshot in the executable package. A source change after publication makes the draft stale
but never mutates that package. The author may review the change and publish a new workflow version.

When a run starts, Agency:

1. Resolves the exact repository base commit for that run.
2. Loads each publication-approved content snapshot by digest.
3. Verifies the run's repository access and records whether the current source still matches the approved content.
4. Seals immutable run-level snapshots with content, source commit, blob SHA, digest, parser version, and effective
  tool/model policy in the run manifest.
5. Fails run preparation before any step executes if approved content is unavailable or incompatible. A moved, deleted,
  or changed current source is reported but does not silently replace approved content.

All agent nodes, retries, and repairs in the run use these snapshots. This prevents agents in one run from observing
different definitions. Run details provide **Open in GitHub**, **Current repository version**, **Version used for this
run**, and **Compare versions**. Historical diagnostics remain available even if the current source disappears.

## 8. Markdown rendering

The web app needs one shared Markdown renderer for:

- Repository-agent definitions and snapshots
- Agent and model Markdown output
- Plans, reviews, summaries, and context artifacts
- Prompt previews
- Provider descriptions and comments where Markdown is supported

Use `react-markdown` from the preferred stack, with an explicitly reviewed GitHub-flavored Markdown extension if
needed. Raw HTML is disabled. Links receive safe protocol handling and external-link behavior; images and remote
resources are disabled by default; code blocks, tables, headings, lists, task lists, and quotes have consistent Fluent
styling. Large documents render through bounded artifact previews rather than loading unbounded content.

The renderer supports source and rendered views, copy, open reference, download where authorized, loading, truncation,
unsupported media, and redacted states. It is a reusable component, not node-specific rendering code.

## 9. Persistence and immutable execution

PostgreSQL stores the authoritative append-only facts and selected current state. LangGraph scheduling and checkpoints
are projections over these records, not a second source of product truth.

| Record             | Required semantics                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Workflow definition | Stable identity, mutable draft, optimistic revision, current published version, and archive state          |
| Execution package  | Content-addressed immutable graph, schemas, mappings, executors, compiler, agents, constants, and digest   |
| Run                | Package digest, sealed manifest, trigger identity, status, cancellation generation, and latest sequence    |
| Activation         | One logical execution of a step in a branch, item, or loop scope, with dependencies and selected attempt   |
| Attempt            | Activation-local ordinal, lease and fencing token, validated input/output, state, usage, and evidence      |
| Datum              | Canonical value, artifact, external reference, immutable observation, or opaque secret capability          |
| Effect             | Stable logical mutation identity, request digest, idempotency data, provider result, and reconciliation    |
| Wait               | Correlation, accepted input schema, authorization where applicable, expiry, claim, and winning resume event |
| Run event          | Monotonic per-run sequence, versioned payload, causation, activation/attempt identity, and transaction ID   |

### 9.1 Runs, activations, and attempts

A run advances through `preparing`, `runnable`, `running`, `waiting`, and one terminal state: `succeeded`, `failed`,
`cancelled`, or `abandoned`. Preparation must finish before any activation is runnable.

One workflow step may produce many activations. A deterministic activation identity includes the run, step, scope path,
branch, loop iteration, and for-each item key. Reconciliation can therefore derive the same activation without creating a
duplicate. An activation advances through `blocked`, `ready`, `leased`, `running`, `waiting`, and one terminal state.

Attempts belong to one activation and have immutable ordinals. A worker lease includes an expiry and monotonically
increasing fencing token; a stale worker cannot commit after the lease is replaced. Attempt states are `queued`,
`running`, `waiting`, `succeeded`, `failed`, `cancelled`, or `unknown`.

A successful completion selects one attempt exactly once. Its output and downstream input bindings are immutable.
Retries create attempts for the same activation; they do not replace consumed output, consume a loop iteration, or erase
prior evidence. The initial product does not permit retrying a successful activation after a descendant starts. **Run
again** creates a new run when recomputation is required.

### 9.2 Commit and recovery protocol

An attempt completion is one logical commit that:

1. Verifies the active lease and fencing token.
2. Validates output and artifact digests against the pinned schemas.
3. Finalizes staged artifact references.
4. Marks the attempt terminal and selects its output when successful.
5. Creates or updates deterministic downstream activations and their pinned input bindings.
6. Appends versioned events using the next per-run sequence.
7. Advances the journal's scheduler/checkpoint cursor.

The PostgreSQL transaction is authoritative. The LangGraph checkpointer must participate in the same transaction through
the Agency adapter. If a future checkpointer cannot share that transaction, the journal records a pending cursor and no
affected activation becomes leasable until a reconciler confirms the matching checkpoint. Recovery compares journal,
checkpoint, leases, staged artifacts, and effects and repairs projections from journal facts; it never invents a
completion from checkpoint state alone.

### 9.3 Effects, events, and replay

A mutating step reserves an effect uniquely identified by `(runId, activationId, effectSlot)` before dispatch. Retries
consult the same logical effect record regardless of attempt number. Reusing that identity with a different request
digest enters a non-dispatchable `conflict` state and never overwrites or reconciles the original request. Confirmed
effects return the recorded result. Unknown effects block automatic retry until a provider-specific read or
reconciliation proves whether the mutation occurred. Proving absence returns the effect to a dispatchable prepared state
under the same digest. Providers without idempotency or a safe reconciliation read require explicit operator resolution.

Trigger deduplication uses `(provider, connectionId, deliveryIdentity, workflowVersion, triggerBindingId)`. The Nango
envelope identity is used when the provider has no native delivery ID; if neither exists, Agency derives and persists one
identity from the signed envelope metadata and canonical payload digest before matching triggers. The same identity with
a different payload digest is quarantined rather than treated as a normal retry. One normalized event may start one run
per matching trigger binding; duplicate delivery never starts a second run for the same binding.

Correlated wait delivery and timeout compete in one journal transaction. A normalized event may satisfy multiple waits
only when each has a distinct persisted correlation key and explicitly non-consuming subscription; the initial wait step
uses consuming semantics and atomically claims at most one matching wait per run. The losing event or timeout remains
evidence and cannot resume the activation.

Run events use a transactionally monotonic sequence and retain event type version, projection-reducer version, causation,
and correlation. Historical replay means rebuilding a projection from stored facts. It never invokes a provider, agent,
model, workspace, or effect. Old event decoders or explicit upcasters remain available; evidence is not rewritten into a
new meaning. Re-execution is a new run and may incur new cost or external effects.

## 10. Validation and compilation

Draft validation runs incrementally. Publication and run preparation have different authoritative responsibilities.

### 10.1 Publication

Publication canonicalizes and validates:

- Known step definitions, executor versions or digests, and configuration.
- The supported JSON Schema dialect and subset, local references, formats, null/default behavior, and canonical schema
  representation.
- Compatible inputs and outputs, complete required mappings, deterministic transforms, and path availability.
- Trigger reachability, terminal reachability, exclusive branch convergence, sealed join cohorts, and no arbitrary
  cycles.
- Bounded loop iterations, activation budgets, collection sizes, and concurrency.
- Capability and resource-reference types without embedding credentials.
- Repository-agent content, tools, effective policy, source reference, and content digest.
- Model ID, advertised feature support, every requested parameter, structured-output schema, prompt references, and
  context limits against a recorded catalog observation.
- Constants and templates without embedded secret values.

Publication compiles one canonical intermediate representation and stores a content-addressed execution package. The
package pins graph and trigger definitions, schemas, schema dialect, node executors, mapping-expression version, compiler
version, compiled-plan digest, agent snapshots, constants, resource references, and event decoder versions. Publishing
the same canonical content produces the same digest. Existing packages are never recompiled under current semantics.

### 10.2 Run preparation and execution

Run preparation:

1. Enforces trigger and request idempotency and validates manual, scheduled, or normalized event input.
2. Loads and verifies one published execution package and its compiled-plan digest.
3. Rechecks current authorization, connection health, scopes, referenced resource access, and required model features.
   Drift fails preparation or waits for repair; it never changes the package silently.
4. Resolves the repository base commit where needed and seals agent snapshots, trigger input, constants, resource
   identities, effective model policy, and non-secret runtime limits in the run manifest.
5. Creates initial activations and only then marks the run runnable.

Execution validates projected input, dynamic collection bounds, artifact hydration, output, artifact digests, and
provider responses against the pinned package. Each step receives only its declared input projection plus immutable run
context. Secret capabilities resolve per authorized attempt and are never checkpointed. Model response replay uses the
recorded response artifact; repeating inference creates a new billable attempt or run.

### 10.3 Child workflow contracts

Child workflow invocation pins one published child package and a content-addressed interface containing input, output,
and error schemas. Publication classifies a newer interface as compatible only when existing required inputs remain
accepted and existing promised outputs retain assignable meanings; adding required input, removing output, narrowing an
accepted value, or changing failure meaning is breaking. Caller impact preview lists every draft and published caller.

Published parents continue to invoke their pinned child version even when a newer child is published. A child version
referenced by a published parent cannot be deleted; retirement prevents new bindings but preserves execution and replay.
Updating a parent requires an explicit contract comparison and new parent publication. Child-run creation is a named
effect so retries cannot create duplicate children, and parent/child run links are immutable.

## 11. API surface

The target API needs these product boundaries in addition to existing workflow routes:

- List accessible repositories for a repository-capable connection.
- Create a blank workflow or one with initial resource bindings.
- Add, change, or remove a draft binding with an impact preview and optimistic revision.
- Discover and refresh repository agents for a workflow and ref.
- Resolve one agent reference and return bounded Markdown preview metadata.
- List OpenRouter models and supported parameters from the Agency model catalog.
- Validate a model-node schema and parameter configuration as part of workflow validation.
- Preview edge mappings and rendered prompts with bounded sample input.
- Create, update, and run named test fixtures without altering historical evidence.
- Publish and retrieve a content-addressed execution package.
- Test one step, run to one step, or test a saved draft under the simulation policy.
- Inspect activation attempts, effects, waits, ordered events, and retry impact.
- Read authorized run-level agent snapshots and artifact previews.

Clients use Agency IDs and capability contracts. They never receive Nango credentials, raw object-storage URIs, or the
OpenRouter API key.

## 12. Migration from the current prototype

| Current behavior                               | Target behavior                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Settings globally selects one repository/team  | Settings connects and discovers; steps and workflows bind resources at need      |
| Repository is nullable until publication       | Repository-free workflows are valid; dependent steps require explicit bindings   |
| One fixed delivery agent and one PR node        | Registry-driven graph supports multiple agents, model steps, and actions          |
| Node kinds are one hard-coded union             | Versioned step definitions provide schemas, inputs, outputs, and execution policy |
| Edges contain only source and target            | Connections map named typed outputs to inputs                                     |
| One persistent right inspector                 | A collapsed-by-default dock, dialogs, and outline share one editor model          |
| Fixed-role mutable graph state                  | Journaled runs, activations, immutable attempts, effects, waits, and events        |
| Artifacts are keyed by fixed role               | Artifacts are keyed by producer activation and attempt                            |
| Agent definitions are process constants         | Publication pins approved content; each run seals its exact snapshots             |
| Graph compilation occurs under current runtime  | Publication creates one pinned content-addressed execution package                |
| Direct inference is planner-specific            | AI model step provides OpenRouter inference and strict structured output           |
| No authoring simulation contract                | Named fixtures support safe step, path, and draft tests                            |

Existing immutable workflow versions and historical runs remain readable through their schema version. Migration must
not reinterpret an old version as the new graph model.

## 13. Implementation phases

Step availability follows one release contract:

| Phase | Newly executable step families                                                                 |
| ----- | ---------------------------------------------------------------------------------------------- |
| 2     | Manual trigger, Set fields, Map fields, Validate, Success, Failure, and their simulated tests   |
| 3     | Typed data handoff, artifacts, Collect, deterministic failure routes, and path tests            |
| 4     | Repository data and repository-agent steps                                                     |
| 5     | AI model and Structured judgment steps                                                         |
| 6     | Provider triggers, provider data, schedules, GitHub actions, and Linear actions                  |
| 7     | Condition, Switch, Exclusive merge, Join, For each, Bounded loop, Wait, and child workflow       |

Add step lists only families executable in the deployed phase. Documentation and intentional preview surfaces may show
later families, but production drafts cannot add or publish them. Fixture infrastructure ships in Phase 2; Test step and
Run to here become available per executor only when that family reaches its listed phase.

### Phase 1: execution contracts and resource ownership

1. Make the PostgreSQL run journal authoritative and add run, activation, attempt, datum, effect, wait, and event state
  machines.
2. Define fencing, logical commit, checkpoint coordination, replay, artifact staging, and effect reconciliation.
3. Add canonical schemas, versioned step definitions, typed inputs/outputs, mappings, compiler contracts, and execution
  packages.
4. Remove global resource selection from integration contracts and persistence.
5. Add capability-based resource inventory and contextual binding endpoints.

Exit gate: contract and persistence tests prove deterministic activation identity, atomic output visibility, stale-worker
rejection, unknown-effect blocking, event replay, and package digest stability. Connecting a service selects no resource,
and a repository-free workflow remains valid until a dependent step requires a binding.

### Phase 2: editor shell and authoring interactions

1. Add synchronized canvas and complete ordered-outline authoring surfaces.
2. Add searchable Add step, connector-initiated compatible insertion, and blank-workflow recommendations.
3. Add the collapsed-by-default dock, spatial selection toolbar with stable fallback, issue navigator, and staged dialogs.
4. Add customer-language mapping, keyboard editing, focus recovery, undo/redo, search, fit, and optional overview.
5. Add named fixtures, Test step, Run to here, and Test draft with simulation, redaction, budget, and mutation policy.

Exit gate: desktop and list-first mobile users can create, test, edit, map, and delete every graph object without raw
JSON or canvas dependence. Simulated results are visibly distinct from run evidence, and automated accessibility checks
cover both authoring views.

### Phase 3: typed handoff and artifacts

1. Persist workflow inputs, step schemas, mappings, constants, activation attempts, and discriminated datum references.
2. Compile input projections and validate output before the journal commit.
3. Add reusable artifact preview and Markdown renderer components.
4. Prove a two-step non-provider workflow survives process restart at every commit boundary with identical handoff and
  replayed projection.

Exit gate: downstream execution cannot access undeclared upstream state, and invalid output cannot pass an edge.

### Phase 4: repository agents

1. Implement recursive `.agent.md` discovery and caching.
2. Add agent picker, discovery recovery, Markdown preview, refresh, Open in GitHub, and version comparison.
3. Pin reviewed snapshots during publication and seal exact snapshots in the run manifest.
4. Execute multiple repository-agent steps from the same sealed run snapshots.

Exit gate: source changes after publication or run start do not alter existing execution packages or attempts, and run
details distinguish current repository content from the version used.

### Phase 5: AI model node

1. Add the OpenRouter model and supported-parameter catalog.
2. Add Guided and Advanced configuration, prompt builder, Use data from picker, Markdown preview, and context feedback.
3. Implement text, Markdown, and strict structured JSON output.
4. Add form-first output fields, reversible schema editing, local validation, usage/cost evidence, retries, timeout, and
  classified failures.

Exit gate: one model node returns validated JSON to a condition and one returns a Markdown artifact to a later agent,
without provisioning a workspace.

### Phase 6: provider nodes

1. Generate provider triggers, data nodes, and action nodes from capability catalogs.
2. Add step-level resource binding and normalized event mapping.
3. Add GitHub PR/review/comment and Linear task/comment/update vertical paths.
4. Add effect-ledger idempotency, ambiguous-outcome reconciliation, and safe mutating-step tests.

Exit gate: real GitHub and Linear data traverses the same typed port and artifact contracts as manual input.

### Phase 7: logic and orchestration

1. Add condition, switch, static fan-out, exclusive merge, and sealed joins.
2. Add bounded for-each and bounded-loop activation semantics and compilation.
3. Add version-pinned child workflow invocation, typed interfaces, linked parent/child runs, and durable waits.
4. Reserve contract metadata for later subgraph extraction but defer extraction UX until core authoring is proven.
5. Keep approval absent until its complete authorization, evidence, expiry, escalation, race, and audit contract is
  accepted.

Exit gate: an implementation, review, repair loop terminates deterministically at its configured bound and preserves all
attempt evidence.

### Phase 8: complete run experience

1. Project live and historical activations, attempts, effects, and waits onto the immutable graph and outline.
2. Add accessible event history, artifact and Markdown views, source/snapshot comparison, and model usage.
3. Add cancellation, Retry step, Retry from here, Resume, Run again, stale-stream recovery, effect previews, and
  terminal-state UX.

Exit gate: a user can diagnose every transition and handoff from persisted data after a browser or process restart.

## 14. Verification strategy

Each phase requires contract and persistence tests, focused web tests, then `pnpm verify`. Browser coverage includes
desktop, list-first mobile, keyboard-only and screen-reader-oriented outline operation, reduced motion, no horizontal
overflow, no control overlap, and automated accessibility checks.

High-risk scenarios include:

- Repository or agent removed or changed between draft, publication, and run preparation.
- Model removed or parameter support changed.
- Invalid or refused structured model output.
- Oversized values, artifacts, prompts, collections, and loop counts.
- Duplicate or digest-conflicting provider events and unknown mutation outcomes.
- Process restart before and after every attempt-completion commit operation.
- Stale worker completion after lease replacement.
- Fan-out branch failure, sealed cohort ordering, partial join completion, and late results.
- Loop-bound exhaustion and retry without iteration consumption.
- Fixtures copied from historical input without mutating historical evidence.
- Secret-like values entering prompts, logs, previews, or persisted evidence.
- Stale draft revisions, binding changes, and source-version conflicts.
- Replay under old event decoders without calling external systems.

No feature is complete from mocks alone. Repository discovery, OpenRouter structured output, GitHub actions, Linear
actions, restart recovery, and artifact retrieval each require a bounded real-service smoke proof before their phase is
accepted.

## 15. Expert review decision log

An independent data-pipeline review, competitor review, UX review, and unconstrained LLM judge reviewed this plan on
2026-07-19. The judge scored the pre-revision plan 62/100 against a 90-point implementation-readiness threshold. The
following contested defaults were adopted autonomously because the user was unavailable; they remain explicit product
choices that may be revisited without weakening the execution invariants:

| Decision             | Adopted default                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Repository binding   | Ask when a repository-dependent step or starter needs it                                         |
| Desktop settings     | Collapsible dock, closed by default, with dialogs on constrained layouts                         |
| Selection commands   | Adjacent to selection with a stable fallback for keyboard and constrained layouts                |
| Large-graph overview | Optional minimap, off by default; outline, search, fit, and issue navigation remain authoritative |
| Agent version        | Pin approved content at publication and seal exact snapshots in every run manifest               |
| Model controls       | Guided defaults; Advanced semantic parameters; routing governed outside ordinary authoring        |
| Approval             | Absent until the complete durable and authorization design is implemented                         |
| Mobile authoring     | Complete ordered list by default, canvas optional                                                 |
| Reusable workflows   | Typed, version-pinned invocation now; extract-selection UX later                                  |

The PostgreSQL journal authority, activation model, publication package, effect ledger, replay contract, accessible
non-canvas authoring, first-class testing, and distinct merge/join semantics were uncontested required corrections, not
product preferences.