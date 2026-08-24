# Referee remote button reference

**Status:** pre-prototype canonical operator lookup
**Applies to:** handheld face, simulator controls, apparatus input service, acceptance tests, and manufacturer package
**Behavior authority:** [encrypted IR remote-control contract](encrypted-ir-remote-control-contract.md)

## How to use the controls

- A direct press performs the operation printed on the face.
- Hold `OPT`, press the other control, then release it for a modified operation. The apparatus must receive only the
  modified command.
- A guarded operation is accepted only while the bout clock is stopped and after the apparatus displays its full scope.
- A held or double press generates one command. It never repeats while the button remains down.
- The remote transmission LED means that the remote transmitted. Only apparatus feedback means accepted or rejected.

The pre-prototype industrial design must label `Back`, `Rearm`, `Reset Cards`, and `Load Time` explicitly. The supplied
reference photograph is an operation inventory, not approved production artwork.

## Face layout

| Left | Center | Right |
| --- | --- | --- |
| Left score `+` | `Start/Stop` | Right score `+` |
| Left card | `Pause 1 min` | Right card |
| Left score `-` | `+Time` | Right score `-` |
| `Back` | `OPT` | `Rearm` |
| `Reset Cards` | `-Time` | `Load Time` |

## Face lookup

| Face position | Production label | Direct press | `OPT` modified | Held or double action | Canonical command key | Primary guard/result |
| --- | --- | --- | --- | --- | --- | --- |
| Top left | Left score `+` | Add one to left score. | Reserved. | No repeat. | `score.increment.left` | Accepted in allowed bout modes. |
| Top center | `Start/Stop` | Start or stop the bout clock. | Reserved for reviewed safety/test behavior. | No alternate action. | `clock.toggle` | Always direct; coupled passivity timing follows the accepted transition. |
| Top right | Right score `+` | Add one to right score. | Reserved. | No repeat. | `score.increment.right` | Accepted in allowed bout modes. |
| Second row left | Left card | Award the next applicable left penalty; a red award also adds one right score. | Award the next rules-valid left P-card. | No repeat and never remove a card. | `penalty.award.left`, `passivityPenalty.award.left` | Atomic card/score result; correct with Back or Reset Cards. |
| Second row center | `Pause 1 min` | Start a one-minute break. | Start the configured medical-intervention clock. | Enter one-minute overtime with random priority; repeat held action removes priority. | `break.start.oneMinute`, `medical.start`, `overtime.toggle` | Bout clock must be stopped. |
| Second row right | Right card | Award the next applicable right penalty; a red award also adds one left score. | Award the next rules-valid right P-card. | No repeat and never remove a card. | `penalty.award.right`, `passivityPenalty.award.right` | Atomic card/score result; correct with Back or Reset Cards. |
| Third row left | Left score `-` | Remove one left score, floor zero. | Reserved. | No repeat. | `score.decrement.left` | Rejected at zero. |
| Third row center | `+Time` | Add one second, or one hundredth inside the stopped final ten seconds. | Increment the configured match/period field. | No repeat. | `clock.adjust.positive`, `format.advance` | Bout clock must be stopped. |
| Third row right | Right score `-` | Remove one right score, floor zero. | Reserved. | No repeat. | `score.decrement.right` | Rejected at zero. |
| Fourth row left | `Back` | Undo the most recent reversible referee workflow action by applying a compensating event. | Swap left/right workflow presentation and ownership. | No destructive repeat. | `workflow.undo`, `sides.swap` | Never rewrites history or changes an immutable STM32 decision. |
| Fourth row center | `OPT` | Show weapon; a second standalone press in the selection window requests the next weapon. | Acts as the modifier for the paired control. | Hold alone opens local configuration only after the reviewed threshold. | `weapon.showOrAdvance`, `modifier.opt` | A chord must not also emit the standalone command. |
| Fourth row right | `Rearm` | Request manual rearm. | Advance auto-rearm through manual, one, three, and five seconds. | No repeat. | `scoring.rearm`, `scoring.autoRearm.advance` | Distinct from reset, new bout, and clock control. |
| Bottom left | `Reset Cards` | Clear penalty-card and P-card presentation only. | Guarded Reset All/New Bout. | Request sleep from safe idle. | `cards.reset`, `bout.new`, `device.sleep.request` | Reset/new-bout and sleep require stopped clocks and complete apparatus feedback. |
| Bottom center | `-Time` | Remove one second, or one hundredth inside the stopped final ten seconds; floor zero. | Decrement the configured match/period field. | No repeat. | `clock.adjust.negative`, `format.retreat` | Bout clock must be stopped. |
| Bottom right | `Load Time` | Load the configured start time. | Enter bounded `M:SS` configuration. | Double press loads one minute. | `clock.loadConfigured`, `clock.configure`, `clock.loadOneMinute` | Bout clock must be stopped; absent configuration is rejected. |

## Operations intentionally outside the handheld

| Operation | Owning interface | Reason |
| --- | --- | --- |
| Load or restore a complete bout snapshot | Authenticated application or tournament-controller API | Requires complete validation, revision/ownership checks, and an atomic state replacement. |
| Manually choose a priority side | Supervisor interface | Ordinary priority remains unbiased; overrides must be explicit and audited. |
| Timeline browse and forward navigation | Application review UI | Avoids displacing routine `Back`, `Rearm`, and side-swap controls. |
| Volume, venue profile, detailed weapon mode, pairing, and service diagnostics | Local configuration or authorized service UI | Infrequent configuration must not crowd routine referee actions. |
| Tournament next/previous/begin/end | Tournament-controller API | These are competition-management operations, not scoring-machine button semantics. |

## Apparatus feedback lookup

| Feedback | Meaning | Required operator response |
| --- | --- | --- |
| Accepted indication plus resulting state | The authenticated command passed every guard and was applied. | Continue only after the expected score, clock, card, priority, weapon, or mode is visible. |
| Rejected indication plus reason | No state was changed. | Correct the reported condition, such as running clock, invalid mode, bound, unavailable owner, or expired entry. |
| Remote transmission LED only | The handheld emitted an optical frame. | Do not treat this as apparatus acceptance. |
| Low-remote-battery indication on apparatus | Remaining operating margin is below the approved threshold. | Replace or recharge the remote under the venue procedure. |
| No apparatus response | Delivery or decoding is unavailable or obstructed. | Re-aim, move within the approved range, or use the authorized fallback; do not repeat a destructive command blindly. |

## Compatibility notes

The everyday model deliberately follows the Favero FA-15: direct Start/Stop and score controls, manual and automatic
rearm, load time, one-minute pause, medical pause, time correction, card-linked opponent scoring, Back, weapon selection,
side swap, and guarded reset-all. The project deliberately improves controller authentication, replay resistance,
state-load validation, rejection feedback, event history, and authority tracking. Published Favero behavior is comparison
evidence and never overrides current FIE rules or the project's scoring-authority boundary.
