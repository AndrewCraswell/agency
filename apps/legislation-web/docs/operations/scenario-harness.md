# Goal-driven browser scenarios

Choose moderate research objectives that typically take five to eight exchanges. This is an authoring guideline,
not a limit. There is no hard exchange count, recovery count, planner character ceiling, or harness-imposed planner
output-token limit. The application's actual 24000-character message contract still applies.
Jurisdictions are explicit names supplied by the scenario, not a closed list of U.S. states. Constraints may be empty.
Scenario and goal IDs must be path-safe, but have no harness length cap; attempt directory names are generated IDs.

```json
{
  "id": "education-funding",
  "objective": "Understand selected proposals, their eligibility rules, and important evidence gaps.",
  "jurisdictions": ["U.S. federal", "California"],
  "adaptive": {
    "persona": "An education reporter",
    "constraints": ["Research cutoff is September 18, 2026. Distinguish proposals from enacted law."]
  },
  "steps": [
    {"id": "discover", "prompt": "Which proposals address school funding through September 18, 2026?"},
    {"id": "compare", "prompt": "Understand eligibility and implementation tradeoffs in the selected proposals."}
  ]
}
```

The first step is the opening. Remaining steps describe goals, not a forced script. The harness owns scope; the
planner may focus a question on one selected measure without repeating all jurisdictions. Authored openings and
planner questions are submitted verbatim, without an "Approved jurisdictions" suffix. Geography belongs in natural
wording when relevant or in an answer to an actual clarification; the application does not receive the harness's
private scope metadata. It never receives diagnostic
exports, tool inventories or evaluator answers. The visible snapshot reads articles once and removes buttons,
timestamps and export regions; it does not truncate research text. Long passages remain available.

## Planner failures

The planner chooses `follow-up`, `clarify`, `finish` or `pause`, with text, option labels and a reason. It does not
grade answers, generate supporting quotes, or certify correctness. A useful recovery is just a follow-up; multiple
distinct recoveries are allowed. Missing evidence can be an honest result. Repeated non-progress with no useful
question or a concrete blocker warrants pause, not an arbitrary turn count.

Malformed/invalid decisions receive validation feedback until corrected or cancelled; repeated error text is not
an automatic stop. Repair and retry events are persisted as they occur. Retryable planner transport failures, HTTP 408,
429 and 5xx responses retry with cancellable backoff and honor Retry-After/Retry-After-Ms. The default backoff grows
from 1s to 30s between attempts; this is pacing, not an attempt limit or deadline. Authentication and invalid-request
failures do not retry blindly. Actual context/permanent-provider failures preserve input and checkpoint for intervention.
No source text is silently truncated and no model is silently substituted. Planner retries never repeat research calls.

An intentional repeated question is allowed as a new journaled submission. The planner sees prior questions and must
justify a useful next action; the ledger prevents duplicate delivery, not repetition of human wording.

## Durable execution

`scenario-session.ts` owns both entry points. Each attempt stores an atomic `state.json`, append-only `events.jsonl`,
and immutable `capture-*.json` receipts. State contains the scenario, accepted decision, submission intentions,
confirmed request status/ID, conversation identity, visible history and captured assistant IDs. Credentials and
reasoning are redacted. Keep all attempts for a campaign under one parent directory: its `.conversation-owners`
registry prevents cross-attempt conversation reuse.

A submission intention is saved **before** pressing Send. Restarting after that point requires reconciling the
existing browser messages, not resending the question. A 503 without a new assistant message gets no previous
answer's trace or outcome. Clarification labels and free text are joined exactly as the form submits them.
Captures with unexpected questions or a changed session are retained, but continuation is refused.

Browser read/navigation races and pre-Send action timeouts are retried after reinspection. Once pressing Send or
Continue has been attempted, failures return uncertain delivery and the controller observes/captures rather than
pressing it again. Caller cancellation, a closed page, lost session access, leaving the authorized origin, or an
unavailable application are blockers. Keep the original browser tab open; the journal cannot recreate lost access.
Borrowed/integrated pages are never closed by the harness and the runner never clicks Stop.

`--wait-ms` is a positive checkpoint interval (default 600000). Each interval saves status and continues observing;
it does not return from the run. Caller cancellation returns a resumable checkpoint. CLI SIGINT/SIGTERM cancels
the controller without resending or cancelling research. An intended question with uncertain delivery stays pending
until reconciled. Browser operations still have library timeout checkpoints; these are not scenario deadlines.

## Entry points

From the web app, validate without inference: `pnpm tool agent/run-scenarios --scenario authored.json` (or stdin `-`).
Run CLI browser acceptance with `--execute --adaptive-model <model>`. Resume with `--resume <attempt-directory>`
and the same explicit model. To explicitly reopen a finished or paused attempt, also pass `--continue "reason"`;
the prior finish and reason are retained in the event journal. CLI-created headless browsers are for automation; user-requested integrated runs must
use the shared VS Code browser instead. The planner's low effort does not change the application's model settings.

For integrated execution, start `pnpm tool agent/serve-scenarios --scenario authored.json --directory
artifacts/scenario-runs/<new-attempt> --model <model>`. It binds loopback port3050 and accepts only the configured
application origin (default http://127.0.0.1:3000). Omit `--scenario` when reopening an existing attempt.
Both entry points permit explicitly authorized remote HTTP(S) origins such as staging. Use `--base-url` for a CLI
entry URL (non-home paths are allowed), or `--origin` for the integrated coordinator's exact origin. Attempts persist
the origin and refuse silent environment changes on resume. No credentials, query parameters or fragments in entry URLs.

1. GET `/state` to reconcile persisted progress. GET `/browser` returns the compiled `scenarioBrowser` function;
   execute that same function with the integrated tool's `page`, operation, and `{origin}` from the authorized state,
   rather than maintaining another automation script. Optional `signal` and `onRecovery` support caller cancellation
   and persisting browser recovery events through `/checkpoint`.
2. POST `/next` returns the persisted next decision. If finished or paused, record the disposition, not a quality pass.
3. Run browser `inspect`, then POST `/prepare` with `{empty,url}`. The response supplies the exact submission text
   and decision. **Never repeat `/prepare` or Send after uncertain delivery.**
4. Execute browser `submit` with the returned text and, for clarification, its decision text and option labels.
   POST `/acknowledge` with `{status,requestId}` when the generation response is observed; never send session secrets.
5. When settled, execute browser `export` and POST its `{snapshot,visible}` to `/capture`. If `settled:false`, keep
   waiting or checkpoint. Only then request the next decision.
6. POST `/checkpoint` with a reason on tool/session interruption. POST `/continue` with `{reason}` explicitly to
   reopen a finish or pause; it preserves prior decisions and does not clear pending submissions or authorize replay. Coordinator operations serialize;
   HTTP409 means an operation is still running, not permission to duplicate it.

The coordinator does not call application research APIs. Only the user's browser submits questions. New scenarios
must start from an empty conversation and use separate attempt directories and fresh conversation identities.

## Verification

Run `pnpm exec vitest run --project backend tools/agent/run-scenarios.test.ts tools/agent/scenario-policy.test.ts`.
Regressions cover ten exchanges, multiple failures, long planner input, invalid-decision repair, transient provider
retry beyond SDK defaults, terminal401 failures, browser read recovery, uncertain Send, continuous checkpoints,
503 attribution, interrupted delivery, restart/resume, explicit finished-attempt continuation, intentional repeated
questions, non-home entry and cross-scenario isolation. Fixtures use no paid models.
`finished-unassessed` means the simulated user finished, not that legal conclusions or citations were independently
verified. Existing Langfuse evaluation and human source review remain separate.