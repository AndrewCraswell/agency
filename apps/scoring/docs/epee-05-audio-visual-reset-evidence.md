# EPEE-05 audio, visual, and reset evidence

## Executable evidence delivered

[`golden-scenarios/epee-audio-visual-correlation.json`](golden-scenarios/epee-audio-visual-correlation.json)
replays a short left-side non-event and a right-side epee contact that
qualifies at exactly two milliseconds. The expected host-projection decision
requires the complete output tuple:

```json
{
  "visual": "valid-hit",
  "audible": "requested",
  "latched": true
}
```

The scenario also asserts that the short left contact produces no decision.
This prevents the audio and visual signal assertion from being satisfied by an
unqualified contact.

Run it with:

```text
pnpm --filter scoring run:scenarios -- docs/golden-scenarios/epee-audio-visual-correlation.json
```

The runner provides authoritative host-projection evidence: it invokes the
existing epee scorer and fails if the decision timing, side, source inputs, or
signal tuple changes. This is not physical-output evidence.

## Reset and latch evidence

The existing reset-recovery model and its focused tests provide the supported
host-model reset evidence. Within that model, a latched primary output becomes
`safe-inactive` after an STM32 reset and records
`warm-reset-latch-unresolved`, and remains unavailable until technical gates
pass and a supervisor authorizes a new scoring state.

The golden scenario fixture does not invent a reset input. The current
scenario schema contains reset-shaped decision records, but the runner's
electrical snapshot execution has no reset action, output-clear acknowledgement,
or physical buzzer/LED timing channel. Consequently this task does not claim
that a physical lamp latch survives or clears on reset. That remains a
hardware-in-loop requirement.

## Web-player acceptance evidence

The observatory projection contract is in
[`observatory-display-projection-contract.md`](observatory-display-projection-contract.md).
The current browser acceptance path is:

1. Start `pnpm --filter scoring observe:scenarios`.
2. Choose `epee.contact-boundaries`.
3. Select the `Host-scorer output: qualified-hit` marker.
4. Confirm the 64 by 32 matrix label, right valid-hit state, buzzer requested
   state, cursor time, and event count update together.
5. Select an input marker for a grounded scenario and confirm fault context is
   shown without creating a hit decision.

The browser view is a deterministic projection of the report. It is not a
substitute for measuring the physical RGB panel, buzzer pulse, or reset latch.
The browser acceptance path is intentionally recorded here instead of being
represented by source-text assertions. It must be repeated after player UX
changes until the player is extracted behind a directly testable projection
API or an approved browser-test dependency is added.
