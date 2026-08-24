/**
 * RC-01 executable ownership boundary for remote-control workflow requests.
 *
 * This module deliberately has no clock, scorer, transport, or decision-record
 * dependency. It accepts one active application-domain controller at a time and
 * turns the few requests that need scoring work into pending STM32 requests.
 */

import type { RemoteCommand } from "./remote-control.js"
import { isRemoteIdentifier } from "./remote-identifier.js"

export type ControllerKind = "paired-handheld" | "local-application" | "tournament-controller"

export type ControllerPermission = "referee" | "supervisor"

export type ControllerIdentity = Readonly<{
  controllerId: string
  kind: ControllerKind
  permission: ControllerPermission
}>

export type AuthorityState = Readonly<{
  activeController: ControllerIdentity | null
  authorityRevision: number
  pendingStm32RequestIds: readonly string[]
}>

export type AuthorityRequest =
  | Readonly<{
      controller: ControllerIdentity
      expectedAuthorityRevision: number
      requestId: string
      type: "bout-workflow-command"
    }>
  | Readonly<{
      controller: ControllerIdentity
      expectedAuthorityRevision: number
      requestId: string
      type: "snapshot-load-request"
    }>
  | Readonly<{
      controller: ControllerIdentity
      expectedAuthorityRevision: number
      requestId: string
      type: "scoring-rearm-request"
    }>
  | Readonly<{
      controller: ControllerIdentity
      expectedAuthorityRevision: number
      requestId: string
      type: "scoring-reset-request" | "weapon-change-request" | "bout-reset-request"
    }>
  | Readonly<{
      controller: ControllerIdentity
      expectedAuthorityRevision: number
      requestId: string
      targetController: ControllerIdentity
      type: "authority-transfer-request"
    }>

export type Stm32AuthorityResponse = Readonly<{
  authority: "stm32-scoring"
  requestId: string
  result: "accepted" | "rejected"
}>

export type AuthorityRejectionReason =
  | "authority-revision-mismatch"
  | "controller-kind-not-permitted"
  | "controller-permission-not-permitted"
  | "duplicate-request"
  | "malformed"
  | "no-active-controller"
  | "not-active-controller"
  | "pending-stm32-request"
  | "request-history-full"
  | "stm32-request-capacity"
  | "unknown-stm32-request"

export type AuthorityReceipt =
  | Readonly<{
      disposition: "application-applied"
      requestId: string
      state: AuthorityState
    }>
  | Readonly<{
      disposition: "stm32-pending"
      requestId: string
      state: AuthorityState
    }>
  | Readonly<{
      disposition: "stm32-accepted" | "stm32-rejected"
      requestId: string
      state: AuthorityState
    }>
  | Readonly<{
      disposition: "rejected"
      reason: AuthorityRejectionReason
      requestId: string | null
      state: AuthorityState
    }>

export type RemoteControlAuthority = Readonly<{
  receive: (request: unknown) => AuthorityReceipt
  receiveStm32Response: (response: unknown) => AuthorityReceipt
  readonly state: AuthorityState
}>

export type RemoteControlAuthorityOptions = Readonly<{
  activeController: ControllerIdentity | null
  authorityRevision: number
  maxPendingStm32Requests?: number
  maxRememberedRequestIds?: number
}>

const MAX_PENDING_STM32_REQUESTS = 32
const MAX_REMEMBERED_REQUEST_IDS = 256

/** Verifies all own descriptors before a parser reads even a discriminant. */
function isStrictPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) {
    return false
  }

  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") {
      return false
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return descriptor !== undefined && "value" in descriptor && descriptor.enumerable
  })
}

function hasExactlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value)

  return keys.length === expected.length && hasOnlyKeys(value, expected)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.includes(key))
}

function assertIdentifier(value: unknown, name: string): asserts value is string {
  if (!isRemoteIdentifier(value)) {
    throw new TypeError(`${name} must be a bounded opaque identifier`)
  }
}

function assertRevision(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Authority revisions must be non-negative safe integers")
  }
}

function parseControllerIdentity(value: unknown): ControllerIdentity {
  if (!isStrictPlainRecord(value) || !hasExactlyKeys(value, ["controllerId", "kind", "permission"])) {
    throw new TypeError("Controllers must contain only controllerId, kind, and permission")
  }

  assertIdentifier(value.controllerId, "Controller id")

  if (
    value.kind !== "paired-handheld" &&
    value.kind !== "local-application" &&
    value.kind !== "tournament-controller"
  ) {
    throw new TypeError("Controllers must declare a supported kind")
  }
  if (value.permission !== "referee" && value.permission !== "supervisor") {
    throw new TypeError("Controllers must declare referee or supervisor permission")
  }

  return { controllerId: value.controllerId, kind: value.kind, permission: value.permission }
}

function parseCommonRequest(
  value: Record<string, unknown>,
  type: string
): {
  readonly controller: ControllerIdentity
  readonly expectedAuthorityRevision: number
  readonly requestId: string
  readonly type: string
} {
  if (value.type !== type) {
    throw new TypeError("Authority requests must declare their exact supported type")
  }

  const controller = parseControllerIdentity(value.controller)
  assertRevision(value.expectedAuthorityRevision)
  assertIdentifier(value.requestId, "Request id")

  return { controller, expectedAuthorityRevision: value.expectedAuthorityRevision, requestId: value.requestId, type }
}

/** Strictly parses only the RC-01 request shapes; every unknown field fails closed. */
export function parseAuthorityRequest(value: unknown): AuthorityRequest {
  if (!isStrictPlainRecord(value)) {
    throw new TypeError("Authority requests must be plain objects with a supported type")
  }
  const type = value.type
  if (typeof type !== "string") {
    throw new TypeError("Authority requests must be plain objects with a supported type")
  }

  switch (type) {
    case "bout-workflow-command": {
      if (!hasExactlyKeys(value, ["controller", "expectedAuthorityRevision", "requestId", "type"])) {
        throw new TypeError("Bout workflow requests have an invalid shape")
      }
      const request = parseCommonRequest(value, type)
      return { ...request, type: "bout-workflow-command" }
    }
    case "snapshot-load-request": {
      if (!hasExactlyKeys(value, ["controller", "expectedAuthorityRevision", "requestId", "type"])) {
        throw new TypeError("Snapshot-load requests have an invalid shape")
      }
      const request = parseCommonRequest(value, type)
      return { ...request, type: "snapshot-load-request" }
    }
    case "scoring-rearm-request": {
      if (!hasExactlyKeys(value, ["controller", "expectedAuthorityRevision", "requestId", "type"])) {
        throw new TypeError("Scoring-rearm requests have an invalid shape")
      }
      const request = parseCommonRequest(value, type)
      return { ...request, type: "scoring-rearm-request" }
    }
    case "scoring-reset-request":
    case "weapon-change-request":
    case "bout-reset-request": {
      if (!hasExactlyKeys(value, ["controller", "expectedAuthorityRevision", "requestId", "type"])) {
        throw new TypeError("Supervisor scoring-transition requests have an invalid shape")
      }
      const request = parseCommonRequest(value, type)
      return { ...request, type }
    }
    case "authority-transfer-request": {
      if (
        !hasExactlyKeys(value, ["controller", "expectedAuthorityRevision", "requestId", "targetController", "type"])
      ) {
        throw new TypeError("Authority-transfer requests have an invalid shape")
      }
      const request = parseCommonRequest(value, type)
      return {
        ...request,
        targetController: parseControllerIdentity(value.targetController),
        type: "authority-transfer-request"
      }
    }
    default:
      throw new TypeError("Authority requests must declare a supported type")
  }
}

/**
 * Maps only the workflow-approved weapon action from RC-02 into an STM32
 * request. The caller must run the normal bout-workflow guards first; this
 * function cannot turn the first standalone OPT press into a weapon change.
 */
export function mapApprovedWeaponCommand(command: RemoteCommand): AuthorityRequest | null {
  if (command.command !== "weapon.showOrAdvance") {
    return null
  }

  return {
    controller: {
      controllerId: command.authority.controllerId,
      kind: command.authority.kind,
      permission: command.authority.permission
    },
    expectedAuthorityRevision: command.authority.authorityRevision,
    requestId: command.commandId,
    type: "weapon-change-request"
  }
}

/** Strictly parses a result emitted by the STM32 scoring authority. */
export function parseStm32AuthorityResponse(value: unknown): Stm32AuthorityResponse {
  if (!isStrictPlainRecord(value) || !hasExactlyKeys(value, ["authority", "requestId", "result"])) {
    throw new TypeError("STM32 authority responses have an invalid shape")
  }
  if (value.authority !== "stm32-scoring" || (value.result !== "accepted" && value.result !== "rejected")) {
    throw new TypeError("STM32 authority responses must identify a supported authority and result")
  }
  assertIdentifier(value.requestId, "Request id")

  return { authority: "stm32-scoring", requestId: value.requestId, result: value.result }
}

function sameController(left: ControllerIdentity, right: ControllerIdentity): boolean {
  return left.controllerId === right.controllerId && left.kind === right.kind && left.permission === right.permission
}

function copyState(
  activeController: ControllerIdentity | null,
  authorityRevision: number,
  pendingStm32RequestIds: readonly string[]
): AuthorityState {
  return {
    activeController: activeController === null ? null : { ...activeController },
    authorityRevision,
    pendingStm32RequestIds: [...pendingStm32RequestIds]
  }
}

function assertPositiveBound(value: unknown, fallback: number, description: string): number {
  if (value === undefined) {
    return fallback
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > fallback) {
    throw new TypeError(`${description} must be a positive safe integer within the supported bound`)
  }
  return value
}

/**
 * Creates the application-domain single-writer gate. A valid IR frame or API
 * credential is intentionally not enough: the caller must also be the active
 * controller at the exact authority revision.
 */
export function createRemoteControlAuthority(options: RemoteControlAuthorityOptions): RemoteControlAuthority {
  if (
    !isStrictPlainRecord(options) ||
    !hasOnlyKeys(options, [
      "activeController",
      "authorityRevision",
      "maxPendingStm32Requests",
      "maxRememberedRequestIds"
    ]) ||
    !Object.hasOwn(options, "activeController") ||
    !Object.hasOwn(options, "authorityRevision")
  ) {
    throw new TypeError("Authority options have an invalid shape")
  }

  const activeController = options.activeController === null ? null : parseControllerIdentity(options.activeController)
  assertRevision(options.authorityRevision)
  const maxPending = assertPositiveBound(
    options.maxPendingStm32Requests,
    MAX_PENDING_STM32_REQUESTS,
    "Maximum pending STM32 requests"
  )
  const maxRemembered = assertPositiveBound(
    options.maxRememberedRequestIds,
    MAX_REMEMBERED_REQUEST_IDS,
    "Maximum remembered request ids"
  )
  let currentController = activeController
  let currentRevision = options.authorityRevision
  const pendingStm32RequestIds: string[] = []
  const rememberedRequestIds = new Set<string>()

  function state(): AuthorityState {
    return copyState(currentController, currentRevision, pendingStm32RequestIds)
  }

  function reject(reason: AuthorityRejectionReason, requestId: string | null): AuthorityReceipt {
    return { disposition: "rejected", reason, requestId, state: state() }
  }

  function validateActiveController(request: AuthorityRequest): AuthorityReceipt | null {
    if (rememberedRequestIds.has(request.requestId)) {
      return reject("duplicate-request", request.requestId)
    }
    if (currentController === null) {
      return reject("no-active-controller", request.requestId)
    }
    if (request.expectedAuthorityRevision !== currentRevision) {
      return reject("authority-revision-mismatch", request.requestId)
    }
    if (!sameController(request.controller, currentController)) {
      return reject("not-active-controller", request.requestId)
    }
    if (rememberedRequestIds.size === maxRemembered) {
      return reject("request-history-full", request.requestId)
    }
    return null
  }

  function remember(requestId: string): void {
    rememberedRequestIds.add(requestId)
  }

  function receive(rawRequest: unknown): AuthorityReceipt {
    let request: AuthorityRequest
    try {
      request = parseAuthorityRequest(rawRequest)
    } catch {
      return reject("malformed", null)
    }

    const invalid = validateActiveController(request)
    if (invalid !== null) {
      return invalid
    }

    if (request.type === "snapshot-load-request" && request.controller.kind === "paired-handheld") {
      return reject("controller-kind-not-permitted", request.requestId)
    }
    if (request.type === "snapshot-load-request" && request.controller.permission !== "supervisor") {
      return reject("controller-permission-not-permitted", request.requestId)
    }

    if (
      (request.type === "scoring-reset-request" || request.type === "bout-reset-request") &&
      request.controller.permission !== "supervisor"
    ) {
      return reject("controller-permission-not-permitted", request.requestId)
    }

    if (request.type === "authority-transfer-request") {
      if (request.controller.kind === "paired-handheld") {
        return reject("controller-kind-not-permitted", request.requestId)
      }
      if (request.controller.permission !== "supervisor") {
        return reject("controller-permission-not-permitted", request.requestId)
      }
      if (pendingStm32RequestIds.length > 0) {
        return reject("pending-stm32-request", request.requestId)
      }
      if (sameController(request.controller, request.targetController)) {
        return reject("controller-kind-not-permitted", request.requestId)
      }
      if (currentRevision === Number.MAX_SAFE_INTEGER) {
        return reject("authority-revision-mismatch", request.requestId)
      }

      remember(request.requestId)
      currentController = request.targetController
      currentRevision += 1
      return { disposition: "application-applied", requestId: request.requestId, state: state() }
    }

    switch (request.type) {
      case "bout-workflow-command":
      case "snapshot-load-request":
        remember(request.requestId)
        return { disposition: "application-applied", requestId: request.requestId, state: state() }
      case "scoring-rearm-request":
      case "scoring-reset-request":
      case "weapon-change-request":
      case "bout-reset-request":
        if (pendingStm32RequestIds.length === maxPending) {
          return reject("stm32-request-capacity", request.requestId)
        }
        remember(request.requestId)
        pendingStm32RequestIds.push(request.requestId)
        return { disposition: "stm32-pending", requestId: request.requestId, state: state() }
      /* v8 ignore start -- every AuthorityRequest variant is handled above. */
      default:
        return reject("malformed", null)
      /* v8 ignore stop */
    }
  }

  function receiveStm32Response(rawResponse: unknown): AuthorityReceipt {
    let response: Stm32AuthorityResponse
    try {
      response = parseStm32AuthorityResponse(rawResponse)
    } catch {
      return reject("malformed", null)
    }

    const pendingIndex = pendingStm32RequestIds.indexOf(response.requestId)
    if (pendingIndex === -1) {
      return reject("unknown-stm32-request", response.requestId)
    }
    pendingStm32RequestIds.splice(pendingIndex, 1)
    return {
      disposition: response.result === "accepted" ? "stm32-accepted" : "stm32-rejected",
      requestId: response.requestId,
      state: state()
    }
  }

  return {
    receive,
    receiveStm32Response,
    get state() {
      return state()
    }
  }
}
