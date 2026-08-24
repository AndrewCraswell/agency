/**
 * RC-02's versioned, language-neutral host fixtures.
 *
 * These values are deliberately handwritten. The fixture module must not use
 * a parser, reducer, or command factory to derive its expected values: a
 * parser change must make the fixture tests fail instead of updating their
 * oracle at the same time.
 */
import {
  REMOTE_CONTROL_SCHEMA_VERSION,
  type BoutStateEvent,
  type BoutWorkflowSnapshot,
  type ControllerAuthority,
  type RemoteCommand
} from "./remote-control.js"

export const REMOTE_CONTROL_GOLDEN_FIXTURE_VERSION = "rc-02-golden-1.0.0" as const

export const GOLDEN_REMOTE_COMMAND_KEYS = Object.freeze([
  "score.increment.left",
  "score.increment.right",
  "score.decrement.left",
  "score.decrement.right",
  "clock.toggle",
  "clock.adjust.positive",
  "clock.adjust.negative",
  "clock.loadConfigured",
  "clock.configure",
  "clock.loadOneMinute",
  "format.advance",
  "format.retreat",
  "penalty.award.left",
  "penalty.award.right",
  "passivityPenalty.award.left",
  "passivityPenalty.award.right",
  "break.start.oneMinute",
  "medical.start",
  "overtime.toggle",
  "workflow.undo",
  "sides.swap",
  "weapon.showOrAdvance",
  "modifier.opt",
  "scoring.rearm",
  "scoring.autoRearm.advance",
  "cards.reset",
  "bout.new",
  "device.sleep.request",
  "bout.snapshot.load",
  "controller.authority.transfer",
  "priority.assign.supervisor",
  "score.clear.supervisor"
] as const)

export type RemoteControlGoldenCommandKey = (typeof GOLDEN_REMOTE_COMMAND_KEYS)[number]

export const GOLDEN_HANDHELD_REFEREE_AUTHORITY = {
  authorityRevision: 10,
  controllerId: "remote-referee-01",
  kind: "paired-handheld",
  permission: "referee"
} as const satisfies ControllerAuthority

export const GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY = {
  authorityRevision: 11,
  controllerId: "local-supervisor-01",
  kind: "local-application",
  permission: "supervisor"
} as const satisfies ControllerAuthority

export const GOLDEN_TOURNAMENT_SUPERVISOR_AUTHORITY = {
  authorityRevision: 12,
  controllerId: "tournament-supervisor-01",
  kind: "tournament-controller",
  permission: "supervisor"
} as const satisfies ControllerAuthority

const GOLDEN_BASE_SNAPSHOT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  autoRearm: "manual",
  boutId: "bout-rc02-20260824-01",
  boutRevision: 4,
  clock: {
    configuredDurationCentiseconds: 18_000,
    mode: "bout",
    remainingDurationCentiseconds: 12_340,
    status: "stopped"
  },
  competition: { kind: "period", value: 2 },
  competitionFormatAuthority: {
    ownerId: "scoring-product-rules",
    registryDigest: "sha256:8ccfc9c878c8758bde503fec7bba2f81308da66528b3b7b6ab1e4b8046770d98",
    registryId: "prototype-bout-format-registry",
    registryRevision: "2026-08-23.1"
  },
  eventRevision: 23,
  lastScoredSide: "left",
  medical: null,
  passivity: null,
  priority: null,
  priorityEntropyReceipt: null,
  sides: {
    left: { pCard: "none", redCardCount: 0, score: 4, yellowCard: true },
    right: { pCard: "yellow", redCardCount: 0, score: 2, yellowCard: true }
  },
  sourceCommandDisposition: "accepted",
  sourceCommandIdentity: {
    apparatusId: "apparatus-rc02-01",
    commandId: "rc02-command-score-increment-left",
    controllerId: "remote-referee-01",
    counter: 1001,
    remoteId: "ir-remote-01"
  },
  stm32RecordId: null,
  timingConfigurationRevision: "timing-2026-08-24",
  weapon: "epee"
} as const satisfies BoutWorkflowSnapshot

export const GOLDEN_LOADED_SNAPSHOT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY,
  autoRearm: "three-seconds",
  boutId: "bout-rc02-loaded-01",
  boutRevision: 8,
  clock: {
    configuredDurationCentiseconds: 18_000,
    mode: "bout",
    remainingDurationCentiseconds: 8_765,
    status: "stopped"
  },
  competition: { kind: "match", value: 3 },
  competitionFormatAuthority: {
    ownerId: "scoring-product-rules",
    registryDigest: "sha256:8ccfc9c878c8758bde503fec7bba2f81308da66528b3b7b6ab1e4b8046770d98",
    registryId: "prototype-bout-format-registry",
    registryRevision: "2026-08-23.1"
  },
  eventRevision: 40,
  lastScoredSide: "right",
  medical: {
    configuredDurationCentiseconds: 300_000,
    remainingDurationCentiseconds: 300_000,
    status: "stopped"
  },
  passivity: {
    configuredDurationCentiseconds: 6_000,
    remainingDurationCentiseconds: 6_000,
    status: "stopped"
  },
  priority: null,
  priorityEntropyReceipt: null,
  sides: {
    left: { pCard: "yellow", redCardCount: 1, score: 7, yellowCard: true },
    right: { pCard: "none", redCardCount: 0, score: 9, yellowCard: false }
  },
  sourceCommandDisposition: "accepted",
  sourceCommandIdentity: {
    apparatusId: "apparatus-rc02-01",
    commandId: "rc02-command-bout-snapshot-load",
    controllerId: "local-supervisor-01",
    counter: 1029,
    remoteId: null
  },
  stm32RecordId: null,
  timingConfigurationRevision: "timing-2026-08-24",
  weapon: "foil"
} as const satisfies BoutWorkflowSnapshot

export const GOLDEN_OVERTIME_SNAPSHOT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  autoRearm: "one-second",
  boutId: "bout-rc02-overtime-01",
  boutRevision: 5,
  clock: {
    configuredDurationCentiseconds: 18_000,
    mode: "overtime",
    remainingDurationCentiseconds: 4_321,
    status: "running"
  },
  competition: { kind: "period", value: 3 },
  competitionFormatAuthority: {
    ownerId: "scoring-product-rules",
    registryDigest: "sha256:8ccfc9c878c8758bde503fec7bba2f81308da66528b3b7b6ab1e4b8046770d98",
    registryId: "prototype-bout-format-registry",
    registryRevision: "2026-08-23.1"
  },
  eventRevision: 31,
  lastScoredSide: "right",
  medical: null,
  passivity: null,
  priority: "right",
  priorityEntropyReceipt: {
    bit: 1,
    ownerId: "priority-entropy-owner",
    ownerRevision: "priority-entropy-2026-08-24-01",
    sampleId: "priority-sample-2026-08-24-01"
  },
  sides: {
    left: { pCard: "none", redCardCount: 0, score: 14, yellowCard: false },
    right: { pCard: "none", redCardCount: 0, score: 14, yellowCard: false }
  },
  sourceCommandDisposition: "accepted",
  sourceCommandIdentity: {
    apparatusId: "apparatus-rc02-01",
    commandId: "rc02-command-overtime-toggle",
    controllerId: "remote-referee-01",
    counter: 1019,
    remoteId: "ir-remote-01"
  },
  stm32RecordId: null,
  timingConfigurationRevision: "timing-2026-08-24",
  weapon: "sabre"
} as const satisfies BoutWorkflowSnapshot

export const GOLDEN_NEW_BOUT_SNAPSHOT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY,
  autoRearm: "manual",
  boutId: "bout-rc02-new-20260824-01",
  boutRevision: 1,
  clock: {
    configuredDurationCentiseconds: 18_000,
    mode: "bout",
    remainingDurationCentiseconds: 18_000,
    status: "stopped"
  },
  competition: { kind: "period", value: 1 },
  competitionFormatAuthority: {
    ownerId: "scoring-product-rules",
    registryDigest: "sha256:8ccfc9c878c8758bde503fec7bba2f81308da66528b3b7b6ab1e4b8046770d98",
    registryId: "prototype-bout-format-registry",
    registryRevision: "2026-08-23.1"
  },
  eventRevision: 25,
  lastScoredSide: null,
  medical: null,
  passivity: null,
  priority: null,
  priorityEntropyReceipt: null,
  sides: {
    left: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false },
    right: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false }
  },
  sourceCommandDisposition: "accepted",
  sourceCommandIdentity: {
    apparatusId: "apparatus-rc02-01",
    commandId: "rc02-command-bout-new",
    controllerId: "local-supervisor-01",
    counter: 1027,
    remoteId: null
  },
  stm32RecordId: "stm32-reset-rc02-new-01",
  timingConfigurationRevision: "timing-2026-08-24",
  weapon: "epee"
} as const satisfies BoutWorkflowSnapshot

export const GOLDEN_AUTHORITY_TRANSFER_SNAPSHOT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_TOURNAMENT_SUPERVISOR_AUTHORITY,
  autoRearm: "manual",
  boutId: "bout-rc02-20260824-01",
  boutRevision: 4,
  clock: {
    configuredDurationCentiseconds: 18_000,
    mode: "bout",
    remainingDurationCentiseconds: 12_340,
    status: "stopped"
  },
  competition: { kind: "period", value: 2 },
  competitionFormatAuthority: {
    ownerId: "scoring-product-rules",
    registryDigest: "sha256:8ccfc9c878c8758bde503fec7bba2f81308da66528b3b7b6ab1e4b8046770d98",
    registryId: "prototype-bout-format-registry",
    registryRevision: "2026-08-23.1"
  },
  eventRevision: 24,
  lastScoredSide: "left",
  medical: null,
  passivity: null,
  priority: null,
  priorityEntropyReceipt: null,
  sides: {
    left: { pCard: "none", redCardCount: 0, score: 4, yellowCard: true },
    right: { pCard: "yellow", redCardCount: 0, score: 2, yellowCard: true }
  },
  sourceCommandDisposition: "accepted",
  sourceCommandIdentity: {
    apparatusId: "apparatus-rc02-01",
    commandId: "rc02-command-authority-transfer",
    controllerId: "local-supervisor-01",
    counter: 1030,
    remoteId: null
  },
  stm32RecordId: null,
  timingConfigurationRevision: "timing-2026-08-24",
  weapon: "epee"
} as const satisfies BoutWorkflowSnapshot

const GOLDEN_SCORE_INCREMENT_LEFT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "score.increment.left",
  commandId: "rc02-command-score-increment-left",
  counter: 1001,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_SCORE_INCREMENT_RIGHT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "score.increment.right",
  commandId: "rc02-command-score-increment-right",
  counter: 1002,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_SCORE_DECREMENT_LEFT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "score.decrement.left",
  commandId: "rc02-command-score-decrement-left",
  counter: 1003,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_SCORE_DECREMENT_RIGHT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "score.decrement.right",
  commandId: "rc02-command-score-decrement-right",
  counter: 1004,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_CLOCK_TOGGLE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "clock.toggle",
  commandId: "rc02-command-clock-toggle",
  counter: 1005,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_CLOCK_ADJUST_POSITIVE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "clock.adjust.positive",
  commandId: "rc02-command-clock-adjust-positive",
  counter: 1006,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_CLOCK_ADJUST_NEGATIVE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "clock.adjust.negative",
  commandId: "rc02-command-clock-adjust-negative",
  counter: 1007,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_CLOCK_LOAD_CONFIGURED = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "clock.loadConfigured",
  commandId: "rc02-command-clock-load-configured",
  counter: 1008,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_CLOCK_CONFIGURE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "clock.configure",
  commandId: "rc02-command-clock-configure",
  counter: 1009,
  payload: { minutes: 2, seconds: 37 },
  pressKind: "modified",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_CLOCK_LOAD_ONE_MINUTE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "clock.loadOneMinute",
  commandId: "rc02-command-clock-load-one-minute",
  counter: 1010,
  payload: {},
  pressKind: "double",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_FORMAT_ADVANCE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "format.advance",
  commandId: "rc02-command-format-advance",
  counter: 1011,
  payload: {},
  pressKind: "modified",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_FORMAT_RETREAT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "format.retreat",
  commandId: "rc02-command-format-retreat",
  counter: 1012,
  payload: {},
  pressKind: "modified",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_PENALTY_AWARD_LEFT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "penalty.award.left",
  commandId: "rc02-command-penalty-award-left",
  counter: 1013,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_PENALTY_AWARD_RIGHT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "penalty.award.right",
  commandId: "rc02-command-penalty-award-right",
  counter: 1014,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_PASSIVITY_AWARD_LEFT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "passivityPenalty.award.left",
  commandId: "rc02-command-passivity-award-left",
  counter: 1015,
  payload: {},
  pressKind: "modified",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_PASSIVITY_AWARD_RIGHT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "passivityPenalty.award.right",
  commandId: "rc02-command-passivity-award-right",
  counter: 1016,
  payload: {},
  pressKind: "modified",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_BREAK_START = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "break.start.oneMinute",
  commandId: "rc02-command-break-start-one-minute",
  counter: 1017,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_MEDICAL_START = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "medical.start",
  commandId: "rc02-command-medical-start",
  counter: 1018,
  payload: {},
  pressKind: "modified",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_OVERTIME_TOGGLE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "overtime.toggle",
  commandId: "rc02-command-overtime-toggle",
  counter: 1019,
  payload: {},
  pressKind: "held",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_WORKFLOW_UNDO = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "workflow.undo",
  commandId: "rc02-command-workflow-undo",
  counter: 1020,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_SIDES_SWAP = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "sides.swap",
  commandId: "rc02-command-sides-swap",
  counter: 1021,
  payload: {},
  pressKind: "modified",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_WEAPON_SHOW_OR_ADVANCE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "weapon.showOrAdvance",
  commandId: "rc02-command-weapon-show-or-advance",
  counter: 1022,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_MODIFIER_OPT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "modifier.opt",
  commandId: "rc02-command-modifier-opt",
  counter: 1023,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_SCORING_REARM = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "scoring.rearm",
  commandId: "rc02-command-scoring-rearm",
  counter: 1024,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_AUTO_REARM_ADVANCE = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "scoring.autoRearm.advance",
  commandId: "rc02-command-auto-rearm-advance",
  counter: 1025,
  payload: {},
  pressKind: "modified",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_CARDS_RESET = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "cards.reset",
  commandId: "rc02-command-cards-reset",
  counter: 1026,
  payload: {},
  pressKind: "direct",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_NEW_BOUT = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY,
  command: "bout.new",
  commandId: "rc02-command-bout-new",
  counter: 1027,
  payload: {},
  pressKind: "modified",
  remoteId: null,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_DEVICE_SLEEP_REQUEST = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  command: "device.sleep.request",
  commandId: "rc02-command-device-sleep-request",
  counter: 1028,
  payload: {},
  pressKind: "held",
  remoteId: "ir-remote-01",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_SNAPSHOT_LOAD = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY,
  command: "bout.snapshot.load",
  commandId: "rc02-command-bout-snapshot-load",
  counter: 1029,
  payload: { snapshot: GOLDEN_LOADED_SNAPSHOT },
  pressKind: "direct",
  remoteId: null,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_AUTHORITY_TRANSFER = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY,
  command: "controller.authority.transfer",
  commandId: "rc02-command-authority-transfer",
  counter: 1030,
  payload: { nextAuthority: GOLDEN_TOURNAMENT_SUPERVISOR_AUTHORITY },
  pressKind: "direct",
  remoteId: null,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_PRIORITY_ASSIGN = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY,
  command: "priority.assign.supervisor",
  commandId: "rc02-command-priority-assign",
  counter: 1031,
  payload: { side: "right" },
  pressKind: "direct",
  remoteId: null,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

const GOLDEN_SCORE_CLEAR = {
  apparatusId: "apparatus-rc02-01",
  authority: GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY,
  command: "score.clear.supervisor",
  commandId: "rc02-command-score-clear",
  counter: 1032,
  payload: {},
  pressKind: "direct",
  remoteId: null,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} as const satisfies RemoteCommand

export const GOLDEN_REMOTE_COMMANDS = {
  "score.increment.left": GOLDEN_SCORE_INCREMENT_LEFT,
  "score.increment.right": GOLDEN_SCORE_INCREMENT_RIGHT,
  "score.decrement.left": GOLDEN_SCORE_DECREMENT_LEFT,
  "score.decrement.right": GOLDEN_SCORE_DECREMENT_RIGHT,
  "clock.toggle": GOLDEN_CLOCK_TOGGLE,
  "clock.adjust.positive": GOLDEN_CLOCK_ADJUST_POSITIVE,
  "clock.adjust.negative": GOLDEN_CLOCK_ADJUST_NEGATIVE,
  "clock.loadConfigured": GOLDEN_CLOCK_LOAD_CONFIGURED,
  "clock.configure": GOLDEN_CLOCK_CONFIGURE,
  "clock.loadOneMinute": GOLDEN_CLOCK_LOAD_ONE_MINUTE,
  "format.advance": GOLDEN_FORMAT_ADVANCE,
  "format.retreat": GOLDEN_FORMAT_RETREAT,
  "penalty.award.left": GOLDEN_PENALTY_AWARD_LEFT,
  "penalty.award.right": GOLDEN_PENALTY_AWARD_RIGHT,
  "passivityPenalty.award.left": GOLDEN_PASSIVITY_AWARD_LEFT,
  "passivityPenalty.award.right": GOLDEN_PASSIVITY_AWARD_RIGHT,
  "break.start.oneMinute": GOLDEN_BREAK_START,
  "medical.start": GOLDEN_MEDICAL_START,
  "overtime.toggle": GOLDEN_OVERTIME_TOGGLE,
  "workflow.undo": GOLDEN_WORKFLOW_UNDO,
  "sides.swap": GOLDEN_SIDES_SWAP,
  "weapon.showOrAdvance": GOLDEN_WEAPON_SHOW_OR_ADVANCE,
  "modifier.opt": GOLDEN_MODIFIER_OPT,
  "scoring.rearm": GOLDEN_SCORING_REARM,
  "scoring.autoRearm.advance": GOLDEN_AUTO_REARM_ADVANCE,
  "cards.reset": GOLDEN_CARDS_RESET,
  "bout.new": GOLDEN_NEW_BOUT,
  "device.sleep.request": GOLDEN_DEVICE_SLEEP_REQUEST,
  "bout.snapshot.load": GOLDEN_SNAPSHOT_LOAD,
  "controller.authority.transfer": GOLDEN_AUTHORITY_TRANSFER,
  "priority.assign.supervisor": GOLDEN_PRIORITY_ASSIGN,
  "score.clear.supervisor": GOLDEN_SCORE_CLEAR
} as const satisfies Readonly<Record<RemoteControlGoldenCommandKey, RemoteCommand>>

export const GOLDEN_SNAPSHOT = GOLDEN_BASE_SNAPSHOT

export const GOLDEN_APPLIED_SCORE_EVENT = {
  cause: "score.increment",
  disposition: "accepted",
  eventId: "rc02-event-score-increment-left",
  eventRevision: 23,
  rejectionReason: null,
  resultingBoutState: GOLDEN_BASE_SNAPSHOT,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION,
  sourceCommand: GOLDEN_SCORE_INCREMENT_LEFT,
  stm32RecordId: null
} as const satisfies BoutStateEvent

export const GOLDEN_APPLIED_SNAPSHOT_LOAD_EVENT = {
  cause: "bout.snapshot.load",
  disposition: "accepted",
  eventId: "rc02-event-bout-snapshot-load",
  eventRevision: 40,
  rejectionReason: null,
  resultingBoutState: GOLDEN_LOADED_SNAPSHOT,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION,
  sourceCommand: GOLDEN_SNAPSHOT_LOAD,
  stm32RecordId: null
} as const satisfies BoutStateEvent

export const GOLDEN_APPLIED_NEW_BOUT_EVENT = {
  cause: "bout.reset.result",
  disposition: "accepted",
  eventId: "rc02-event-bout-new",
  eventRevision: 25,
  rejectionReason: null,
  resultingBoutState: GOLDEN_NEW_BOUT_SNAPSHOT,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION,
  sourceCommand: GOLDEN_NEW_BOUT,
  stm32RecordId: "stm32-reset-rc02-new-01"
} as const satisfies BoutStateEvent

export const GOLDEN_APPLIED_AUTHORITY_TRANSFER_EVENT = {
  cause: "controller.authority.transfer",
  disposition: "accepted",
  eventId: "rc02-event-authority-transfer",
  eventRevision: 24,
  rejectionReason: null,
  resultingBoutState: GOLDEN_AUTHORITY_TRANSFER_SNAPSHOT,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION,
  sourceCommand: GOLDEN_AUTHORITY_TRANSFER,
  stm32RecordId: null
} as const satisfies BoutStateEvent

export const GOLDEN_APPLIED_EVENTS = [
  GOLDEN_APPLIED_SCORE_EVENT,
  GOLDEN_APPLIED_SNAPSHOT_LOAD_EVENT,
  GOLDEN_APPLIED_NEW_BOUT_EVENT,
  GOLDEN_APPLIED_AUTHORITY_TRANSFER_EVENT
] as const satisfies readonly BoutStateEvent[]

export const GOLDEN_REJECTED_EVENT = {
  cause: "command.rejected",
  disposition: "rejected",
  eventId: "rc02-event-rejected-wrong-authority",
  eventRevision: 41,
  rejectionReason: "wrong-controller-authority",
  resultingBoutState: null,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION,
  sourceCommand: GOLDEN_SCORE_INCREMENT_LEFT,
  stm32RecordId: null
} as const satisfies BoutStateEvent

export const GOLDEN_REJECTED_EVENTS = [GOLDEN_REJECTED_EVENT] as const satisfies readonly BoutStateEvent[]

export const GOLDEN_EMPTY_STATE_VALUES = [
  {},
  null,
  undefined,
  { apparatusId: "apparatus-rc02-01", boutId: "bout-without-required-state" },
  { snapshot: {} }
] as const

export const GOLDEN_INVALID_STATE_VALUES = [
  { ...GOLDEN_BASE_SNAPSHOT, eventRevision: -1 },
  { ...GOLDEN_BASE_SNAPSHOT, priority: "left" },
  {
    ...GOLDEN_BASE_SNAPSHOT,
    clock: { ...GOLDEN_BASE_SNAPSHOT.clock, remainingDurationCentiseconds: 18_001 }
  },
  {
    ...GOLDEN_BASE_SNAPSHOT,
    timingConfigurationRevision: "timing-2026-08-24",
    timing_configuration_revision: "timing-2026-08-24"
  },
  {
    ...GOLDEN_BASE_SNAPSHOT,
    sourceCommandDisposition: "rejected",
    stm32RecordId: "stm32-record-must-be-null"
  }
] as const

function freezeDeep<const Value>(value: Value): Value {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeDeep(nested)
    Object.freeze(value)
  }

  return value
}

export const REMOTE_CONTROL_GOLDEN_FIXTURES = freezeDeep({
  fixtureVersion: REMOTE_CONTROL_GOLDEN_FIXTURE_VERSION,
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION,
  commandKeys: GOLDEN_REMOTE_COMMAND_KEYS,
  commands: GOLDEN_REMOTE_COMMANDS,
  snapshots: {
    base: GOLDEN_BASE_SNAPSHOT,
    loaded: GOLDEN_LOADED_SNAPSHOT,
    overtime: GOLDEN_OVERTIME_SNAPSHOT,
    newBout: GOLDEN_NEW_BOUT_SNAPSHOT,
    authorityTransfer: GOLDEN_AUTHORITY_TRANSFER_SNAPSHOT
  },
  appliedEvents: GOLDEN_APPLIED_EVENTS,
  rejectedEvents: GOLDEN_REJECTED_EVENTS,
  emptyStateValues: GOLDEN_EMPTY_STATE_VALUES,
  invalidStateValues: GOLDEN_INVALID_STATE_VALUES
} as const)

freezeDeep(GOLDEN_REMOTE_COMMANDS)
freezeDeep(GOLDEN_APPLIED_EVENTS)
freezeDeep(GOLDEN_REJECTED_EVENTS)
freezeDeep(GOLDEN_EMPTY_STATE_VALUES)
freezeDeep(GOLDEN_INVALID_STATE_VALUES)
