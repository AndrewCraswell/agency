const FEDERAL_BILL_ID = "bill:us:119:hr:1234"
const STATE_BILL_ID = "bill:wa:2025-2026:hb:1234"
const INTRODUCED_DOCUMENT_ID = "document:govinfo:119-hr-1234-ih"
const ENROLLED_DOCUMENT_ID = "document:govinfo:119-hr-1234-enr"

const federalBill = {
  id: FEDERAL_BILL_ID,
  identifier: "H.R. 1234",
  jurisdictionId: "jurisdiction:us",
  sessionId: "session:us:119",
  sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1234",
  title: "Machine-Readable Legislative Data Act"
}
const stateBill = {
  id: STATE_BILL_ID,
  identifier: "HB 1234",
  jurisdictionId: "jurisdiction:wa",
  sessionId: "session:wa:2025-2026",
  sourceUrl: "https://app.leg.wa.gov/billsummary?BillNumber=1234&Year=2025",
  title: "Government records machine-readable formats"
}

export function createFixtureService(overrides = {}) {
  return {
    compareBillVersions: async ({ billId, documentIds }) => ({
      billId,
      changes: [
        {
          after: "This Act takes effect 30 days after enactment.",
          before: "This Act takes effect 90 days after enactment.",
          classification: "modified",
          identifier: "SEC. 4",
          ordinal: 0
        }
      ],
      documents: documentIds.map((id) => ({
        id,
        sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1234/text"
      })),
      truncated: false
    }),
    findRelatedBills: async () => ({
      items: [
        {
          bill: {
            id: "bill:us:119:s:567",
            sourceUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/567",
            title: "Machine-Readable Legislative Data Act"
          },
          classification: "companion",
          method: "explicit"
        }
      ],
      truncated: false
    }),
    getBill: async ({ id }) => ({
      actions: [],
      bill: id === STATE_BILL_ID ? stateBill : federalBill,
      documents: [],
      organizations: [],
      relations: [],
      sponsors: [],
      truncated: false,
      votes: [],
      warnings: []
    }),
    getBillText: async ({ documentId, id }) => ({
      billId: id,
      document: {
        id: documentId ?? INTRODUCED_DOCUMENT_ID,
        sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1234/text",
        versionCode: documentId === ENROLLED_DOCUMENT_ID ? "enr" : "ih"
      },
      nextCursor: documentId === INTRODUCED_DOCUMENT_ID ? "eyJvZmZzZXQiOjEwMH0" : undefined,
      sections: [
        {
          contentHash: "sha256:fixture-section-4",
          ordinal: 0,
          sectionIdentifier: "SEC. 4",
          text: "The effective date is 30 days after enactment."
        }
      ],
      truncated: documentId === INTRODUCED_DOCUMENT_ID
    }),
    getBillTimeline: async ({ id }) => ({
      billId: id,
      events: [
        {
          date: "2025-02-10",
          description: "Introduced in House",
          id: "action:congress:119-hr-1234-1",
          sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1234/all-actions",
          type: "action"
        },
        {
          date: "2025-04-03T18:00:00.000Z",
          description: "Passed House",
          id: "vote:congress:119-house-42",
          sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1234/actions",
          type: "vote"
        }
      ],
      truncated: false,
      warnings: []
    }),
    searchBills: async ({ mode, query }) => {
      if (query.includes("ZZ 999999")) {
        return { items: [], truncated: false }
      }
      if (query.includes("Washington")) {
        return { items: [stateBill], truncated: false }
      }
      if (mode === "semantic") {
        return { items: [{ ...stateBill, retrievalMethod: "semantic" }], truncated: false }
      }
      return {
        items: [{ ...federalBill, matchText: "machine-readable legislative data" }],
        truncated: false
      }
    },
    searchBillText: async ({ billId }) => ({
      items: [
        {
          billId: billId ?? FEDERAL_BILL_ID,
          contentHash: "sha256:fixture-section-2",
          documentId: INTRODUCED_DOCUMENT_ID,
          sectionIdentifier: "SEC. 2",
          snippet: "Section 552 of title 5 is amended. The effective date is 30 days after enactment.",
          sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1234/text",
          versionCode: "ih"
        }
      ],
      truncated: false
    }),
    ...overrides
  }
}
