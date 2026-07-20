# Agency UX design review

Date: July 20, 2026

Status: Consensus review

## Executive summary

Agency has the capabilities needed for an end-to-end workflow product, but the interface often exposes those capabilities
as separate technical surfaces instead of one dependable customer journey. The clearest product model is:

1. Connect the resources the workflow can use.
2. Create and configure a mutable draft.
3. Test and validate that draft.
4. Publish an immutable version.
5. Run an explicitly identified published version.
6. Understand the outcome and recover when the run fails.

The review found two release-critical UX problems. First, a failed run can also appear to have reached the Completed
stage, and two different run-detail models provide different diagnostic and recovery experiences under the same route.
Second, the editor presents Test draft, Validate, Publish, and Run as peer commands without making the draft and
published-version boundary clear. The remaining high-priority findings concern Operations scale, persistent authoring
feedback, responsive workflow topology, and intentional workflow creation.

## Review method

Three LLM-as-judge experts reviewed the same evidence independently:

- A user researcher focused on customer mental models, discoverability, task completion, recovery, and likely confusion
  in workflow editors and AI workflow tools.
- A senior interaction and visual designer focused on hierarchy, organization, responsive composition, accessibility,
  and Fluent UI patterns.
- A principal product designer focused on feature assembly, lifecycle integrity, operational safety, defaults, and a
  simple but powerful end-to-end product model.

The review used two rounds:

1. Each expert produced an independent, prioritized assessment and separated direct observation from inference.
2. Each expert challenged the combined candidate list, voted to keep, merge, defer, or reject each issue, and proposed
   the smallest coherent solution. The final priorities below reflect the reconciled vote rather than a raw union of
   findings.

The evidence set included source and test inspection plus browser interaction across these routes:

| Route | Surface reviewed | Interactions and states reviewed |
| --- | --- | --- |
| `/` | Operations | Metrics, active work, task cards, assignment flow, task volume, and blocked-task distribution |
| `/workflows` | Workflow list and creation | Workflow list, new-workflow dialog, default name, repository selection, and missing-prerequisite state |
| `/workflows/:id` | Workflow editor | Canvas and Outline, step catalog and search, details inspector, validation, testing, publishing and run eligibility, autosave, desktop layout, and 390 by 844 responsive layout |
| `/runs/:id` | Run detail | Failed status, delivery stages, workflow and route sections, event timeline, diagnostics, and available recovery actions |
| `/settings` | Integrations | Connection management, discovered-resource volume, refresh and disconnect actions, and naming consistency |
| `/about` | About | Route purpose, product relevance, and navigation placement |
| `/contact` | Contact | Form behavior, route purpose, and navigation placement |

The browser data represented a real high-volume state: 222 tasks, including 183 blocked tasks, and 21 discovered
repository resources. The workflow editor was reviewed with a validation failure and a separate failed test. The run
detail was reviewed in a failed state.

## Priority definitions

| Priority | Meaning |
| --- | --- |
| P0 | Contradicts product truth, risks running the wrong object, or prevents dependable recovery. Resolve before broader release. |
| P1 | Materially blocks a primary task at realistic scale or on a supported viewport. Resolve in the next product slice. |
| P2 | Adds recurring confusion, technical burden, or accessibility risk. Resolve after the core journey is coherent. |
| P3 | Cleanup that improves trust and product focus but does not block a primary workflow. |

## Consensus findings

| Issue | Priority | Area | Feature | Problem | Agreed solution |
| --- | --- | --- | --- | --- | --- |
| Canonical failed-run truth and recovery | P0 | Run detail | Status, progress, diagnostics, and recovery | A run can say Failed while the delivery stage reaches Completed. The same route also switches between two run-detail models with different concepts and actions. Operators do not get one trustworthy answer to what happened, where it failed, and what to do next. | Define one customer-facing run contract and shared page shell across backend models. Lead with outcome, failed step, plain-language cause, downstream effect, and the safest eligible action. Mark later stages as not reached, and move event journals and implementation evidence under Diagnostics. Detect legacy runs explicitly instead of treating any journal request failure as a type signal. |
| Explicit draft and published-version lifecycle | P0 | Workflow editor | Test, validate, publish, and run | Test draft, Validate, Publish, and Run compete as peer actions. Disabled Run has no visible explanation, and version badges do not state which version will execute. An invalid draft can coexist with published history without a clear active-version model. | Model and display `draftRevision` and `activePublishedVersion` independently. Show "Editing draft" and "Published version 3" as separate states. Use a labeled command toolbar with one contextual primary action, and label execution as "Run published version 3." Keep the last known-good published version available while a new draft is edited unless it was explicitly deactivated. |
| Scalable Operations information architecture | P1 | Operations | Work queue and active runs | The page renders 222 full task cards, including 183 blocked tasks, with no search, filter, sort, saved view, or compact comparison mode. Metrics, active execution, and backlog triage compete on one continuous page. The "Active agents" label appears to count active runs rather than distinct agents. | Separate Overview, Runs, and Work queue as shareable views. Make a compact list or DataGrid the default queue based on whether column comparison is required. Add search, status, repository, assignee, priority, and age controls with URL-persisted state. Default to actionable exceptions, retain a board only as an optional low-volume view, and rename the metric to "Active runs" unless it truly counts unique agents. |
| Persistent revision-scoped authoring results | P1 | Workflow editor | Validation and draft tests | Validation issues, failed tests, workflow details, selected-step properties, and simulation results accumulate in the same inspector. Toasts are transient, and results do not clearly state whether they still apply after the draft changes. | Keep the inspector contextual to workflow, step, or connection properties. Add persistent Problems and Test results panels with counts, status, and the draft revision tested. Mark results stale immediately after a relevant edit. Selecting a problem should focus the affected step, connection, and field. Use a MessageBar for a blocking summary, not as the entire issue list. |
| Responsive editor with preserved topology | P1 | Workflow editor | Mobile composition and Outline | At 390 by 844, desktop metadata and all lifecycle commands wrap into a tall header. Outline improves step scanning but omits branches and connections, so the mobile default removes the workflow structure users need to reason about. | Recompose rather than wrap the desktop layout. Use a compact identity row, an overflow command toolbar, and one task-focused content region. Make Outline topology-aware by showing trigger-to-outcome order, branch labels, incoming and outgoing connections, validation status, and focused editing. Preserve stable keyboard and screen-reader navigation between the outline, properties, problems, and test results. |
| Intentional workflow creation and binding | P1 | Workflows | New workflow dialog | The dialog begins with "Untitled workflow," silently selects the first repository, and enables Create immediately. Customers can create an ambiguously named workflow against the wrong repository. Customers without a repository are told to connect one but are not given a direct path. | Start with an empty required name and require deliberate repository confirmation. Explain that the repository controls available agents, data, and actions. Show owner and repository together, remember a prior choice only when it is explicit, and provide a direct "Connect repository" path to Integrations when the prerequisite is missing. |
| Task-oriented controls before raw configuration | P2 | Workflow editor | Step configuration and test input | Common tasks expose raw JSON, schemas, digests, revision numbers, and internal identifiers at the same level as routine fields. Invalid JSON can leave the last valid value in place without clear inline feedback. | Generate typed controls from step schemas for common configuration, mappings, conditions, and test input. Validate fields inline and preserve a clear invalid state while editing. Put raw JSON, digests, immutable IDs, and uncommon controls under an Advanced disclosure with copy, paste, and schema assistance. Keep an expert path without making it the default path. |
| Consistent integration language and resource disclosure | P2 | Settings and Integrations | Connections and discovered resources | Primary navigation says Settings while the page title says Integrations. A connection expands 21 repositories inline, making connection status and management actions difficult to scan. | Choose one product noun and use it in navigation, page title, links, and empty states. "Integrations" is the clearer current fit. Summarize each connection by provider, account, sync health, and resource count. Add search and progressive disclosure for resources, and explain connection scope and disconnect consequences near the action. |
| Accessible asynchronous status and disabled reasons | P2 | Cross-product | Saving, validation, tests, publishing, polling, and runs | Important state changes use a mix of badges, disabled controls, page changes, and toasts. A disabled Run control does not expose its requirement, and a tooltip alone would not be dependable because disabled controls may not receive keyboard focus. | Give each operation a visible pending state and prevent duplicate submission. Announce concise status changes through an appropriate live region. Put disabled reasons in persistent helper text or on a focusable wrapper, and use tooltips only as supplemental help. Keep blocking failures visible until resolved or dismissed. |
| Consequence and permission disclosure | P2 | Operations, workflows, runs, and integrations | Assign, publish, run, retry, cancel, resolve, and disconnect | Consequential actions do not visibly explain who can perform them, whether approval is required, what version or external resource is affected, or what will happen next. Backend authorization was not assessed, so missing enforcement is not established. | Show the target, consequence, and any approval or permission requirement before consequential actions. Explain disabled or rejected actions in customer language. Reserve confirmation dialogs for destructive or difficult-to-reverse effects; do not add confirmation to every routine action. Validate backend enforcement separately. |
| Focus product navigation | P3 | Routing and navigation | About and Contact | About and Contact are registered but absent from primary navigation and retain starter or demo purposes. They create unsupported routes and weaken confidence if discovered directly. | Remove the routes and dead dependencies unless each has an explicit product owner and customer job. If support contact is needed, place it deliberately in Help or Support with production content and clear navigation. |
| Durable schedule ownership | Release gate | Global shell and scheduling | Scheduled workflow runs | A browser component loads schedules and starts runs with `setInterval`. No missed or duplicate run was observed in the browser review, so this is not ranked as a demonstrated interaction defect. However, browser presence cannot provide a dependable unattended scheduling guarantee. | Complete an engineering release-gate review. Move schedule execution to a durable server-owned scheduler with persisted next-run state, leases, idempotency, catch-up policy, and health visibility. The UI should display server-reported schedule state and last and next run, not own execution. |

## Fluent component assessment

The Fluent Agent review supports the proposed direction with these constraints:

| Need | Recommended Fluent approach | Constraint |
| --- | --- | --- |
| Editor lifecycle commands | `Toolbar`, `ToolbarButton`, `ToolbarDivider`, `Overflow`, and an overflow `Menu` | A toolbar is appropriate for three or more related controls. Label every toolbar, preserve logical grouping in overflow, and maintain keyboard order. Do not make every command visually primary. |
| Blocking validation or failed-run summary | Persistent `MessageBar` near the affected surface | Include a concise summary and next action. Keep detailed problem lists and diagnostics in their own region. Move focus only when the action opens a new task context; otherwise announce the update. |
| Large Operations queue | Compact list or `DataGrid` with search, filter, and sort controls | Use `DataGrid` when customers compare or sort columns. Prefer a simpler list when the task is primarily scanning and opening one item. Preserve filter state and provide an explicit accessible name for the result count. |
| Problems and Test results | Labeled panels or tabs separate from the contextual inspector | Associate each tab with its panel, expose counts in accessible labels, preserve focus on selection, and announce refreshed or stale results. |
| Repository resources and technical configuration | Progressive disclosure using expandable sections and an Advanced region | Do not hide blocking status or required fields. Preserve headings, focus order, and state when a section expands or collapses. |
| Disabled actions | Visible helper text plus an optional `Tooltip` on a focusable trigger or wrapper | A tooltip alone is insufficient. The reason must be available to keyboard and screen-reader users without attempting to focus a disabled control. |

Using Fluent components does not make the composed experience accessible by itself. Browser acceptance must verify keyboard
order, focus return, accessible names, status announcements, high contrast, touch targets, and zoom through 400 percent.

## Content recommendations

The Microsoft Content Style Guide review favors concise, conversational language that leads with the customer outcome,
uses sentence-style capitalization, and avoids implementation terms when a familiar word works.

| Current or ambiguous copy | Recommended copy | Supporting text or condition |
| --- | --- | --- |
| `saved` | `All changes saved` | Announce once after a pending save. Use `Saving changes` while the request is active and `Changes could not be saved` with a retry action on failure. |
| `Test draft` | `Test draft` | Keep this label. Describe it as testing current unpublished changes with the supplied input and no production run. |
| `Validate` | `Check for issues` | Use when the action only checks readiness. Report `No issues found` or `3 issues to fix`. If the product keeps `Validate`, define it consistently and do not require customers to infer how it differs from Test. |
| `Publish` | `Publish version` | Before confirmation or execution, identify the draft revision and explain that publishing creates an immutable runnable version. |
| `Run` | `Run published version 3` | If unavailable, show `Publish a valid version before you run this workflow.` If an older version remains active, identify it rather than disabling the action because the current draft is invalid. |
| Unqualified validation or test result | `Results for draft revision 12` | After an edit, replace success styling with `Out of date. Test the current draft again.` |
| Generic failed-run status | `Run failed at Create pull request` | Follow with a plain-language cause and one next action, such as `Reconnect GitHub` or `Retry from this step`. |
| Navigation `Settings`, title `Integrations` | `Integrations` in both places | Use `Settings` only for a broader settings area that contains Integrations as a clearly labeled child page. |

## Recommended sequence

1. Establish one run-state contract and repair failed-run truth, summary, and recovery.
2. Separate mutable draft state from the active published version and make every run version-specific.
3. Split editor properties, Problems, and Test results; add revision freshness.
4. Recompose the editor for constrained viewports and add topology to Outline.
5. Make workflow creation intentional and provide the missing Integrations prerequisite path.
6. Replace the Operations card wall with an exception-focused, queryable queue.
7. Introduce schema-driven routine controls and progressively disclose technical configuration.
8. Align Integrations language and resource organization, then complete the async-status and consequence-disclosure audit.
9. Remove orphan routes and complete the durable-scheduling engineering release gate.

## Validation plan

The proposed fixes should be validated with realistic data and task-based acceptance, not only component snapshots:

- Failed-run recovery: give operators three failed runs and measure whether they identify the failed step, cause, and safe
  next action within 60 seconds.
- Version comprehension: ask customers to test current changes, publish them, and identify exactly which version Run will
  execute. Measure wrong-version selections and hesitation.
- Operations scale: test finding and assigning a named item and finding the highest-priority actionable item in datasets
  of 200 and 500 tasks.
- Workflow creation: test customers with 1, 5, and 20 repositories. Measure incorrect bindings, renamed defaults, and
  recovery when no repository is connected.
- Responsive authoring: complete add, connect, configure, resolve, test, and publish tasks at 390 by 844 and desktop
  widths using pointer, keyboard, and screen reader navigation.
- Accessibility: verify toolbar overflow, focus order and return, tab-panel relationships, live announcements, disabled
  reasons, high contrast, touch targets, and 400 percent zoom in the integrated browser.

## Decision record

The experts agreed to merge failed-run contradiction and dual run models because they are one customer problem: the
product lacks a single trustworthy run story. The user researcher initially ranked the observed run issue P1 because no
irreversible customer action was observed. The designer ranked it P0 because the interface presented contradictory
operational truth. The product designer ranked the combined run contract P0 because inconsistent truth also fragments
recovery. The consensus adopted P0 because an operator must be able to trust a terminal run status before the product can
safely scale autonomous work.

The scheduling issue remains a release gate rather than a ranked UX finding because the review observed browser-owned
timers but did not observe a missed or duplicate run. Authorization remains a scoped disclosure finding because the
frontend did not show roles or approvals, but this review did not establish whether backend enforcement is present.

## Engineering implementation backlog

This backlog describes implementation work rather than acceptance criteria. Task IDs are stable references for issues
and pull requests. Complete workstreams in dependency order; tasks within a workstream can run in parallel unless a
dependency is stated.

### Workstream 0: Stabilize the verification baseline

- [ ] **ENG-001 — Repair the web coverage harness.** Reproduce the missing
  `apps/web/coverage/.tmp/coverage-1.json` failure, remove stale coverage-process assumptions, and make parallel Vitest
  workers write and merge coverage artifacts deterministically. Add the coverage command to the focused web verification
  notes in repository memory or documentation.
- [ ] **ENG-002 — Complete API mock coverage for shell-owned requests.** Add handlers for
  `GET /api/workflows/schedules` and autosave `PATCH /api/workflows/:workflowId/draft` to the shared MSW server, then
  remove per-test request leakage from `WorkflowEditorPage.test.tsx` and other route tests.
- [ ] **ENG-003 — Restore the workflow-editor model test.** Isolate and fix the failing “authors catalog-backed model
  prompts” test before using editor tests as a regression gate for the lifecycle and panel refactors.

### Workstream 1: Create one run contract and recovery model

- [ ] **ENG-010 — Define a canonical run-detail contract.** Add a discriminated run-detail envelope under
  `apps/agentic/src/workflows/` with normalized outcome, current or failed step, stage states, workflow version, summary,
  available actions, and references to advanced evidence. Keep source-specific journal and legacy fields behind explicit
  variants instead of exposing two unrelated page models.
- [ ] **ENG-011 — Add explicit run-source resolution.** Add a server route for the canonical run resource and resolve the
  run source through an explicit lookup or typed not-found result. Do not use an arbitrary journal request failure as the
  signal to fall back to `GET /api/control-plane/runs/:runId`.
- [ ] **ENG-012 — Implement the legacy control-plane adapter.** Project legacy control-plane stage, workflow node, route,
  and event data into the canonical contract. Derive failed, completed, current, and not-reached stage states from both
  terminal status and recorded stage rather than stage index alone.
- [ ] **ENG-013 — Implement the journal-run adapter.** Project activations, waits, effects, retries, cancellation, and
  evidence into the same canonical contract and map journal capabilities to normalized available actions.
- [ ] **ENG-014 — Normalize failure summaries in the service layer.** Produce a customer-safe failed-step label, concise
  cause, downstream effect, timestamp, and recommended action from persisted run data. Preserve technical payloads in
  evidence fields rather than making the client infer a summary from events.
- [ ] **ENG-015 — Replace the web run API clients.** Replace `getWorkflowRunDetail` and
  `getJournalWorkflowRunDetail` probing in `apps/web/src/services/api.ts` with one schema-validated canonical run request.
  Retain source-specific mutation clients only where an available action requires them.
- [ ] **ENG-016 — Refactor `RunDetailPage` around a view model.** Remove the dual `detail` and `journalDetail` state paths,
  build one page shell for outcome, progress, recovery, inputs and outputs, and move journals, persisted payloads, and
  provider evidence into a Diagnostics disclosure.
- [ ] **ENG-017 — Add the failed-run action surface.** Render a persistent Fluent `MessageBar` containing failed step,
  cause, and the safest action supplied by the contract. Route retry, retry-from-here, reconnect, rerun, resume, and
  escalation actions through one busy-action controller.
- [ ] **ENG-018 — Add run-contract and page tests.** Cover adapter projections for failed, cancelled, waiting, running,
  and completed runs; verify that a failed run cannot mark later stages completed; and exercise each normalized recovery
  action in `RunDetailPage.test.tsx` and a browser-rendered story.

### Workstream 2: Separate draft state from the active published version

- [ ] **ENG-020 — Add an explicit active-version field.** Introduce `activePublishedVersion` in the workflow persistence
  model and API contracts instead of asking clients to infer runnable state from draft status or version history. Write a
  Drizzle migration that preserves the current active version and leaves draft revision state independent.
- [ ] **ENG-021 — Update workflow store operations.** Make publish atomically create an immutable version and set it
  active. Add explicit service operations for changing or deactivating the active version if the product supports those
  transitions; editing or failing validation must not clear the active version.
- [ ] **ENG-022 — Make run creation version-specific.** Require `POST /api/workflows/:workflowId/runs` to receive or
  resolve an explicit published version and seal that version into the run request. Reject stale or inactive version
  requests with a typed API error rather than racing against a mutable workflow projection.
- [ ] **ENG-023 — Version the workflow response schemas.** Update `WorkflowSummarySchema`, `WorkflowDraftViewSchema`, and
  their web Zod counterparts to expose draft revision, active published version, and published history as separate fields.
  Remove or migrate ambiguous `publishedVersion` consumers.
- [ ] **ENG-024 — Build an editor command toolbar.** Replace the free-form action row in `WorkflowEditorPage` with a
  labeled Fluent `Toolbar`, grouped editing status, test and issue checks, publish, and version-targeted run commands.
  Add overflow behavior for constrained widths and keep one state-dependent primary action.
- [ ] **ENG-025 — Implement lifecycle copy and disabled reasons.** Render “Editing draft,” “All changes saved,” “Publish
  version,” and “Run published version N” from contract state. Put unavailable-action reasons in persistent helper text or
  a focusable wrapper; use a tooltip only as supplemental content.
- [ ] **ENG-026 — Add lifecycle service and editor tests.** Cover editing while an older version remains active,
  publishing a new version, starting a selected version, deactivating a version if supported, stale run requests, toolbar
  overflow, keyboard order, and disabled-reason discoverability.

### Workstream 3: Separate properties, problems, and test results

- [ ] **ENG-030 — Stamp validation responses with draft revision.** Add `draftRevision` to the validation contract and
  return the revision read by the validator. Keep the existing simulation revision and align both response shapes around
  result freshness metadata.
- [ ] **ENG-031 — Model editor result state explicitly.** Replace loose `validation` and `simulation` state with typed
  result records containing request state, source revision, freshness, issue count, and selected result. Mark a completed
  result stale whenever an edit advances the local or saved draft revision.
- [ ] **ENG-032 — Extract the contextual properties inspector.** Move workflow, step, and connection configuration out of
  the monolithic `WorkflowEditorPage.tsx` into focused inspector components without validation or simulation sections.
- [ ] **ENG-033 — Add Problems and Test results panels.** Build persistent, labeled panels with counts and revision
  labels. Keep the issue collection in the panel, use `MessageBar` only for its blocking summary, and preserve panel state
  while selecting canvas items.
- [ ] **ENG-034 — Link results to editable targets.** Extend validation issues and test-step results with field or port
  identifiers where available. Selecting a result must switch to the appropriate view, select the step or connection,
  open properties, and focus the related field.
- [ ] **ENG-035 — Add result-panel tests.** Cover fresh and stale transitions, repeated validation, a failed test beside
  unresolved problems, result-to-field focus, tab and panel relationships, result counts, and status announcements.

### Workstream 4: Recompose the editor and preserve topology

- [ ] **ENG-040 — Split editor styles and presentation components.** Move the toolbar, canvas surface, outline,
  inspector, and result-panel styles into focused files following the repository component-layout convention before the
  responsive rewrite.
- [ ] **ENG-041 — Build an outline projection from graph data.** Add a tested graph-to-outline utility that derives
  trigger roots, branches, connection direction, branch labels, loops, joins, outcomes, and unreachable steps from nodes
  and edges without relying on canvas coordinates.
- [ ] **ENG-042 — Replace the flat Outline.** Render the topology projection with semantic nested lists or tree behavior,
  include validation and test status, and provide direct selection of steps and connections. Keep graph cycles bounded in
  the projection and label loop-back relationships explicitly.
- [ ] **ENG-043 — Implement mobile editor composition.** Replace wrapped desktop controls with a compact identity row,
  overflow toolbar, topology-first content area, and task-focused properties or results region. Use stable grid rows and
  panel dimensions so loading, labels, and status updates do not shift the editing surface.
- [ ] **ENG-044 — Implement editor focus coordination.** Define focus movement and return among canvas, Outline,
  properties, Problems, Test results, step catalog, and overflow menus. Remove generic focus jumps to the entire inspector
  when a more specific field or result target exists.
- [ ] **ENG-045 — Add responsive and accessibility test coverage.** Add browser-rendered editor stories for desktop and
  390 by 844 layouts, keyboard tests for graph-alternative workflows, and checks for toolbar labels, focus return, panel
  relationships, high contrast, and 400 percent zoom.

### Workstream 5: Make workflow creation deliberate

- [ ] **ENG-050 — Reconcile the create-workflow contract.** Align `CreateWorkflowRequestSchema`, the server service, and
  `createWorkflow` in the web API around all required resource and model bindings. Return structured field errors instead
  of a generic create failure.
- [ ] **ENG-051 — Replace implicit dialog defaults.** Reset create state whenever the dialog opens, initialize the name
  and repository as empty, and require an explicit repository selection. Do not select the first inventory result in
  `openCreate`.
- [ ] **ENG-052 — Add prerequisite navigation.** Add a typed app link from the no-repository state to Integrations and
  return to workflow creation after a connection is completed. Preserve only intentional form selections during that
  round trip.
- [ ] **ENG-053 — Explain binding scope in the form.** Show repository owner and name, selected Linear team and model when
  required by the contract, and concise text describing which workflow agents, data, and actions inherit those bindings.
- [ ] **ENG-054 — Add creation-flow tests.** Cover empty required fields, one and many repositories, no connected
  repository, stale resources, prerequisite navigation, structured server errors, cancellation, and state reset on
  reopen.

### Workstream 6: Replace the Operations card wall with queryable views

- [ ] **ENG-060 — Define Operations query contracts.** Add schema-validated search parameters for view, text query,
  status, repository, assignee, priority, age, sort, and page cursor. Decide whether Overview, Runs, and Work queue remain
  child routes or route-search views and encode the decision in TanStack Router.
- [ ] **ENG-061 — Add server-side work-item querying.** Replace the all-items control-plane snapshot dependency for the
  work queue with filtered, sorted, cursor-paginated endpoints and aggregate counts. Keep active-run polling independent
  from work-item inventory retrieval.
- [ ] **ENG-062 — Split the Operations route by job.** Extract Overview, Runs, and Work queue components from
  `apps/web/src/App.tsx`. Keep summary exceptions on Overview, execution status on Runs, and assignment and triage on Work
  queue.
- [ ] **ENG-063 — Build the compact work queue.** Use a Fluent `DataGrid` when the finalized task model needs column
  sorting and comparison; otherwise use a compact semantic list. Add row expansion for descriptions, query controls,
  result count, pagination, empty states, and the existing assignment action.
- [ ] **ENG-064 — Persist and restore queue state.** Store filters, sorting, and selected view in typed URL search state so
  links are shareable and browser navigation restores the same queue.
- [ ] **ENG-065 — Correct active-work terminology.** Rename “Active agents” to “Active runs” in metrics, headings, empty
  states, and accessible labels unless the backend is changed to return unique active agents. Keep agent identity as row
  metadata rather than the counted entity.
- [ ] **ENG-066 — Add Operations service and UI tests.** Cover filter and cursor contracts, stable sorting, 200-plus item
  fixtures, URL restoration, polling isolation, assignment from a filtered result, and keyboard interaction with the
  compact queue.

### Workstream 7: Replace routine raw configuration with typed controls

- [ ] **ENG-070 — Add UI metadata to step definitions.** Extend the authoritative step catalog with field labels,
  descriptions, control hints, constraints, basic versus advanced grouping, and secret or immutable markers that cannot
  be inferred safely from JSON Schema alone.
- [ ] **ENG-071 — Build reusable schema-field renderers.** Implement focused Fluent controls for strings, numbers,
  booleans, enums, arrays, and simple objects, with inline parsing and validation. Keep unsupported schema shapes on an
  explicit advanced JSON path rather than silently coercing values.
- [ ] **ENG-072 — Build typed mapping and condition editors.** Replace routine mapping JSON, switch-case JSON, expression
  paths, and comparison values with row-based editors that source available ports and fields from adjacent step schemas.
- [ ] **ENG-073 — Build a typed test-input editor.** Generate draft test inputs from the workflow input schema, retain an
  Advanced JSON mode, and use the same parsed value for Test draft and Run published version where their schemas match.
- [ ] **ENG-074 — Add an Advanced configuration disclosure.** Move digests, raw schemas, IDs, immutable references, and
  raw JSON editors into a labeled advanced region with copy actions and visible parse errors. Do not discard invalid text
  or continue showing a stale saved value as if the edit succeeded.
- [ ] **ENG-075 — Migrate step inspectors incrementally.** Convert the existing `StepInspector` branches by category,
  starting with triggers, provider operations, AI models, mappings, conditions, and loops. Remove each bespoke JSON
  textarea only after its typed replacement uses the same service contract.
- [ ] **ENG-076 — Add renderer and migration tests.** Test schema constraints, invalid intermediate input, mode switching,
  round-trip serialization, keyboard editing, generated labels and descriptions, and every migrated step definition.

### Workstream 8: Align Integrations and disclose resources progressively

- [ ] **ENG-080 — Rename the route and navigation.** Change the primary navigation item and typed route from Settings to
  Integrations, update customer-facing loading and error copy, and add a compatibility redirect from `/settings` to
  `/integrations`.
- [ ] **ENG-081 — Extract integration connection components.** Split catalog, connection summary, resource inventory, and
  connection actions from `SettingsPage.tsx` into focused components and rename the page module to match the route.
- [ ] **ENG-082 — Add connection summary fields.** Expose provider account, connection status, last successful sync,
  latest error, resource counts, and capability scope in the integration service contract and render those fields before
  resource details.
- [ ] **ENG-083 — Add resource search and disclosure.** Collapse resource names by default, add per-connection search and
  stale-state filtering, and render a compact list only when expanded. Preserve expanded and query state while a
  connection refreshes.
- [ ] **ENG-084 — Move disconnect impact to service data.** Return affected workflow counts or references from a dry-run
  impact query and use them in the disconnect confirmation instead of a generic warning.
- [ ] **ENG-085 — Add integration route tests.** Cover the redirect, summary projection, resource disclosure and search,
  refresh without losing view state, reconnect, impact-aware disconnect, and no-resource states.

### Workstream 9: Add async status, permission, and consequence contracts

- [ ] **ENG-090 — Inventory consequential actions and authorization enforcement.** Trace assign, publish, run, retry,
  retry-from-here, cancel, resume, resolve effect, connect, reconnect, reconcile, refresh, and disconnect through web and
  server code. Record the current authorization and policy decision point for each action before adding UI claims.
- [ ] **ENG-091 — Define action-availability metadata.** Add a shared contract for action key, allowed state, disabled
  reason, target label, consequence summary, approval requirement, and required capability. Populate it from server-side
  policy and resource state rather than duplicating policy in React components.
- [ ] **ENG-092 — Render action consequences consistently.** Update command bars, menus, and dialogs to consume
  availability metadata. Put persistent reasons beside unavailable primary actions and use confirmation only for
  destructive, externally visible, or difficult-to-reverse operations.
- [ ] **ENG-093 — Add a shared asynchronous status surface.** Add a small app-level live-status component or hook for
  saving, validation, testing, publishing, polling refreshes, and run mutations. Keep visible page status as the source of
  truth and use toasts for supplemental completion notices.
- [ ] **ENG-094 — Normalize busy and retry state.** Give each mutation its own pending state, prevent duplicate requests,
  preserve retryable input after failure, and avoid globally disabling unrelated connection or editor actions.
- [ ] **ENG-095 — Add authorization and async tests.** Cover allowed and denied action projections, approval-required
  state, action target and consequence copy, duplicate-submit prevention, live announcements, retry preservation, and
  keyboard access to disabled reasons.

### Workstream 10: Move scheduling into the control plane

- [ ] **ENG-100 — Define durable schedule persistence.** Add schedule identity, workflow version, trigger node, enabled
  state, interval or schedule expression, next run, last attempted run, last successful run, lease owner and expiry, and
  failure metadata to the persistence schema with a Drizzle migration.
- [ ] **ENG-101 — Implement a leased schedule dispatcher.** Add a control-plane worker loop that claims due schedules,
  creates idempotent run requests, advances next-run state transactionally, and supports an explicit missed-run or
  catch-up policy. Reuse journal idempotency instead of browser-generated time buckets as the only duplicate defense.
- [ ] **ENG-102 — Add schedule lifecycle APIs.** Return server-owned schedule health and last and next run from workflow
  APIs, and add enable, disable, and update operations with optimistic concurrency.
- [ ] **ENG-103 — Remove browser-owned execution.** Delete `WorkflowScheduleCoordinator`, its shell registration, and
  `listPublishedWorkflowSchedules` as an execution mechanism. Keep only UI queries for server-reported schedule status.
- [ ] **ENG-104 — Add scheduler tests.** Use controlled time to test one dispatcher, competing dispatchers, expired
  leases, restarts, downtime catch-up policy, disabled schedules, workflow version changes, idempotent retries, and
  persisted health reporting.
- [ ] **ENG-105 — Add deployment ownership.** Start the scheduler worker in the agentic runtime or a dedicated process,
  add health and lag telemetry, and update infrastructure and operational documentation with its singleton or
  multi-worker lease model.

### Workstream 11: Remove prototype routes and finish product copy

- [ ] **ENG-110 — Remove orphan routes.** Delete `/about` and `/contact` route registrations, page modules, tests, and dead
  dependencies unless product ownership assigns them a supported customer job. Add a not-found route that returns users
  to a valid product surface.
- [ ] **ENG-111 — Apply the approved lifecycle terminology.** Update editor, run, Operations, workflow creation, and
  Integrations strings to the wording in this review. Keep sentence-style capitalization and remove implementation terms
  from default surfaces.
- [ ] **ENG-112 — Revalidate changed copy and primitives with Fluent Agent.** Review every changed customer-facing string
  against the Microsoft Content Style Guide and validate newly introduced Fluent components, icons, and tokens before
  merging each owning workstream.
- [ ] **ENG-113 — Update product and architecture documentation.** Document the canonical run model, draft and active
  version lifecycle, Operations query model, action-availability contract, and durable scheduler in focused docs pages and
  link them from `docs/README.md`.

### Workstream 12: Integrated verification and rollout

- [ ] **ENG-120 — Add browser fixtures for reviewed scale and failure states.** Create deterministic development and test
  fixtures for 222 work items with a large blocked subset, 21 integration resources, stale authoring results, failed
  legacy and journal runs, multiple published versions, denied actions, and unhealthy schedules.
- [ ] **ENG-121 — Add integrated browser journeys.** Implement browser-level journeys for create, configure, resolve
  problems, test, publish, run, diagnose, recover, filter Operations, manage an integration, and inspect a schedule across
  desktop and mobile viewports.
- [ ] **ENG-122 — Add accessibility automation and manual checkpoints.** Run automated checks on every route and add
  repeatable keyboard, screen-reader, high-contrast, touch-target, and 400 percent zoom scripts or checklists to the
  browser verification workflow.
- [ ] **ENG-123 — Define migration and compatibility rollout.** Sequence database migrations, dual-read or response
  compatibility, client deployment, legacy-run adapters, route redirects, and removal of obsolete fields and endpoints.
  Add telemetry for fallback adapters and deprecated contract use before deletion.
- [ ] **ENG-124 — Run repository gates per coherent slice.** For each workstream, add focused service and UI tests, run
  package-level type, lint, and test commands, exercise the changed customer workflow in the integrated browser, and run
  `pnpm verify` before the slice is considered complete.

## Backlog coverage

| Review finding | Resolving tasks |
| --- | --- |
| Canonical failed-run truth and recovery | ENG-010 through ENG-018 |
| Explicit draft and published-version lifecycle | ENG-020 through ENG-026 |
| Scalable Operations information architecture | ENG-060 through ENG-066 |
| Persistent revision-scoped authoring results | ENG-030 through ENG-035 |
| Responsive editor with preserved topology | ENG-040 through ENG-045 |
| Intentional workflow creation and binding | ENG-050 through ENG-054 |
| Task-oriented controls before raw configuration | ENG-070 through ENG-076 |
| Consistent integration language and resource disclosure | ENG-080 through ENG-085 |
| Accessible asynchronous status and disabled reasons | ENG-093 through ENG-095, ENG-122 |
| Consequence and permission disclosure | ENG-090 through ENG-095 |
| Focus product navigation | ENG-080, ENG-110 |
| Durable schedule ownership | ENG-100 through ENG-105 |
| Cross-cutting copy, documentation, migration, and verification | ENG-111 through ENG-124 |