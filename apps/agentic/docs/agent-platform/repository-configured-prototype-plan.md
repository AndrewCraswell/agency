# Repository-Configured Agent Workflow Prototype: Implementation Plan

Status: Superseded; retained for historical context only

Last reviewed: 2026-07-19

> **Superseded direction:** Do not implement repository-owned workflow JSON from this plan. The current direction stores
> workflow drafts and immutable published versions in PostgreSQL, executes them through LangGraph, treats GitHub and
> Linear as provider integrations, and uses Nango only for authentication and credential lifecycle. See the
> [integration-driven workflow platform implementation plan](integration-workflow-platform-plan.md).

## 1. Why this plan exists

The current prototype has useful provider adapters and unit-tested components, but it does not prove the product's core
workflow. It also encodes one repository, one Linear team, and fixed scrum-master, engineer, reviewer, and repairer
roles throughout contracts, orchestration, persistence, webhook routing, and the dashboard. The Azure design
operationalizes those assumptions before multi-repository onboarding or one real autonomous delivery has been proven.

This plan resets the implementation around the actual product boundary:

> A GitHub repository supplies its agents, workflows, and GitHub webhook triggers. A local Agency process discovers and
> validates that configuration, matches authenticated events to workflows, executes referenced agents, and records
> inspectable evidence.

The plan deliberately proves that boundary locally before adding durable orchestration or cloud infrastructure.

## 2. Prototype outcome

At the end of this plan, two unrelated GitHub repositories can install the same GitHub App and independently define:

1. Agents in `.github/agents/*.agent.md`.
2. Workflows in `.github/agency/workflows/*.workflow.json`.
3. GitHub webhook triggers inside each workflow.
4. Ordered or dependency-based agent steps without platform-defined role names.

A single local Node.js process receives a signed GitHub webhook, loads configuration from the event's repository at an
immutable commit, selects the matching workflow, executes its steps through OpenHands and Daytona, and records the run,
step, workspace, commit, validation, and pull-request evidence.

The prototype is complete only after this path succeeds live in both repositories with different agent and workflow
definitions.

## 3. Scope

### 3.1 In scope

- GitHub App installation tokens and signed GitHub webhooks.
- Repository discovery from webhook payloads rather than repository environment variables.
- Repository-owned `*.agent.md` and `*.workflow.json` configuration.
- A documented, intentionally limited compatibility layer for VS Code custom-agent files.
- Generic workflow steps and dependency ordering.
- One local process and local file-backed run evidence.
- OpenHands as the initial agent runtime and Daytona as the initial isolated workspace provider.
- Exact commit checkout, path policy, independent validation, and optional branch/pull-request publication.
- A configuration validation CLI and actionable onboarding errors.
- A generic run view that reports workflow and step identifiers rather than fixed roles.
- Real end-to-end acceptance runs against two repositories.

### 3.2 Out of scope

- Azure deployment or Azure-managed services.
- PostgreSQL, Key Vault, Blob Storage, ACR, private networking, managed identities, or Container Apps.
- LangGraph and distributed workers.
- Linear task discovery or a scheduled scrum-master process.
- Fixed scrum-master, engineer, reviewer, or repairer roles.
- Full compatibility with every VS Code custom-agent feature.
- Arbitrary MCP servers, agent handoffs, hooks, or nested subagents in the first prototype.
- Multi-provider webhooks, organization billing, quotas, or a public control plane.
- Automatic merge. The prototype may publish a draft pull request but must not merge it.

## 4. Product and design principles

1. **Repository configuration is the product API.** Agent names, roles, workflow shape, and triggers must not be
   compiled into Agency.
2. **Prove execution before durability.** Local files and one process are sufficient until a real workflow succeeds.
3. **Configuration is data, not trusted instructions.** Every file is parsed, schema-validated, path-confined, and
   content-digested before execution.
4. **Event matching is deterministic.** Models do not decide whether a webhook triggers a workflow.
5. **Agent execution is replaceable.** Workflow orchestration invokes an `AgentRuntime` contract; OpenHands is one
   adapter, not the workflow model.
6. **Provider identities come from the event.** Repository and installation identifiers are resolved per delivery.
7. **Evidence precedes claims.** A source-complete or unit-tested path is not described as working end to end.
8. **Cloud is a later deployment choice.** No cloud resource is justified until the local product boundary is proven.

## 5. Repository onboarding contract

An onboarded repository contains this structure:

```text
.github/
|-- agents/
|   |-- implement.agent.md
|   `-- review.agent.md
`-- agency/
    `-- workflows/
        `-- issue-delivery.workflow.json
```

Agency loads configuration from the exact repository commit selected for the event. Configuration paths are fixed in
version 1 to make discovery predictable and prevent arbitrary file reads.

### 5.1 Agent files

The prototype consumes VS Code-style `.github/agents/*.agent.md` files as an input format. The Markdown body becomes the
agent's system instructions. Agency supports this frontmatter subset:

| Field            | Prototype behavior                                                          |
| ---------------- | --------------------------------------------------------------------------- |
| `name`           | Optional display name; filename is the fallback.                            |
| `description`    | Required human-readable purpose.                                            |
| `model`          | Optional model preference translated through the configured model provider. |
| `tools`          | Optional aliases translated to Agency runtime capabilities.                 |
| `user-invocable` | Accepted as metadata; it does not affect workflow execution.                |
| `argument-hint`  | Accepted as metadata; it does not affect workflow execution.                |

Initially supported tool aliases are `read`, `search`, `edit`, and `execute`. Unknown aliases and provider-specific tool
names fail configuration validation. The first prototype rejects `agents`, `handoffs`, `hooks`, MCP tool references, and
subagent delegation with an explicit unsupported-feature error.

This is format compatibility, not a claim that OpenHands reproduces the VS Code agent runtime. The validator must print
the compatibility limitations before a live run.

### 5.2 Workflow files

Each `*.workflow.json` file uses a versioned JSON schema with these concepts:

```json
{
  "schemaVersion": "1",
  "id": "issue-delivery",
  "name": "Issue delivery",
  "triggers": [
    {
      "provider": "github",
      "event": "issues",
      "actions": ["labeled"],
      "filters": [{ "path": "label.name", "equals": "agent-ready" }]
    }
  ],
  "steps": [
    {
      "id": "implement",
      "agent": ".github/agents/implement.agent.md",
      "needs": [],
      "workspace": "new",
      "instructions": "Implement the bounded request represented by the triggering issue.",
      "publish": "draft-pull-request"
    },
    {
      "id": "review",
      "agent": ".github/agents/review.agent.md",
      "needs": ["implement"],
      "workspace": "new",
      "instructions": "Review the candidate produced by the implement step.",
      "publish": "none"
    }
  ]
}
```

Version 1 supports:

- GitHub event names and an optional action allowlist.
- Equality filters over an explicit allowlist of scalar webhook fields.
- Step IDs, agent file references, dependencies, workspace mode, bounded step instructions, and publication mode.
- A directed acyclic step graph. Independent ready steps may remain sequential in the first implementation.
- Standard step inputs supplied by Agency: normalized trigger data, repository identity, exact base SHA, dependency
  results, and immutable artifact references.
- Standard step results: status, summary, workspace reference, base/resulting SHA, changed files, validation evidence,
  publication evidence, and typed failure.

Version 1 does not support arbitrary expressions, JavaScript, secrets in configuration, dynamic agent generation,
unbounded prompt templates, loops, or model-decided routing.

## 6. Runtime boundaries

### 6.1 Configuration loader

The loader receives repository owner, name, installation ID, and immutable commit SHA. It fetches only the fixed config
directories, parses all files, verifies references, rejects traversal, computes content digests, and returns an
immutable `RepositoryConfiguration`.

The loader validates:

- Unique workflow and step IDs.
- Existing agent references confined to `.github/agents/`.
- Supported agent frontmatter fields and tool aliases.
- At least one trigger and one step per workflow.
- Existing dependencies and an acyclic step graph.
- Supported webhook filter paths and scalar values.
- No secret-like fields or inline credentials.

### 6.2 Trigger matcher

The trigger matcher accepts a normalized GitHub event and a validated repository configuration. It returns zero or more
workflow IDs using only event name, action, and declared filters. Matching is pure and exhaustively fixture-tested.

One webhook delivery and workflow ID form the idempotency key. Redelivery must not start a duplicate run.

### 6.3 Workflow executor

The executor owns generic run and step state:

```text
queued -> running -> completed
                  -> blocked
                  -> failed
                  -> cancelled
```

It topologically selects ready steps, constructs a standard `AgentInvocation`, invokes `AgentRuntime`, validates the
returned `AgentStepResult`, persists evidence, and unblocks dependent steps. It knows no role names and contains no
scrum-master, engineer, review, or repair branches.

### 6.4 Agent runtime

```ts
interface AgentRuntime {
  execute(invocation: AgentInvocation): Promise<AgentStepResult>
}
```

The OpenHands adapter translates validated agent instructions, supported capabilities, model preference, workflow step
instructions, and immutable context into an OpenHands conversation. Workflow code does not import OpenHands profiles or
role-specific prompts.

### 6.5 Workspace provider

The existing Daytona adapter may be retained behind a generic workspace contract if its live behavior is re-proven. The
workflow determines whether a step receives a new workspace or a dependency's retained workspace. The platform does not
infer workspace policy from an agent name.

### 6.6 Local evidence store

The prototype writes one append-only directory per run under an ignored local data root. It stores the validated config
digest, normalized trigger, run state, step state, agent outputs, Git evidence, validation logs, and publication result.
Atomic file replacement is sufficient. PostgreSQL is not part of the prototype.

## 7. Current implementation disposition

The existing code is a reference and source of reusable adapters, not the approved product architecture.

| Current area                                             | Disposition                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| GitHub signature verification and installation auth      | Retain after focused tests.                                                |
| GitHub branch and draft pull-request operations          | Retain behind a generic publication port.                                  |
| Daytona workspace adapter                                | Retain only after a fresh live smoke test.                                 |
| OpenHands HTTP client                                    | Retain behind `AgentRuntime`; remove fixed coder/reviewer profiles.        |
| Exact-SHA checkout, path policy, and validation evidence | Retain as generic execution policy.                                        |
| Fixed agent enum and agent array                         | Replace with repository-loaded agent definitions.                          |
| Role-specific prompts and result contracts               | Replace with generic invocation/result contracts.                          |
| Fixed LangGraph delivery graph                           | Remove from the prototype execution path.                                  |
| Linear client and 30-minute scrum-master scheduler       | Remove from the prototype execution path.                                  |
| PostgreSQL persistence and migrations                    | Defer; do not require for local execution.                                 |
| Azure adapters and Bicep                                 | Archive or remove from the prototype after this checkpoint; do not deploy. |
| Fixed-role dashboard                                     | Adapt only after generic runs exist; do not drive backend design from it.  |

## 8. Implementation sequence

Each phase ends in executable evidence. Work does not proceed when the current phase's exit gate fails.

### Phase 0: Preserve and reduce

1. Tag the current source as an experimental checkpoint.
2. Mark Azure deployment documents and source as unvalidated and inactive.
3. Remove Azure, PostgreSQL, LangGraph, Linear scheduling, and fixed-role code from the prototype startup path.
4. Keep only provider adapters with direct value to the new vertical slice.
5. Add one command that starts the local prototype without cloud or database prerequisites.

Exit gate: the local process starts with GitHub, Daytona, and model credentials only, and no Azure, PostgreSQL, Linear,
or fixed repository environment variables.

### Phase 1: Repository configuration contracts

1. Define strict Zod schemas for repository configuration, workflow triggers, workflow steps, agent metadata, generic
   invocation, and generic result.
2. Select a maintained YAML/frontmatter parser with explicit human approval before adding it.
3. Implement `.agent.md` parsing and the documented compatibility checks.
4. Implement `*.workflow.json` parsing, reference validation, and cycle detection.
5. Add a `validate-config` CLI with file-specific diagnostics and nonzero exit status.
6. Build two fixture repositories with different agent names, tools, triggers, and step graphs.

Exit gate: both fixtures validate, and malformed paths, unsupported features, duplicate IDs, missing agents, unsupported
filters, and cyclic dependencies fail with actionable messages.

### Phase 2: Generic GitHub trigger routing

1. Keep raw-byte signature verification and normalize only the GitHub fields required by trigger matching.
2. Resolve installation and repository identity from each webhook.
3. Resolve the repository default branch and immutable configuration SHA through the GitHub App.
4. Load and digest repository configuration at that SHA.
5. Match triggers deterministically and generate idempotent run IDs.
6. Add a dry-run endpoint or CLI that reports matched workflows without invoking an agent.

Exit gate: signed fixtures for both repositories select their own workflow, unsupported events select none, invalid
signatures load no repository data, and duplicate deliveries produce one run identity.

### Phase 3: Generic single-step execution

1. Define `AgentRuntime`, `WorkspaceProvider`, `RunStore`, and `Publisher` ports.
2. Adapt OpenHands without role-specific profile functions or prompt paths.
3. Adapt Daytona using repository identity from the invocation.
4. Execute one workflow step from either fixture repository.
5. Enforce exact-SHA checkout, supported tool capabilities, path policy, budgets, and independent validation.
6. Store a complete local run record and return a generic step result.

Exit gate: one real no-op step and one deterministic edit step complete in Daytona, with independently captured evidence
and no platform-defined agent role.

### Phase 4: Multi-step workflow execution

1. Implement topological step scheduling and dependency result propagation.
2. Implement `new` and retained workspace modes.
3. Stop downstream steps after failed or blocked dependencies.
4. Allow draft pull-request publication only when declared by the step.
5. Ensure every step is correlated with the workflow, trigger delivery, config digest, workspace, and exact SHA.

Exit gate: a two-step workflow runs an implementation agent and a separately defined review agent from repository
configuration. Changing their filenames or IDs requires no Agency source change.

### Phase 5: Two-repository live proof

1. Install the same GitHub App on two repositories.
2. Give each repository different agent files and workflow JSON.
3. Deliver real GitHub webhook events to the local process through a documented development tunnel.
4. Complete one bounded workflow in each repository.
5. For at least one repository, produce a useful changed commit, pass independent validation, and publish a draft pull
   request.
6. Record all manual intervention, failures, duration, model use, and provider cost.

Exit gate: retained evidence proves webhook -> config load -> trigger match -> agent execution -> validation -> draft PR
for one repository and webhook -> different config -> different workflow execution for the second. This is the first
point at which the prototype may be described as working.

### Phase 6: Generic operations view

1. Replace fixed agent roles and Linear task columns with repositories, workflows, runs, and generic step states.
2. Show the configuration SHA and agent file for each step.
3. Link only persisted runs to run details.
4. Show validation, workspace, commit, and pull-request evidence without inferring state from an external tracker.

Exit gate: the UI accurately renders the two live acceptance runs and never presents an external issue as an Agency run.

### Phase 7: Hosting decision

After Phase 5 and Phase 6 pass, write a separate deployment decision record based on measured needs. The default first
hosted shape is one containerized process and the minimum persistence required by observed restart behavior. Azure
PostgreSQL, private networking, separate process identities, scheduled jobs, and managed artifact storage each require a
specific demonstrated need; they are not inherited from the current experimental design.

## 9. Test strategy

- Schema tests for every accepted and rejected configuration boundary.
- Golden fixtures for two distinct repositories.
- Pure trigger-matching tests across supported GitHub event/action/filter combinations.
- Contract tests for each provider adapter.
- Failure injection for invalid signatures, missing config, unsupported agent features, unavailable commits, workspace
  startup failure, model failure, validation failure, and publication failure.
- Idempotency tests for repeated webhook deliveries and repeated executor starts.
- Live acceptance evidence kept separate from mocked test results.

The root `pnpm verify` gate remains required for a completed implementation change. Package-feed policy failures must be
reported rather than bypassed by changing the lockfile or policy.

## 10. Security constraints

1. Repository configuration, issue text, pull-request text, agent output, and repository files are untrusted input.
2. Secrets are environment-supplied to the local process and never written into repository config or agent context.
3. GitHub installation tokens are resolved per repository and scoped to the installation.
4. Agent and workflow paths cannot escape their fixed configuration directories.
5. Tool aliases map to platform-enforced capabilities; prose cannot grant a capability.
6. Validation and publication are deterministic platform steps, not agent self-attestation.
7. The prototype creates draft pull requests only and never merges.

## 11. Pause-point decisions

The following decisions are made for the first implementation:

- Run locally as one Node.js process.
- Use repository-owned `.github/agents/*.agent.md` files as agent instructions.
- Use `.github/agency/workflows/*.workflow.json` for workflow and trigger definitions.
- Support GitHub webhooks only.
- Use OpenHands and Daytona behind replaceable ports.
- Use local file evidence rather than PostgreSQL.
- Prove two repositories before revisiting Azure.

One dependency decision remains intentionally open: the YAML/frontmatter parser must be selected and approved before
Phase 1 implementation because it is not currently in the repository's preferred stack.

## 12. Definition of done

This implementation plan is complete when:

1. No repository, team, agent role, workflow topology, or trigger label is hardcoded in the execution path.
2. A repository can validate its configuration before installing or invoking the system.
3. Two repositories run different workflows from their own configuration through the same local Agency process.
4. At least one real workflow produces a validated draft pull request from a real GitHub webhook.
5. Every product claim links to retained provider and execution evidence.
6. Azure remains absent from the runtime and deployment plan until a separate post-proof decision approves it.
