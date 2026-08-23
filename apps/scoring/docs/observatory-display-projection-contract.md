# Observatory display projection contract

This contract defines what the web bout player may display from a scenario
report. It is a projection of a result decision from the scenario report, not
a second scoring engine and not evidence that the physical display has been
fabricated.

## Host-projection boundary

- A primary left or right hit lamp is rendered only from a result decision
  from the scenario report carrying the matching side and its `signal.visual`
  value.
- The buzzer indicator is an event-local request rendered only while the current
  accepted decision or diagnostic carries `audible: requested`. It clears on
  the next event and does not claim a physical buzzer duration.
- Accepted sabre `result.diagnostics` use the canonical `yellow-on`,
  `yellow-off`, and `white-on` vocabulary. They are validated, ordered,
  side-local indications and cannot create a score. Primary valid-hit and
  off-target lamps are independent from these diagnostic channels. Yellow
  persists until a matching side-local yellow-off; white-on requires canonical
  `latched: true` and remains on without hiding a primary lamp.
- Expected decisions are evaluation data and timeline markers. They must never
  turn on a primary lamp or buzzer.
- Electrical input snapshots may show contact, blade, and fault context at the
  replay cursor. They do not create a score, decision, or primary hit signal.
- An unavailable or reset authoritative result is rendered safe-inactive. The
  application layer must not infer a replacement hit from the last display
  state.
- The shared projection exposes `authoritativeResult: available | unavailable`.
  This states whether an accepted runner result is available; it is not a
  scorer-health or physical-readiness claim. Its accessible label states that
  result before the lamp values.

## Matrix contract

The prototype player is a logical 64 by 32 RGB matrix. Its canvas has a
640 by 320 backing store so every logical LED cell is deterministic and
pixelated. The visual layout is intentionally a product-owned projection:

- weapon name at the top;
- left and right primary lamp regions;
- contact, blade or parry, and fault indicators;
- buzzer indicator;
- event markers and the current replay cursor.

The accessible matrix label and adjacent text readout are part of the
projection contract. They expose the current side lamp, contact and fault
state, buzzer state, weapon, and cursor time without requiring colour vision.
Each event retains its declared `atUs` evidence and also receives a display-only
`playbackAtUs`, the running maximum in final timeline order. The cursor uses
that nondecreasing coordinate; when a backward event is clamped, the accessible
label also reads its declared time. Playback time never changes scoring,
qualification, cutoff, or rejection evidence.

## Reset and latch boundary

For accepted results, a decision visual with `latched: true` persists through
later events. A decision visual with `latched: false` is event-local and clears
on the next event. This is a host projection of the record schema, not evidence
of physical output timing. Scenario inputs cannot model a reset action or
physical output-clear edge; reset recovery remains a separate host lifecycle
model.

The reset lifecycle therefore fails closed. A reset makes the STM32 scoring
authority unavailable and the primary output `safe-inactive`, records
`warm-reset-latch-unresolved`, and requires technical recovery plus supervisor
authorization before scoring resumes. The web player must not claim that a
previous physical latch survived that reset.

## Promotion gate

`epee-audio-visual-correlation.json` is intentionally executable but is not
yet in the corpus manifest. Adding it to the manifest requires the separate
EPEE-05 coverage decision. Hardware buzzer pulse width, LED latch duration,
reset-button behaviour, and post-reset physical clear remain hardware-in-loop
acceptance work.

## Executable display-state acceptance

[`scenario-display-states.json`](../fixtures/scenario-display-states.json) is
the versioned host-only acceptance fixture set. Each case is projected twice by
[`scenario-display-fixtures.test.ts`](../src/scenario-display-fixtures.test.ts)
and must produce an identical state. The test also pins the ordered fixture IDs,
so removing an acceptance row fails rather than silently narrowing coverage.

| Executable acceptance | Fixture ID |
| --- | --- |
| Accepted safe-inactive output | `available-safe-inactive` |
| Left valid-hit side mapping and buzzer request | `left-valid-hit-with-buzzer` |
| Right valid-hit side mapping | `right-valid-hit-side-mapping` |
| Foil off-target lamp | `foil-off-target` |
| Sabre yellow diagnostic on without scoring | `sabre-yellow-diagnostic-on` |
| Sabre yellow diagnostic clear | `sabre-yellow-diagnostic-off` |
| Sabre latched white diagnostic | `sabre-white-diagnostic-latched` |
| Latched output retained through a later virtual-clock input | `latched-output-persists-through-later-input` |
| Reset result unavailable with prior output suppressed | `reset-result-unavailable` |
| Missing authoritative result explicitly unavailable | `missing-authoritative-result-unavailable` |

These fixtures are software projection evidence only. They do not claim RGB
pixel colour, brightness, physical latch duration, buzzer delivery, reset-button
behaviour, or apparatus conformance. Desktop/mobile rendering and keyboard
acceptance remain browser gates for player UI changes. Runtime fixture parsing
rejects malformed nested values, duplicate IDs, unbounded arrays or strings,
undeclared diagnostic sources, and event indexes outside the built timeline.
