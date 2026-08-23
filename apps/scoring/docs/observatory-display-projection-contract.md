# Observatory display projection contract

This contract defines what the web bout player may display from a scenario
report. It is a projection of a result decision from the scenario report, not
a second scoring engine and not evidence that the physical display has been
fabricated.

## Host-projection boundary

- A primary left or right hit lamp is rendered only from a result decision
  from the scenario report carrying the matching side and its `signal.visual`
  value.
- The buzzer indicator is rendered only from a result decision from the
  scenario report whose `signal.audible` value is `requested`.
- Expected decisions are evaluation data and timeline markers. They must never
  turn on a primary lamp or buzzer.
- Electrical input snapshots may show contact, blade, and fault context at the
  replay cursor. They do not create a score, decision, or primary hit signal.
- An unavailable or reset scoring authority is rendered safe-inactive. The
  application layer must not infer a replacement hit from the last display
  state.

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

## Reset and latch boundary

The current golden scenario runner provides authoritative host-projection
evidence for the qualified-hit signal tuple `visual: valid-hit`,
`audible: requested`, and `latched: true`. It cannot model a reset action or
physical output-clear edge: scenario inputs are electrical snapshots, while
reset recovery is a separate host lifecycle model.

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
