# Scoring simulator product design specification

**Status:** Designer handoff

**Audience:** Product designer, interaction designer, frontend engineer, accessibility reviewer

**Target:** Production-ready responsive web application using shadcn/ui

**Primary viewport:** 1440 × 1024

**Required responsive frames:** 1280 × 800, 768 × 1024, and 390 × 844

## Product intent

Design a high-quality simulator and test observatory for the scoring machine. The page must let a user find every test
scenario, understand what it proves, run one scenario or the complete executable corpus, and replay every input,
decision, diagnostic, and assertion against a deterministic logical 64 × 32 RGB developer preview.

The visual direction is minimal, precise, and professional: a modern SaaS workspace surrounding a purpose-built dark
apparatus display. It must feel suitable for an engineer, referee, product reviewer, or customer demonstration without
looking like a developer console.

The [Skewered simulator](https://skewered-fencing.com/scoring-box-sim) and
[timeline description](https://skewered-fencing.com/scoring-box#timeline) are capability references, not a visual
template. Our design must be original. Preserve the useful concepts: weapon-specific display layouts, frozen event
history, blade-contact and fault lanes, first-contact and lockout markers, timeline review, score, clock, cards, and
step-forward/backward playback.

Use a clean-room process. Do not copy or trace Skewered screenshots, assets, pixel maps, layout measurements, code,
copy, animation frames, or interaction details. Derive our arrangement independently from this document and our data
contract. Skewered describes its timeline as patent pending; route patent-scope questions to counsel rather than making
an implementation assumption in design.

## Product principles

1. **The display explains; it never scores.** The page renders authoritative scenario results. Expected assertions,
   raw electrical inputs, and browser interactions cannot create a touch.
2. **Evaluation and result authority stay separate.** A passed test may intentionally receive a rejected actual result.
   A failed comparison may still contain an accepted authoritative result that must remain visible alongside the
   mismatch. Only a rejected, missing, malformed, or unknown actual result clears the authoritative projection.
3. **Evidence time and playback progress are distinct.** Preserve declared timestamps, including invalid backward
   timestamps. Keep the visual playback cursor nondecreasing and explain any difference.
4. **Color is reinforced by position, shape, icon, and text.** The interface and 64 × 32 preview must remain legible
   for common color-vision deficiencies.
5. **Planned requirements are not disabled tests.** Separate executable scenarios from incomplete requirement evidence.
   A planned requirement may link to active partial scenarios; retain and expose those mappings while explaining the
   remaining rules, analog, output, audio, timing, or hardware evidence gate. Never include planned requirements in
   pass-rate totals or expose a Run action for the requirement row itself.
6. **Dense information, calm hierarchy.** Prefer aligned grids, restrained borders, muted metadata, and generous
   whitespace over decorative cards or dashboard clutter.

## Information architecture

Use one continuous workspace. Do not make the primary workflow depend on page-level tabs.

### Global application header

- Product name: **Scoring simulator**
- Environment badge when relevant: Local, CI artifact, or Recorded session
- Corpus and rule revision
- Corpus summary: executable count, passed, failed, and planned requirements as separate quantities; never label a
  planned requirement as a skipped or disabled test
- Primary actions:
  - **Run all executable tests**, an atomic request with Running, Complete, and Error states
  - **Play all reports**, available after reports have loaded
  - Overflow menu for export report, copy scenario link, and keyboard shortcuts
- Do not place firmware controls, live scoring controls, or device-reset controls in this page.

### Desktop workspace

Use a three-region layout:

1. **Scenario navigator**, 300–340 px fixed/resizable left rail
2. **Display and playback workspace**, fluid center region with a minimum useful width of 640 px
3. **Event inspector**, 320–380 px right rail when space permits

Place the detailed timeline below the display within the center region. The display and timeline should remain visible
together on a 1440 px desktop without scrolling the whole page. Rails may scroll independently.

### Tablet and mobile

- At widths below 1024 px, move the scenario navigator into a left `Sheet` and the event inspector into a bottom or
  right `Sheet`.
- Keep the 64 × 32 preview at its exact 2:1 ratio and use the available content width.
- Place playback controls in a sticky bar below the preview.
- The timeline becomes a horizontally scrollable, vertically stacked lane view. A marker may render as a 24 px visual,
  but every interactive mobile hit area must be at least 44 × 44 px.
- The selected scenario identity, status, weapon, score, and timer remain visible without opening a sheet.
- No horizontal page overflow at 390 px.

## Scenario navigator

### Header and filters

Use shadcn/ui `Input`, `Command`, `Badge`, `Select`, `Toggle Group`, and `Scroll Area` patterns.

- Search by title, scenario ID, requirement ID, description, or source ID
- Weapon filter: All, Épée, Foil, Sabre
- Evaluation filter: All executable, Passed, Failed, Not run
- Actual-result filter: Accepted, Rejected, Unavailable
- Item-kind filter: Executable scenarios, Planned requirements
- Evidence filter: Timing, resistance, fault containment, lockout, diagnostic, reset, transport
- Sort defaults to canonical corpus order; optional alternatives are evaluation status, actual-result status, and weapon
- A compact **Clear filters** action appears only when filters are active

### Grouping and rows

Render two explicit sections:

1. **Executable scenarios** with separate evaluation and actual-result statuses
2. **Planned requirements** with Planned status and no Run action

Each executable row contains:

- Status icon and text
- Evaluation status: Passed, Failed, Not run, or Running
- Actual-result status when run: Accepted, Rejected, or Unavailable
- Scenario title
- One-sentence description, clamped to two lines
- Weapon badge
- Duration or final event time
- Scenario ID in muted monospace text

Each planned row contains:

- Requirement title and description
- Weapon or All weapons badge
- Requirement ID, clearly labeled as a requirement rather than a scenario
- A short **Why not executable** explanation
- Links to every active partial scenario declared by the requirement, labeled **Partial executable evidence**

Selecting a row changes the detail workspace but does not automatically run it. Preserve the selected item when filters
change if it remains visible.

## Selected scenario header

Above the display, show:

- Human-readable scenario title
- Evaluation-status badge
- Actual-result-status badge after execution
- Weapon badge with icon and full text
- Scenario ID or Requirement ID with the correct label
- Rule revision
- Source references in a tooltip or popover
- Full two-to-four sentence scenario description
- **Run scenario** action only for a valid executable scenario identity and rule revision

Use `Badge`, `Button`, `Tooltip`, and semantic `dl`, `dt`, and `dd` elements. Missing or malformed executable identity
must show **Unavailable** and suppress Run. A planned requirement shows its evidence status and mapped active scenario
revisions; it shows **Rule revision: Not declared** only when no mapped scenario supplies one.

## 64 × 32 scoring display preview

### Display treatment

- Exact logical resolution: 64 columns × 32 rows, displayed at a 2:1 ratio
- Dark near-black housing and pixel field within the lighter SaaS shell
- Crisp nearest-neighbor scaling with an optional subtle unlit-pixel grid
- Rounded housing corners are allowed; the pixel field itself remains rectangular
- Provide a text equivalent adjacent to or immediately below the canvas
- Header label: **64 × 32 developer display preview**
- Persistent status line: **Authoritative result available** or **Authoritative result unavailable**
- Never describe this preview as physical output evidence

### Current and reserved content

The design must distinguish what the current host projection can implement from states that need a future authoritative
schema. Reserved states belong in Figma variants but must render **Not recorded** in the first implementation.

| State | Design status | Authority source |
| --- | --- | --- |
| Weapon mode | Implement now | Scenario metadata |
| Authoritative-result availability | Implement now | Actual result status |
| Left/right primary `off`, `valid-hit`, `off-target` | Implement now | Accepted result decisions |
| Left/right yellow equipment diagnostic | Implement now | Accepted canonical yellow-on/yellow-off diagnostics |
| Left/right white diagnostic | Implement now | Accepted canonical white-on diagnostics |
| Blade/contact/fault context | Implement now | Declared input context, never scoring qualification |
| Audio-request indicator | Implement now | Current accepted output/diagnostic event only |
| Raw time, playback coordinate, event number | Implement now | Shared display timeline |
| Bout score and last-scored side | Design-reserved | Future authoritative bout-state event |
| Bout, period, break, and passivity timers | Design-reserved | Future authoritative clock event |
| Yellow/red/passivity penalty cards | Design-reserved | Future authoritative referee/bout-state event |
| Period and priority | Design-reserved | Future authoritative bout-state event |
| Late-hit and whipover classifications | Design-reserved | Future explicit result fields; do not infer in UI |

The display variants must support these channels:

- Mutually exclusive left and right primary states: off, valid-hit, or off-target
- Left and right yellow equipment-diagnostic indicators
- Left and right white equipment-fault indicators
- Blade/parry contact indicator
- Audible-request indicator
- Current weapon mode
- Left and right bout score
- Bout timer in `M:SS`, with tenths only when the active mode requires it
- Period or match indicator when supplied
- Priority side when supplied
- Left and right yellow penalty-card indicators
- Red and passivity-card states are reserved in the component model even if the first design review focuses on yellow
- Last-scored side indicator when supplied
- Late-hit and whipover indicators when supplied

### Do not conflate yellow meanings

The display has two different yellow concepts:

1. **Yellow equipment diagnostic**: an authoritative own-equipment fault/clear condition, located in the
   diagnostic/timeline region and paired with a plug, wire, or warning-line symbol.
2. **Yellow penalty card**: a referee sanction, located beside the corresponding score and shaped like a small card.

They must never share the same position or icon. Accessible copy must say **Yellow equipment diagnostic** or
**Yellow penalty card**, never only **Yellow**.

### Recommended pixel-layout hierarchy

The designer should produce weapon-specific variants that preserve the same information hierarchy:

- **Top status band:** weapon, period/priority, authority or review mode
- **Left and right score zones:** large two-digit scores with penalty cards adjacent
- **Center clock zone:** bout timer, visually subordinate only to active touch lamps
- **Primary touch zones:** large, symmetric, and visible at distance
- **Diagnostic zones:** smaller independent yellow and white regions for each side
- **Timeline band:** bottom 10–12 rows, described below

Épée should emphasize primary touch indicators. Sabre should allocate more space to yellow/white diagnostics and blade
history. Foil must make on-target and off-target states unmistakably different through both position and shape.

If score, timer, card, period, or priority data is absent from a test scenario, show an explicit neutral placeholder
such as `—`; do not invent bout state from touch events.

## Timeline design

Provide two synchronized timeline representations derived from the same ordered event data.

### Apparatus timeline inside the 64 × 32 preview

This conceptual compact history shows how the logical developer preview could arrange recorded events. It does not
claim the physical product's released pixel map or behavior.

- Left equipment diagnostic/fault lane
- Left contact lane
- Center blade/parry lane
- Right contact lane
- Right equipment diagnostic/fault lane
- First candidate-contact marker
- Authoritative decision marker
- Lockout or second-touch cutoff marker
- Optional late-hit and whipover markers

Use distinct position and pattern in addition to color. When a hit occurs, the timeline may freeze around the relevant
window. The display must indicate review mode so a frozen historical state is not mistaken for the live state.

### Interactive inspection timeline below the preview

Use a full-width lane editor/read-only sequencer treatment, not a generic activity feed.

Required lanes:

- Inputs
- Expected assertions
- Authoritative outputs
- Yellow diagnostics
- White diagnostics
- Blade/parry contact
- Score, clock, card, and mode changes when present
- Rejection and uncertainty

Required behavior:

- Horizontal elapsed-time scale and vertical lane labels
- Zoom presets: Fit, 1×, 2×, 4×
- Scroll and pinch/trackpad zoom without changing event order
- Current playback cursor
- Clickable/focusable event markers with at least a 44 × 44 px mobile hit area
- Coincident events stack or cluster without becoming unreachable
- Hover/focus tooltip with type, side, raw timestamp, playback timestamp when different, source input IDs, and outcome
- Selected event opens the inspector and updates the 64 × 32 preview
- First-contact, decision, and cutoff markers span all lanes
- Invalid backward timestamps retain their declared time and order, while the playback coordinate never decreases
- A visible explanation appears when declared time and playback position differ

## Playback controls

Use shadcn/ui `Button`, `Button Group`, `Tooltip`, `Slider`, `Select`, and `Progress` primitives.

Controls, in order:

1. Restart scenario
2. Previous event
3. Play or Pause
4. Next event
5. Jump to next failure or mismatch
6. Playback speed: 0.25×, 0.5×, 1×, 2×
7. Event position: `7 of 23`
8. Raw selected timestamp and playback cursor timestamp

Additional corpus control:

- **Run all executable tests** is an atomic server request that executes the canonical corpus and returns a complete
  report. Version one shows Running, Complete, or Error; it does not promise streamed progress, cancellation, or
  stop-on-first-failure. A cancellable job API requires a separate backend contract.
- **Play all reports** replays already-produced executable reports locally in canonical order without rerunning tests.
- During Play all, show playback progress and the current scenario.
- During Play all, pause on a failed evaluation by default and focus the first mismatch.
- During Play all, offer **Continue playback** and **Stop playback**.
- Planned requirement-evidence rows are reported separately and excluded from
  the executable denominator; they are not skipped or disabled tests.

Keyboard contract:

- Space: Play or Pause when focus is not in a text field
- Left and Right Arrow: Previous or Next event
- Shift + Left or Right Arrow: Previous or Next scenario
- Home: Restart selected scenario
- `F`: Jump to next failure
- `?`: Open keyboard-shortcut dialog

Every shortcut has a visible tooltip or shortcut help entry. Native button behavior remains available without shortcuts.
In reduced-motion mode, Play remains continuous discrete playback at the selected cadence without a sweeping animation;
it must not silently change into a one-step action.

## Event inspector

The inspector explains the selected event in plain language before showing structured data.

Sections:

- **Summary:** what happened, side, weapon, and whether it affected scoring
- **Timing:** declared time, playback position, qualification start/end, and cutoff relation
- **Display effect:** primary, yellow, white, audio, score, card, and clock changes
- **Evidence:** input IDs, source IDs, rule revision, uncertainty, and provenance
- **Evaluation:** expected versus authoritative actual, with Pass, Fail, or Not evaluated
- **Raw record:** collapsed by default; formatted monospace JSON with copy action

Use `Accordion`, `Separator`, `Badge`, `Table`, and `Scroll Area`. Do not use color alone for pass/fail.

## Visual system

### Direction

- shadcn/ui structure with an original token layer
- Neutral zinc/slate application shell
- White or very light-gray workspace surfaces
- Dark apparatus display
- One restrained product accent, preferably blue or indigo
- Compact 12–14 px metadata, 14–16 px body, and 20–24 px workspace headings
- Tabular numerals for timer, score, event index, and timestamps
- Minimal shadows; use borders and surface contrast for hierarchy
- Avoid a grid of unrelated metric cards

### Semantic colors

Final colors require contrast and color-vision testing. Initial intent:

- Left primary touch: saturated red plus left-side position/pattern
- Right primary touch: saturated green plus right-side position/pattern
- Off-target: white/neutral with a distinct hollow or striped shape
- Yellow equipment diagnostic: amber/yellow plus equipment icon
- White equipment fault: white plus fault icon/outline
- Yellow penalty card: yellow card silhouette beside score
- Failure: destructive red with icon and text
- Passed: green with check icon and text
- Planned: neutral outline
- Playback/cutoff markers: blue family with different dash/shape patterns
- Blade/parry: orange with a center-lane position

### shadcn/ui component map

- App shell: `Sidebar`, `Resizable`, `Scroll Area`
- Scenario search: `Command`, `Input`
- Filters: `Select`, `Toggle Group`, `Popover`
- Status and weapon: `Badge`
- Primary actions: `Button`, `Button Group`, `Dropdown Menu`
- Timeline scrub/zoom: `Slider`, `Progress`, `Tooltip`
- Mobile navigation and inspector: `Sheet`, `Drawer`
- Event details: `Accordion`, `Table`, `Separator`
- Empty/error/loading: `Alert`, `Empty`, `Skeleton`, `Spinner`
- Shortcut help and destructive confirmation: `Dialog`, `Alert Dialog`, `Kbd`

Use components from the current [shadcn/ui component catalog](https://ui.shadcn.com/docs/components). Do not introduce a
second design system inside the page.

### Frontend and scoring architecture

The simulator now has a React, Tailwind CSS, and shadcn-compatible application boundary under `apps/scoring/simulator`.
Its browser UI fetches reports from the scenario service and imports the shared display projection. The current service
still executes the TypeScript scoring engines.

`CW-00` through `CW-22` in the [C17 WebAssembly migration plan](c17-wasm-simulator-migration.md) replace that backend
with the same C17 core linked into STM32 firmware. During shadow comparison, TypeScript and WebAssembly results remain
separate and any mismatch fails visibly. After cutover, every Run action uses WebAssembly; a missing, incompatible, or
trapped module shows **Authoritative result unavailable** and never invokes a TypeScript scoring fallback.

## Required states

The Figma component set and prototype must demonstrate:

- Initial loading
- Corpus loaded, no scenario selected
- Selected executable scenario, not run
- Running scenario
- Paused scenario
- Passed scenario
- Failed scenario with selected mismatch
- Passed scenario whose expected and actual result are both rejected
- Failed comparison whose actual result is accepted and remains visible
- Planned requirement
- Authoritative result unavailable
- Accepted safe-inactive display
- Left and right valid touch
- Foil off-target
- Yellow equipment diagnostic on and cleared
- White equipment fault latched
- Yellow penalty card for each side
- Latched primary touch coexisting with yellow and white diagnostics
- Blade/parry history
- Late hit
- Whipover
- Lockout/cutoff review
- Non-monotonic declared timestamp with clamped playback coordinate
- Run-all progress and run-all stopped on failure
- Empty search result
- Server/API error with Retry
- Mobile scenario sheet and event inspector
- Reduced-motion playback

## Accessibility requirements

- Target WCAG 2.2 AA.
- Complete keyboard operation with visible focus.
- Scenario selection uses `aria-current`; do not misuse toggle-button state.
- Playback changes announce event number, authoritative-result availability, raw time, playback time when different,
  primary lamps, yellow diagnostics, white diagnostics, buzzer request, score, cards, and timer.
- Use one bounded polite `aria-live` region for selected-event and run-state changes. Announce at most once per discrete
  event transition; never announce animation frames or every pixel update.
- Provide a textual equivalent for every canvas state. Canvas pixels are never the only source of information.
- The timeline supports keyboard navigation between every event, including coincident markers.
- Respect `prefers-reduced-motion`; Play advances one state at a time or uses no continuous animation.
- Touch targets are at least 44 × 44 px for primary mobile controls.
- All status icons have adjacent text or an accessible name.
- Validate color contrast in default, hover, selected, disabled, and illuminated states.

## Data and authority contract for design

The designer should use realistic fixture data with these concepts. This is a handoff model, not a promise that every
reserved bout field exists in the current runner:

```ts
type SimulatorItem = ExecutableScenario | PlannedRequirement

type ExecutableScenario = {
  itemKind: "scenario"
  scenarioId: string
  title: string
  description: string
  weapon: "epee" | "foil" | "sabre"
  ruleRevision: string
  evaluationStatus: "not-run" | "running" | "passed" | "failed"
  result: ActualResultState
  events: SimulatorEvent[]
  projection: DisplayProjection
  boutState?: BoutState
}

type PlannedRequirement = {
  itemKind: "requirement"
  requirementId: string
  title: string
  description: string
  weapon: "epee" | "foil" | "sabre" | "all"
  whyNotExecutable: string
}

type SimulatorEvent = {
  id: string
  kind: "input" | "expected" | "output" | "diagnostic" | "uncertainty" | "rejection" | "bout-state"
  atUs: number
  playbackAtUs: number
  side?: "left" | "right"
  sourceInputIds?: string[]
}

type DisplayProjection = {
  authoritativeResult: "available" | "unavailable"
  weapon: "epee" | "foil" | "sabre"
  leftPrimary: "off" | "valid-hit" | "off-target"
  rightPrimary: "off" | "valid-hit" | "off-target"
  leftYellow: boolean
  rightYellow: boolean
  leftWhite: boolean
  rightWhite: boolean
  leftContact: boolean
  rightContact: boolean
  leftFault: boolean
  rightFault: boolean
  bladeContact: boolean
  audibleRequested: boolean
  eventNumber: number
  eventCount: number
  cursorAtUs: number
}

type ActualResultState =
  | {
      actualStatus: "accepted"
      authoritativeResult: "available"
      unavailableReason?: never
    }
  | {
      actualStatus: "rejected"
      authoritativeResult: "unavailable"
      unavailableReason: "rejected"
    }
  | {
      actualStatus: null
      authoritativeResult: "unavailable"
      unavailableReason: "missing" | "malformed" | "unknown"
    }

type BoutState = {
  leftScore?: number
  rightScore?: number
  remainingMs?: number
  period?: number
  priority?: "left" | "right" | "none"
  leftCards?: CardState
  rightCards?: CardState
}

type CardState = {
  yellow: boolean
  redCount: number
  passivity?: "none" | "p-yellow" | "p-red"
}
```

The first production implementation may not yet have authoritative score, card, period, or timer events in every golden
scenario. The design must support them without deriving them from hit decisions. Missing fields render as not modeled,
not zero.

Expected assertions use a visually separate lane and cannot illuminate the display. Only accepted authoritative result
events may alter primary lamps, diagnostics, audio-request state, or bout state.

## Designer deliverables

Provide:

1. Figma foundations: color, typography, spacing, radii, elevation, focus, and semantic status tokens
2. Component variants for every scenario row, indicator, timeline event, control, inspector section, and empty/error state
3. Desktop, laptop, tablet, and mobile page compositions
4. Weapon-specific 64 × 32 display variants for Épée, Foil, and Sabre
5. Prototype flows:
   - Find and run one scenario
   - Step through a double touch
   - Inspect a late hit and lockout cutoff
   - Inspect yellow and white diagnostics while a primary touch remains latched
   - Review an unavailable actual result and a separate intentionally rejected but passing test
   - Run all tests and stop on a failure
6. Keyboard and screen-reader annotations
7. Redlines for timeline geometry, responsive behavior, and the 64 × 32 pixel mapping
8. A state-coverage page matching every row in **Required states**
9. A handoff note identifying any visual element that depends on data not yet present in the scenario contract

## Design acceptance checklist

The design is ready for implementation only when:

- Every executable and planned item has an unambiguous identity and status.
- A user can understand a scenario without opening raw JSON.
- Primary touch, off-target, yellow equipment, white fault, yellow penalty card, and blade contact are distinguishable
  without relying on hue alone.
- Score, timer, weapon, period/priority, and cards fit inside the 64 × 32 concept at all required variants.
- The apparatus timeline and inspection timeline visibly represent the same selected event.
- Previous, Play/Pause, Next, Restart, speed, and Run all have complete states and keyboard behavior.
- A rejected, missing, or malformed actual result cannot retain illumination from a previous scenario. A failed
  comparison with an accepted actual result continues to show that authoritative actual state beside the mismatch.
- Declared backward timestamps remain visible without moving the playback cursor backward.
- Desktop and mobile retain the display, selected identity, status, and playback controls above the fold.
- The 390 px layout has no horizontal page overflow.
- The visual system is recognizably shadcn/ui-based but not a stock dashboard or a copy of Skewered.

## Explicit non-goals for this design pass

- Live control of physical scoring hardware
- Remote firmware update controls
- Referee tournament-management workflows beyond rendering supplied bout state
- Video replay editing
- Fabrication or physical LED photometry proof
- Browser-side scoring qualification
- Copying or tracing Skewered artwork, screenshots, assets, pixel maps, layout measurements, code, copy, or animations
- Making a patent-scope assumption without legal review
