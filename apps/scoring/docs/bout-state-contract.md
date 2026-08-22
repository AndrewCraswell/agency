# Bout-state contract

**Task:** M1-06

## Scope

`src/bout-state.ts` owns an in-memory, weapon-neutral boundary between one completed or active bout state and the next. Its discriminated `BoutState` union selects the richer epee resistance scorer, foil scorer, or sabre scorer. This makes every scorer's candidates, hits, lockout, and diagnostics replaceable as one unit.

## Fresh bouts and transitions

`createFreshBoutState` requires a caller-provided `boutId` of one to 96 characters with no leading or trailing whitespace. It does not normalize an identifier. A fresh bout starts at `boutRevision: 0` with a new empty weapon scorer. `transitionBoutState` accepts only a `supervisor-authorized` parsed transition. It requires a distinct successor identifier, increments `boutRevision` deterministically, and always creates a new scorer state.

`bout-reset` retains the current weapon and accepts only `authorization`, `cause`, and `nextBoutId`. `weapon-change` selects epee, foil, or sabre and may select the same weapon when the supervisor explicitly starts another bout; it accepts those fields plus `weapon`. Both reject every additional or missing own property. Neither transition can retain a candidate, hit, lockout, diagnostic, insulation observation, blade history, or provisional timing state.

## Containment

This is not a processor-reset, brownout, watchdog, power-loss, update, recovery, persistence, or authorization implementation. Such lifecycle causes are rejected as bout-transition causes. The API returns state only and imports no decision-record schema, so it cannot fabricate an immutable decision record. M2 must connect accepted supervisor actions and authoritative record production without allowing the ESP32 to imply either action.
