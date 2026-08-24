import { describe, expect, it } from "vitest"
import {
  createRemoteControlAuthority,
  mapApprovedWeaponCommand,
  parseAuthorityRequest,
  parseStm32AuthorityResponse,
  type ControllerIdentity
} from "./remote-control-authority.js"
import { parseRemoteCommand } from "./remote-control.js"

const handheldReferee: ControllerIdentity = {
  controllerId: "remote-01",
  kind: "paired-handheld",
  permission: "referee"
}
const handheldSupervisor: ControllerIdentity = {
  controllerId: "remote-supervisor-01",
  kind: "paired-handheld",
  permission: "supervisor"
}
const applicationReferee: ControllerIdentity = {
  controllerId: "console-01",
  kind: "local-application",
  permission: "referee"
}
const applicationSupervisor: ControllerIdentity = {
  controllerId: "console-supervisor-01",
  kind: "local-application",
  permission: "supervisor"
}
const tournamentSupervisor: ControllerIdentity = {
  controllerId: "tournament-01",
  kind: "tournament-controller",
  permission: "supervisor"
}

function gate(activeController: ControllerIdentity = handheldReferee) {
  return createRemoteControlAuthority({ activeController, authorityRevision: 7 })
}

function workflowRequest(requestId: string, controller: ControllerIdentity = handheldReferee, revision = 7) {
  return { controller, expectedAuthorityRevision: revision, requestId, type: "bout-workflow-command" }
}

describe("RC-01 remote-control authority contract", () => {
  it("keeps the countdown workflow separate from STM32 scoring work", () => {
    const authority = gate()

    expect(authority.receive(workflowRequest("clock-toggle"))).toMatchObject({
      disposition: "application-applied",
      state: { activeController: handheldReferee, authorityRevision: 7, pendingStm32RequestIds: [] }
    })
    expect(
      authority.receive({
        controller: handheldReferee,
        expectedAuthorityRevision: 7,
        requestId: "rearm",
        type: "scoring-rearm-request"
      })
    ).toMatchObject({ disposition: "stm32-pending", state: { pendingStm32RequestIds: ["rearm"] } })
    expect(
      authority.receiveStm32Response({ authority: "stm32-scoring", requestId: "rearm", result: "accepted" })
    ).toMatchObject({
      disposition: "stm32-accepted",
      state: { pendingStm32RequestIds: [] }
    })
  })

  it("uses the remote command identity policy for controller and request identifiers", () => {
    const validIdentifiers = ["a", "a".repeat(64), "Remote_Command.1:pair"]
    const invalidIdentifiers = ["", "a".repeat(65), "remote id", " remote-1", "remote/1", "épee-1"]

    for (const identifier of validIdentifiers) {
      const controller = { ...handheldReferee, controllerId: identifier }
      expect(gate(controller).state.activeController).toEqual(controller)
      expect(() => parseAuthorityRequest(workflowRequest(identifier, controller))).not.toThrow()
    }
    for (const identifier of invalidIdentifiers) {
      const controller = { ...handheldReferee, controllerId: identifier }
      expect(() => gate(controller)).toThrow(TypeError)
      expect(() => parseAuthorityRequest(workflowRequest(identifier, controller))).toThrow(TypeError)
    }
  })

  it("allows exactly one current controller and transfers ownership atomically", () => {
    expect(
      gate(handheldSupervisor).receive({
        controller: handheldSupervisor,
        expectedAuthorityRevision: 7,
        requestId: "handheld-transfer",
        targetController: applicationSupervisor,
        type: "authority-transfer-request"
      })
    ).toMatchObject({ disposition: "rejected", reason: "controller-kind-not-permitted" })
    expect(
      gate(applicationReferee).receive({
        controller: applicationReferee,
        expectedAuthorityRevision: 7,
        requestId: "referee-transfer",
        targetController: tournamentSupervisor,
        type: "authority-transfer-request"
      })
    ).toMatchObject({ disposition: "rejected", reason: "controller-permission-not-permitted" })

    const authority = gate(applicationSupervisor)
    const transferred = authority.receive({
      controller: applicationSupervisor,
      expectedAuthorityRevision: 7,
      requestId: "transfer-to-app",
      targetController: tournamentSupervisor,
      type: "authority-transfer-request"
    })

    expect(transferred).toMatchObject({
      disposition: "application-applied",
      state: { activeController: tournamentSupervisor, authorityRevision: 8 }
    })
    expect(authority.receive(workflowRequest("stale-handheld"))).toMatchObject({
      disposition: "rejected",
      reason: "authority-revision-mismatch"
    })
    expect(authority.receive(workflowRequest("application-writes", tournamentSupervisor, 8))).toMatchObject({
      disposition: "application-applied",
      state: { activeController: tournamentSupervisor, authorityRevision: 8 }
    })
  })

  it("does not permit transfer while a scoring transition awaits the STM32", () => {
    const authority = gate(applicationSupervisor)
    authority.receive({
      controller: applicationSupervisor,
      expectedAuthorityRevision: 7,
      requestId: "new-bout",
      type: "bout-reset-request"
    })

    expect(
      authority.receive({
        controller: applicationSupervisor,
        expectedAuthorityRevision: 7,
        requestId: "transfer-during-reset",
        targetController: tournamentSupervisor,
        type: "authority-transfer-request"
      })
    ).toMatchObject({ disposition: "rejected", reason: "pending-stm32-request" })
    expect(
      authority.receiveStm32Response({ authority: "stm32-scoring", requestId: "new-bout", result: "rejected" })
    ).toMatchObject({
      disposition: "stm32-rejected"
    })
  })

  it("requires supervisor permission before scoring reset or bout transitions become STM32 requests", () => {
    const refereeAuthority = gate(handheldReferee)
    expect(
      refereeAuthority.receive({
        controller: handheldReferee,
        expectedAuthorityRevision: 7,
        requestId: "referee-bout-reset",
        type: "bout-reset-request"
      })
    ).toMatchObject({ disposition: "rejected", reason: "controller-permission-not-permitted" })

    const authority = gate(handheldSupervisor)
    for (const type of ["scoring-reset-request", "bout-reset-request"] as const) {
      expect(
        authority.receive({
          controller: handheldSupervisor,
          expectedAuthorityRevision: 7,
          requestId: `supervisor-${type}`,
          type
        })
      ).toMatchObject({ disposition: "stm32-pending" })
      expect(
        authority.receiveStm32Response({
          authority: "stm32-scoring",
          requestId: `supervisor-${type}`,
          result: "rejected"
        })
      ).toMatchObject({ disposition: "stm32-rejected" })
    }
  })

  it("maps a parsed referee weapon.showOrAdvance command to a pending STM32 request", () => {
    const command = parseRemoteCommand({
      apparatusId: "apparatus-01",
      authority: { ...handheldReferee, authorityRevision: 7 },
      command: "weapon.showOrAdvance",
      commandId: "weapon-advance-01",
      counter: 1,
      payload: {},
      pressKind: "direct",
      remoteId: "remote-01",
      schemaVersion: 1
    })
    const request = mapApprovedWeaponCommand(command)
    const authority = gate(handheldReferee)

    expect(request).toEqual({
      controller: handheldReferee,
      expectedAuthorityRevision: 7,
      requestId: "weapon-advance-01",
      type: "weapon-change-request"
    })
    expect(authority.receive(request)).toMatchObject({ disposition: "stm32-pending" })
    expect(
      authority.receiveStm32Response({ authority: "stm32-scoring", requestId: "weapon-advance-01", result: "accepted" })
    ).toMatchObject({ disposition: "stm32-accepted" })
  })

  it("rejects malformed, stale, replayed, unauthorized, and forged STM32 inputs without changing state", () => {
    const authority = gate()
    const before = authority.state
    expect(authority.receive({ ...workflowRequest("extra"), unexpected: true })).toMatchObject({
      disposition: "rejected",
      reason: "malformed"
    })
    expect(authority.receive(workflowRequest("wrong-controller", applicationReferee))).toMatchObject({
      disposition: "rejected",
      reason: "not-active-controller"
    })
    expect(authority.receive(workflowRequest("accepted-once"))).toMatchObject({ disposition: "application-applied" })
    expect(authority.receive(workflowRequest("accepted-once"))).toMatchObject({
      disposition: "rejected",
      reason: "duplicate-request"
    })
    expect(authority.receive({ ...workflowRequest("stale"), expectedAuthorityRevision: 6 })).toMatchObject({
      disposition: "rejected",
      reason: "authority-revision-mismatch"
    })
    expect(
      authority.receiveStm32Response({ authority: "application", requestId: "accepted-once", result: "accepted" })
    ).toMatchObject({
      disposition: "rejected",
      reason: "malformed"
    })
    expect(authority.state).toEqual({ ...before, pendingStm32RequestIds: [] })
  })

  it("keeps snapshot load off the handheld and limits STM32 replies to known pending requests", () => {
    const authority = gate(handheldSupervisor)
    expect(
      authority.receive({
        controller: handheldSupervisor,
        expectedAuthorityRevision: 7,
        requestId: "handheld-snapshot",
        type: "snapshot-load-request"
      })
    ).toMatchObject({ disposition: "rejected", reason: "controller-kind-not-permitted" })
    expect(
      gate(applicationReferee).receive({
        controller: applicationReferee,
        expectedAuthorityRevision: 7,
        requestId: "application-snapshot",
        type: "snapshot-load-request"
      })
    ).toMatchObject({ disposition: "rejected", reason: "controller-permission-not-permitted" })
    expect(
      gate(applicationSupervisor).receive({
        controller: applicationSupervisor,
        expectedAuthorityRevision: 7,
        requestId: "supervisor-snapshot",
        type: "snapshot-load-request"
      })
    ).toMatchObject({ disposition: "application-applied" })
    expect(
      authority.receiveStm32Response({ authority: "stm32-scoring", requestId: "invented", result: "accepted" })
    ).toMatchObject({
      disposition: "rejected",
      reason: "unknown-stm32-request"
    })
  })

  it("fails closed at the bounded STM32 request queue without consuming the rejected request", () => {
    const authority = createRemoteControlAuthority({
      activeController: handheldReferee,
      authorityRevision: 7,
      maxPendingStm32Requests: 1
    })
    expect(authority.receive({ ...workflowRequest("first-rearm"), type: "scoring-rearm-request" })).toMatchObject({
      disposition: "stm32-pending"
    })
    expect(authority.receive({ ...workflowRequest("second-rearm"), type: "scoring-rearm-request" })).toMatchObject({
      disposition: "rejected",
      reason: "stm32-request-capacity"
    })
    expect(
      authority.receiveStm32Response({ authority: "stm32-scoring", requestId: "first-rearm", result: "rejected" })
    ).toMatchObject({
      disposition: "stm32-rejected"
    })
    expect(authority.receive({ ...workflowRequest("second-rearm"), type: "scoring-rearm-request" })).toMatchObject({
      disposition: "stm32-pending"
    })
  })

  it("strictly rejects inherited, accessor, non-enumerable, unknown, and incomplete shapes before reading fields", () => {
    const inherited = Object.create(workflowRequest("inherited"))
    const accessor = { ...workflowRequest("accessor") }
    Object.defineProperty(accessor, "type", {
      enumerable: true,
      get: () => {
        throw new Error("must not read")
      }
    })
    const nonEnumerable = { ...workflowRequest("non-enumerable") }
    Object.defineProperty(nonEnumerable, "type", { enumerable: false, value: "bout-workflow-command" })

    for (const value of [inherited, accessor, nonEnumerable, null, { type: "unknown" }]) {
      expect(() => parseAuthorityRequest(value)).toThrow(TypeError)
    }
    expect(() =>
      parseStm32AuthorityResponse({ authority: "stm32-scoring", requestId: "answer", result: "accepted", extra: true })
    ).toThrow(TypeError)
  })
})
