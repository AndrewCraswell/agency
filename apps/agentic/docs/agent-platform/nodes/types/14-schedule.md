# Schedule Node Review

Status: Design review

Last reviewed: 2026-07-20

## Identity

| Field | Current value |
| --- | --- |
| Kind | `schedule` |
| Version | `1` |
| Phase | `6` |
| Category | Trigger |
| Execution class | Control |
| Mutation policy | None |
| Input ports | None |
| Output port | `fire`, one generic object |

The schedule node starts an immutable published workflow on a recurring interval or CRON expression. Its user-facing
job is: **Run this workflow at these intended local or elapsed times, with explicit behavior when execution is late,
missed, duplicated, or still active.** The registry contract is in
[stepRegistry.ts](../../../../src/workflows/stepRegistry.ts#L499-L520).

## Job And Mental Model

Users distinguish calendar recurrence from elapsed intervals. "Weekdays at 9:00 in New York" should remain a local-time
promise across daylight-saving changes; "every 24 hours" is elapsed time and may drift relative to local clocks. Users
also expect the product to say what happens when the worker is down or the previous run is still active.

The current implementation durably projects and leases schedules, but hides those policy choices. It hard-codes a
one-overdue-fire, skip-backlog policy, advances cadence from dispatch completion, allows unrestricted overlapping runs,
and treats run creation as schedule success.

## Current Contract

### Configuration And Compilation

- Config requires `timezone` and permits optional `cron` and `intervalSeconds`; the registry alone does not enforce
  exactly one ([stepRegistry.ts](../../../../src/workflows/stepRegistry.ts#L499-L520)).
- `scheduleDefinitionFromConfig()` enforces one interval or CRON, interval 10 through 86,400 seconds, and a nonempty
  timezone. `cron-parser` computes the next occurrence
  ([scheduleDefinition.ts](../../../../src/workflows/scheduleDefinition.ts#L4-L47)).
- The compiler validates the special schedule definition and computes one occurrence from the Unix epoch using
  `workflowId:stepId` as hash seed ([compiler.ts](../../../../src/workflows/compiler.ts#L493-L518)). It does not validate
  intended DST policy, supported CRON grammar, minimum operational frequency, misfire behavior, or overlap.
- CRON parser strict mode is not enabled. Optional seconds and advanced syntax can be accepted even though the worker
  polling and one-overdue-fire behavior cannot reliably honor second-level recurrence.

### Projection, Dispatch, And Runtime

- Active immutable packages project schedule definitions; synchronization stores one row per workflow/node and computes
  `nextRunAt` from synchronization time ([publishedTriggers.ts](../../../../src/workflows/publishedTriggers.ts#L42-L110),
  [workflowScheduleStore.ts](../../../../src/persistence/workflowScheduleStore.ts#L44-L113)).
- Due rows are claimed with an optimistic revision and a lease. Default claim lease is 30 seconds and batch size is 20
  ([scheduleDispatcher.ts](../../../../src/workflows/scheduleDispatcher.ts#L8-L14),
  [workflowScheduleStore.ts](../../../../src/persistence/workflowScheduleStore.ts#L157-L200)).
- The occurrence key is `scheduleId:nextRunAt`. Run-journal uniqueness protects the same persisted due occurrence from
  duplicate starts.
- Claims are processed sequentially without heartbeat. Later items in a batch can lose their lease before completion.
- On successful run creation, next occurrence is calculated from completion-time `now`, not the prior intended fire.
  Missed occurrences are skipped and interval cadence drifts
  ([workflowScheduleStore.ts](../../../../src/persistence/workflowScheduleStore.ts#L202-L251)).
- Initial synchronization hashes CRON with `workflowId:nodeId`; completion and API update hash with `scheduleId`. Hashed
  CRON can therefore move after its first dispatch.
- Failure leaves the old due time and clears the lease. The worker retries immediately on each polling cycle, without
  backoff, maximum attempts, quarantine, or auto-pause.
- The runtime starts with `{}` and the trigger passes `input.fire` through
  ([scheduleDispatcher.ts](../../../../src/workflows/scheduleDispatcher.ts#L27-L79),
  [workflowExecutor.ts](../../../../src/workflows/workflowExecutor.ts#L376-L390)). Workflows cannot inspect intended fire,
  actual dispatch, lateness, retry ordinal, or misfire classification.

### Persistence And Evidence

The schedule row stores definition, next run, last attempted dispatch, last successful run creation, lease, error, and
revision. It does not store one durable occurrence per intended fire, linked run ID, terminal workflow result, misfire,
overlap decision, attempt count, or retry time. `lastSuccessfulAt` means the workflow run was prepared, not that the run
succeeded.

Run evidence retains a trigger identity containing the schedule occurrence key, but no structured schedule-fire datum.
The workflow list reduces schedule state to a badge and does not offer pause, next-fire preview, occurrence history,
error details, or repair controls.

## Authoring Experience

- New schedules default to UTC every 300 seconds
  ([WorkflowEditorPage.tsx](../../../../../web/src/routes/WorkflowEditorPage.tsx#L156-L161)).
- The custom inspector switches between Interval and CRON; CRON defaults to weekdays at 09:00. CRON and timezone are
  free text. The interval UI applies the minimum but does not expose the backend maximum
  ([WorkflowEditorInspector.tsx](../../../../../web/src/routes/WorkflowEditorInspector.tsx#L1489-L1538)).
- Registry-driven `ui.fields` is empty, so schema, defaults, and inspector behavior have separate ownership.
- Card and outline omit recurrence, timezone, next fire, overlap/misfire policy, paused/error state, and latest result.
- Draft testing injects a synthetic fire after scheduling. It cannot prove projection, claiming, lateness, downtime,
  DST, overlap, or dispatch recovery.

## Behavior Matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| Valid interval | Starts one run when due | Preserve intended cadence and emit structured fire evidence |
| Valid CRON/timezone | Parser selects next occurrence | Preview and test calendar semantics, including DST |
| Both/neither timing modes | Compiler rejects | Inline mode-specific validation before save/publish |
| Spring-forward missing local time | Dependency-defined, unproven | Explicit skip or next-valid-time policy with preview |
| Fall-back repeated local time | Dependency-defined, unproven | Explicit once or twice policy with occurrence identity |
| Worker outage over five fires | Starts one overdue run; skips remainder | Apply author-selected skip, latest, or bounded catch-up policy |
| Previous run still active | Starts another run | Apply skip, queue-one, queue-all-bounded, or allow policy |
| Run-start failure | Retries every poll forever | Backoff, ceiling, quarantine/auto-pause, recovery action |
| Crash during schedule claim | Lease can be reclaimed | Retain occurrence and retry history |
| Crash during workflow activation | Schedule can advance while run remains stuck | Recover expired attempt leases and link terminal outcome |
| Definition update | Resets next fire from synchronization time | Preview effective change and define cadence preservation |
| Hashed CRON | Hash seed changes after first fire | Use one immutable seed for all calculations |
| Draft test | Emits arbitrary `{}` | Emit a validated sample fire marked synthetic |

## Validation, Tests, And Gaps

Existing tests cover ordinary interval calculation, one normal timezone CRON, invalid/ambiguous configuration, immutable
projection, one overdue dispatch, duplicate occurrence protection, schedule-lease competition/reclaim, and selected UI
defaults. Missing cases include both DST boundaries, hashed-CRON stability, second-level CRON, long outages, all misfire
policies, overlap with a live run, retry backoff/ceiling, batch lease expiry, definition update during lease, occurrence
to terminal-run linkage, and workflow-attempt crash recovery.

This documentation review did not run tests or browser acceptance, per task constraint.

## Expert Judgments

### Competitive Expert

n8n provides structured recurrence options plus CRON and timezone precedence. Make emphasizes visible next execution,
schedule bounds, and sequential processing. Power Automate exposes start time, timezone, concurrency, queued runs, retry
limits, and suspension for persistent failures. Agency has stronger immutable-package and occurrence-key foundations,
but lacks the explicit scheduling policies users expect. Its differentiator should be durable occurrence evidence and
replayable policy decisions, not a thinner CRON editor.

### UX Expert

Free-text CRON and timezone make the common case expert-only. The inspector should begin with a recurrence builder and
human-readable next-fire list, while preserving raw CRON under Advanced. DST, misfire, and overlap choices need concise
plain-language consequences, not implementation terminology.

### User Researcher

Schedule trust is retrospective: "Was it supposed to run? Did it run late? Was it skipped because another run was
active?" Current state records only the next fire and dispatch-level success. Users cannot distinguish a healthy
schedule from one that starts workflows which later remain stuck or fail.

## Findings

### P0

1. End-to-end durability is incomplete if expired workflow-attempt leases are not recovered; a scheduled run can remain
   permanently active while later occurrences continue.

### P1

1. Overlap is unrestricted and not authorable.
2. Misfire behavior is fixed, skips backlog, and drifts cadence from dispatch completion.
3. Dispatch failures retry indefinitely without backoff, ceiling, quarantine, or auto-pause.
4. DST and repeated/missing local-time semantics are dependency-defined and unproven.
5. Hashed CRON uses inconsistent seeds; second-level recurrence can be accepted but not honored reliably.
6. Schedule evidence describes dispatch/run creation rather than intended occurrence and terminal workflow outcome.
7. Published projection can overwrite timing changed through the management API, creating competing authorities.
8. Sequential batch dispatch has no lease heartbeat.

### P2

1. Removed triggers accumulate disabled rows without useful history semantics.
2. Card, outline, workflow list, and inspector omit next-fire and health information.
3. An unused browser interval coordinator remains a second scheduling model that must stay unmounted or be removed.

## Recommended Target

### Contract And Ports

- Config: recurrence mode, structured rule or CRON, IANA timezone, start/end bounds, immutable hash seed, DST policy,
  misfire policy, overlap policy, maximum catch-up, and dispatch retry policy.
- Output `fire`: `{ occurrenceId, scheduledAt, localScheduledAt, timezone, dispatchedAt, latenessMs, attempt,
  misfireDisposition, synthetic }`.
- Operational outcomes: `started`, `skipped_overlap`, `skipped_misfire`, `dispatch_failed`, and `quarantined` belong to
  occurrence evidence. The normal workflow port should emit only fires that actually start a run.

### Card And Inspector

- Card summary: **Weekdays at 9:00 AM America/New_York**, next fire, overlap policy, and paused/error badge.
- Inspector basics: recurrence builder, timezone picker, start/end, next five occurrences, and local/UTC preview.
- Reliability section: missed-run and overlap segmented controls with consequence examples and bounded values.
- Test area: synthetic occurrence, DST preview, downtime simulation, and run-longer-than-period simulation.
- Advanced: raw CRON, immutable seed, retry/backoff, and occurrence retention.

### Evidence And Safe Defaults

- Persist an occurrence before dispatch and link all dispatch attempts plus the eventual run and terminal status.
- Default calendar schedules to local wall-clock semantics, one fire during repeated local time, skip nonexistent local
  time with a visible warning, skip old backlog but preserve cadence, and queue one occurrence while a run is active.
- Bound catch-up, overlap queue, retries, lateness, and occurrence retention. Auto-pause persistent invalid or failing
  schedules with an explicit repair action.

## Fix Checklist

- [ ] **P0: Recover expired workflow execution leases.** Acceptance: killing a worker during a scheduled activation
  causes a fenced retry or terminal recovery; the occurrence and run cannot remain silently active forever.
- [ ] **P1: Add durable occurrence records.** Acceptance: every intended fire records scheduled time, local time,
  dispatch attempts, lateness, policy disposition, linked run, and terminal result.
- [ ] **P1: Implement overlap policies.** Acceptance: allow, skip, queue-one, and bounded queue behavior are deterministic
  under two workers and survive restart.
- [ ] **P1: Implement misfire policies without cadence drift.** Acceptance: skip, latest, and bounded catch-up pass a
  multi-hour outage matrix and next fire derives from intended cadence.
- [ ] **P1: Bound dispatch recovery.** Acceptance: retryable failures use jittered backoff and a ceiling; permanent
  failures quarantine or pause; operator repair resumes from a documented state.
- [ ] **P1: Define and test DST/CRON semantics.** Acceptance: spring gap, fall repeat, local daily versus elapsed interval,
  advanced grammar, minimum frequency, and hashed seed stability have executable cases and matching previews.
- [ ] **P1: Establish one timing authority.** Acceptance: editor, published package, schedule store, and management API
  cannot silently overwrite one another; changes display their effective next fire before confirmation.
- [ ] **P2: Replace text-first authoring.** Acceptance: common schedules require no CRON, timezone is searchable, and
  card/outline/workflow list expose recurrence, next fire, health, and pause state.

## Dependencies And Open Decisions

Dependencies: workflow lease recovery; shared expected-outcome evidence; schedule occurrence persistence; active-run
lookup; versioned recurrence manifest; management permissions; card summaries and inline test evidence.

Open decisions:

1. Which DST behavior is the product default for missing and repeated local times?
2. Does overlap apply per node, workflow, resource, or a user-defined concurrency key?
3. Which misfire modes are necessary for the first release, and what is the maximum catch-up bound?
4. Should persistent failures auto-pause, quarantine occurrences, or both?
5. Are published definitions the only timing authority, or may operators make durable schedule overrides?
