import { describe, expect, it } from "vitest"
import { agendaItemLinkRows, type EventAgendaItemSnapshot } from "./events.js"

function agendaItem(): EventAgendaItemSnapshot {
  return {
    agendaItem: {
      amendmentRelationsComplete: true,
      billRelationsComplete: true,
      canonicalFactsComplete: true,
      description: "The published description",
      eventId: "event:fixture:1",
      id: "agenda:fixture:1",
      materialRelationsComplete: true,
      ordinal: 0,
      title: "The published title"
    },
    amendmentIds: ["amendment:fixture:1", "amendment:fixture:1"],
    billIds: ["bill:fixture:1"],
    materialIds: ["material:fixture:1"]
  }
}

describe("event agenda persistence", () => {
  it("persists only explicit, deduplicated agenda links", () => {
    expect(agendaItemLinkRows([agendaItem()])).toEqual({
      amendmentLinks: [{ agendaItemId: "agenda:fixture:1", amendmentId: "amendment:fixture:1" }],
      billLinks: [{ agendaItemId: "agenda:fixture:1", billId: "bill:fixture:1" }],
      materialLinks: [{ agendaItemId: "agenda:fixture:1", materialId: "material:fixture:1" }]
    })
  })

  it("does not create links for a legacy incomplete agenda row", () => {
    const legacy = agendaItem()
    legacy.agendaItem.canonicalFactsComplete = false
    legacy.agendaItem.title = undefined
    legacy.agendaItem.billRelationsComplete = false
    legacy.agendaItem.amendmentRelationsComplete = false
    legacy.agendaItem.materialRelationsComplete = false
    legacy.amendmentIds = []
    legacy.billIds = []
    legacy.materialIds = []

    expect(agendaItemLinkRows([legacy])).toEqual({ amendmentLinks: [], billLinks: [], materialLinks: [] })
  })

  it("retains authoritative empty relation sets without inventing a link", () => {
    const completeWithoutLinks = agendaItem()
    completeWithoutLinks.amendmentIds = []
    completeWithoutLinks.billIds = []
    completeWithoutLinks.materialIds = []

    expect(completeWithoutLinks.agendaItem).toMatchObject({
      amendmentRelationsComplete: true,
      billRelationsComplete: true,
      canonicalFactsComplete: true,
      materialRelationsComplete: true,
      title: "The published title"
    })
    expect(agendaItemLinkRows([completeWithoutLinks])).toEqual({
      amendmentLinks: [],
      billLinks: [],
      materialLinks: []
    })
  })

  it("rejects noncanonical source relation IDs instead of changing their identity", () => {
    const incomplete = agendaItem()
    incomplete.billIds = [" "]
    expect(() => agendaItemLinkRows([incomplete])).toThrow("billId must be trimmed and nonempty")
  })
})
