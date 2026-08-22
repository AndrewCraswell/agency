import { writeFile } from "node:fs/promises"
import { loadConfig } from "../src/config/config.js"
import { createDatabase } from "../src/db/database.js"

type RecordKind = "amendment" | "bill" | "document-section" | "material-section"

interface CandidateRecord {
  contextualInput: string
  currentInput: string
  id: string
  kind: RecordKind
  strata: string[]
}

interface BakeoffQuery {
  candidateIds?: string[]
  id: string
  kind: RecordKind
  query: string
  relevantIds: string[]
}

interface BillTopic {
  id: string
  jurisdictionId: string
  primarySubjects: string[]
  query: string
  sessionId: string
}

interface BillRow {
  documentSynopsis: null | string
  id: string
  identifier: string
  jurisdictionId: string
  sessionId: string
  subjects: string[]
  summary: null | string
  title: string
}

interface SynopsisRow {
  billId: string
  text: string
}

interface SectionRow {
  billIdentifier?: string
  billTitle?: string
  classification: string
  heading: null | string
  id: string
  text: string
  title: string
}

interface AmendmentRow {
  amendmentType: string
  description: null | string
  id: string
  printedIdentifier: string
  purpose: null | string
  title: null | string
}

const topics: BillTopic[] = [
  [
    "cannabis-regulation",
    "jurisdiction:ky",
    "session:ky:2026rs",
    ["Cannabis"],
    "marijuana legalization, licensing, and regulation"
  ],
  [
    "consumer-protection",
    "jurisdiction:va",
    "session:va:2017",
    ["Consumer Protection"],
    "protect consumers from unfair or deceptive business practices"
  ],
  [
    "school-discipline",
    "jurisdiction:in",
    "session:in:2025",
    ["SCHOOLS; Discipline"],
    "student discipline, suspension, and school conduct"
  ],
  [
    "voter-registration",
    "jurisdiction:in",
    "session:in:2021",
    ["ELECTIONS, Voters and Voting; Registration"],
    "voter registration and maintaining voter rolls"
  ],
  [
    "energy-conservation",
    "jurisdiction:va",
    "session:va:2018",
    ["Energy Conservation and Resources"],
    "energy conservation, efficiency, and renewable resources"
  ],
  [
    "firearms",
    "jurisdiction:in",
    "session:in:2026",
    ["FIREARMS AND WEAPONS"],
    "guns, firearm possession, and weapon safety"
  ],
  [
    "housing-development",
    "jurisdiction:in",
    "session:in:2025",
    ["AGENCIES; Housing and Community Development Authority (IHCDA)"],
    "housing and community development programs and financing"
  ],
  [
    "immigration",
    "jurisdiction:oh",
    "session:oh:136",
    ["Immigration"],
    "immigration, visas, and treatment of noncitizens"
  ],
  [
    "behavioral-health",
    "jurisdiction:va",
    "session:va:2019",
    ["Behavioral Health and Developmental Services"],
    "mental health, developmental disability, and behavioral health services"
  ],
  [
    "prescription-drugs",
    "jurisdiction:in",
    "session:in:2026",
    ["HEALTH; Prescription Drugs and Medications"],
    "prescription drug access, dispensing, and medication regulation"
  ]
].map(([id, jurisdictionId, sessionId, primarySubjects, query]) => ({
  id: id as string,
  jurisdictionId: jurisdictionId as string,
  primarySubjects: primarySubjects as string[],
  query: query as string,
  sessionId: sessionId as string
}))

const amendmentTargets = [
  ["amendment:us:113:hamdt:10", "full federal funding for Corps of Engineers beach repairs after Hurricane Sandy"],
  ["amendment:us:113:hamdt:100", "increase border security fencing and infrastructure funding by ten million dollars"],
  ["amendment:us:113:hamdt:1000", "move forty million dollars from nuclear weapons activities to the science account"],
  ["amendment:us:113:hamdt:1001", "restore the National Undergraduate Fellowship Program at the Department of Energy"],
  ["amendment:us:113:hamdt:1002", "end funding for the Yucca Mountain nuclear waste disposal plan"],
  ["amendment:us:113:hamdt:1003", "increase ARPA-E advanced energy research funding"],
  ["amendment:us:113:hamdt:1004", "fund environmental justice programs for minority groups"],
  ["amendment:us:113:hamdt:1005", "cut funding for the long range standoff cruise missile warhead study"],
  ["amendment:us:113:hamdt:1012", "bar federal contracts with companies incorporated in Bermuda or the Cayman Islands"],
  ["amendment:us:113:hamdt:1014", "protect non-federal Department of Energy employees from whistleblower retaliation"]
] as const

const documentTargets = [
  [
    "bill:ak:30:hb:100:document:0ebd633b2a73802af6b33d7e:section:adae42a2ddc4c114c291c026",
    "why post-traumatic stress should be described as an injury rather than a disorder"
  ],
  [
    "bill:ak:30:hb:100:document:3ccd3c726975804129963fa1:section:dcaaa4a275d5acef1e01e99b",
    "establish June 27 as post-traumatic stress injury awareness day"
  ],
  [
    "bill:ak:30:hb:100:document:57a593a7a89f6f0bb76fa0d9:section:5a88568f451ef622d1798ed2",
    "fiscal cost estimate for Alaska post-traumatic stress awareness day"
  ],
  [
    "bill:ak:30:hb:100:document:b4144d0a608c313fbd8cc6ee:section:7f7a93ec0f67adebf6331710",
    "veterans avoid treatment because of stigma around the word disorder"
  ],
  [
    "bill:ak:30:hb:100:document:f74a626404b501b2911ffa4d:section:e429cfd61848606f5f5ff89e",
    "statistics on military service members diagnosed with PTSD"
  ],
  [
    "bill:ak:30:hb:101:document:04589df67ce559862b0c3d79:section:a7884c3d2aaf3ec50a90c0c5",
    "affirmative defense for self-reporting an unlawful taking of big game"
  ],
  [
    "bill:ak:30:hb:102:document:090722181529af8b53596b05:section:10a2e2e126a56b6a9ec3ba65",
    "Hawaiian language immersion schools using teachers without standard licenses"
  ],
  [
    "bill:ak:30:hb:102:document:13da9f45bf2bc597a480f19a:section:2589dbca8d1cd5125d60544b",
    "Nome schools support Alaska Native language immersion programs"
  ],
  [
    "bill:ak:30:hb:102:document:178859436678f6c0e0d71a98:section:58b3b0d89189716424d12a0d",
    "research on Native language immersion and student achievement"
  ],
  [
    "bill:ak:30:hb:102:document:1e38508abfe98535c1379870:section:8b877c63fd0151af2fa01634",
    "three decades of research on immersion, graduation, and college entry"
  ]
] as const

const materialTargets = [
  [
    "amendment:us:119:samdt:1:material:3136dc5aebb6db6c106da059:section:2e5c646dc1fb8f2359f33e5b",
    "create a Southern Border Wall Construction Fund"
  ],
  [
    "amendment:us:119:samdt:1:material:ef716ddcfbdda4442a21018c:section:699af5053551b5cb2a7d874c",
    "military enlistment eligibility for immigrants who aged out before a visa became available"
  ],
  [
    "material:congress:00008593b8c67cc75946c885:section:42c0342d890d408f3707613d",
    "expand mobile and advanced mammography for women veterans"
  ],
  [
    "material:congress:0000b382344b3eb2a5f06014:section:047a45ea388a80a8e0886c8e",
    "IRS questions for tax exempt social welfare applications"
  ],
  [
    "material:congress:0000b382344b3eb2a5f06014:section:0b4e257d5982d6944d4a2dc9",
    "testimony of IRS Commissioner John Koskinen"
  ],
  [
    "material:congress:0000b382344b3eb2a5f06014:section:1cf16db8c90b22f0a62c6723",
    "committee demand for all of Lois Lerner's emails"
  ],
  [
    "material:congress:0000b382344b3eb2a5f06014:section:21ad8ee227a79a3d0b73164e",
    "how long the IRS would need to produce documents from eight hundred employees"
  ],
  [
    "material:congress:0000b382344b3eb2a5f06014:section:22a7eb85569ab87c3bedc8eb",
    "IRS estate audit asking about bedroom furniture"
  ],
  [
    "material:congress:0000b382344b3eb2a5f06014:section:24b17bfacb915662e107411a",
    "whether a limited subset of emails satisfies a congressional subpoena"
  ],
  [
    "material:congress:0000b382344b3eb2a5f06014:section:3a8639a37bdb7acc816b9174",
    "inappropriate criteria used to select organizations for IRS review"
  ]
] as const

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

function addRecord(records: Map<string, CandidateRecord>, record: CandidateRecord): void {
  records.set(record.id, record)
}

const outputPath = argument("--output", "evals/embedding-model-bakeoff.json")
const config = loadConfig()
const { pool } = createDatabase({ ...config.database, maxConnections: 1 })
const records = new Map<string, CandidateRecord>()
const queries: BakeoffQuery[] = []

try {
  for (const topic of topics) {
    const result = await pool.query<Omit<BillRow, "documentSynopsis">>(
      `select b.id, b.identifier, b.jurisdiction_id as "jurisdictionId", b.session_id as "sessionId",
              b.title, b.summary, b.subjects
       from legislation.bills b
       where b.jurisdiction_id = $1 and b.session_id = $2
       order by b.id
       limit 100`,
      [topic.jurisdictionId, topic.sessionId]
    )
    const relevantResult = await pool.query<Omit<BillRow, "documentSynopsis">>(
      `select b.id, b.identifier, b.jurisdiction_id as "jurisdictionId", b.session_id as "sessionId",
              b.title, b.summary, b.subjects
       from legislation.bills b
       where b.jurisdiction_id = $1 and b.session_id = $2 and b.subjects && $3::text[]
       order by b.id
       limit 100`,
      [topic.jurisdictionId, topic.sessionId, topic.primarySubjects]
    )
    const relevant = relevantResult.rows
    const selected = new Map(result.rows.map((bill) => [bill.id, bill]))
    for (const bill of relevant) {
      selected.set(bill.id, bill)
    }
    const synopsisResult = await pool.query<SynopsisRow>(
      `select distinct on (d.bill_id) d.bill_id as "billId", left(d.text, 1600) as text
       from legislation.bill_documents d
       where d.bill_id = any($1::text[]) and d.processing_status = 'processed' and d.text is not null
       order by d.bill_id, case when d.classification = 'version' then 0 else 1 end,
                d.document_date desc nulls last, d.id`,
      [[...selected.keys()]]
    )
    const synopses = new Map(synopsisResult.rows.map((row) => [row.billId, row.text]))
    for (const selectedBill of selected.values()) {
      const bill: BillRow = { ...selectedBill, documentSynopsis: synopses.get(selectedBill.id) ?? null }
      let sparse = "no-summary"
      if (bill.summary?.trim()) {
        sparse = bill.subjects.length === 0 ? "no-subjects" : "summary-rich"
      }
      const currentInput = [bill.title, bill.summary, ...bill.subjects].filter(Boolean).join("\n")
      const contextualInput = [
        `Bill: ${bill.identifier} — ${bill.title}`,
        bill.summary?.trim() ? `Summary: ${bill.summary}` : undefined,
        bill.subjects.length > 0 ? `Subjects: ${bill.subjects.join(", ")}` : undefined,
        !bill.summary?.trim() && bill.documentSynopsis?.trim()
          ? `Preferred document excerpt: ${bill.documentSynopsis}`
          : undefined
      ]
        .filter(Boolean)
        .join("\n")
      addRecord(records, { contextualInput, currentInput, id: bill.id, kind: "bill", strata: [sparse] })
    }
    const candidateIds = [...selected.keys()]
    queries.push({
      candidateIds,
      id: `bill-topic-${topic.id}`,
      kind: "bill",
      query: topic.query,
      relevantIds: relevant.map((bill) => bill.id)
    })
  }

  const jurisdictions = ["ak", "ca", "fl", "il", "in", "ny", "oh", "tx", "us", "va"]
  for (const jurisdiction of jurisdictions) {
    const result = await pool.query<SectionRow>(
      `select s.id, s.heading, s.text, d.title, d.classification,
              b.identifier as "billIdentifier", b.title as "billTitle"
       from legislation.bills b
       join legislation.bill_documents d on d.bill_id = b.id
       join legislation.document_sections s on s.document_id = d.id
       where b.jurisdiction_id = $1
       order by b.id, d.id, s.ordinal
       limit 200`,
      [`jurisdiction:${jurisdiction}`]
    )
    for (const row of result.rows) {
      let lengthStratum = "median"
      if (row.text.length > 12_000) {
        lengthStratum = "long"
      } else if (row.text.length < 1_000) {
        lengthStratum = "short"
      }
      addRecord(records, {
        contextualInput: [
          `Bill: ${row.billIdentifier} — ${row.billTitle}`,
          `Document: ${row.title}`,
          `Classification: ${row.classification}`,
          row.heading ? `Section: ${row.heading}` : undefined,
          row.text
        ]
          .filter(Boolean)
          .join("\n"),
        currentInput: [row.heading, row.text].filter(Boolean).join("\n"),
        id: row.id,
        kind: "document-section",
        strata: [lengthStratum]
      })
    }
  }

  const exactDocumentRows = await pool.query<SectionRow>(
    `select s.id, s.heading, s.text, d.title, d.classification,
            b.identifier as "billIdentifier", b.title as "billTitle"
     from legislation.document_sections s
     join legislation.bill_documents d on d.id = s.document_id
     join legislation.bills b on b.id = d.bill_id
     where s.id = any($1::text[])`,
    [documentTargets.map(([id]) => id)]
  )
  for (const row of exactDocumentRows.rows) {
    addRecord(records, {
      contextualInput: [
        `Bill: ${row.billIdentifier} — ${row.billTitle}`,
        `Document: ${row.title}`,
        `Classification: ${row.classification}`,
        row.heading ? `Section: ${row.heading}` : undefined,
        row.text
      ]
        .filter(Boolean)
        .join("\n"),
      currentInput: [row.heading, row.text].filter(Boolean).join("\n"),
      id: row.id,
      kind: "document-section",
      strata: ["known-item"]
    })
  }
  for (const [id, query] of documentTargets) {
    queries.push({ id: `document-${queries.length}`, kind: "document-section", query, relevantIds: [id] })
  }

  const amendments = await pool.query<AmendmentRow>(
    `select a.id, a.printed_identifier as "printedIdentifier", a.amendment_type as "amendmentType",
            a.purpose, a.description, b.title
     from legislation.amendments a
     left join legislation.bills b on b.id = a.bill_id
     order by a.id
     limit 500`
  )
  for (const row of amendments.rows) {
    const prose = [row.purpose, row.description].filter(Boolean).join("\n")
    addRecord(records, {
      contextualInput: [
        row.title ? `Bill: ${row.title}` : undefined,
        `Amendment: ${row.printedIdentifier}`,
        `Type: ${row.amendmentType}`,
        row.purpose ? `Purpose: ${row.purpose}` : undefined,
        row.description ? `Description: ${row.description}` : undefined
      ]
        .filter(Boolean)
        .join("\n"),
      currentInput: prose || row.printedIdentifier,
      id: row.id,
      kind: "amendment",
      strata: [prose ? "described" : "identifier-only"]
    })
  }
  for (const [id, query] of amendmentTargets) {
    queries.push({ id: `amendment-${id.split(":").at(-1)}`, kind: "amendment", query, relevantIds: [id] })
  }

  const materials = await pool.query<SectionRow>(
    `select s.id, s.heading, s.text, m.title, m.classification
     from legislation.supporting_material_sections s
     join legislation.supporting_materials m on m.id = s.material_id
     order by s.id
     limit 500`
  )
  for (const row of materials.rows) {
    addRecord(records, {
      contextualInput: [
        `Material: ${row.title}`,
        `Classification: ${row.classification}`,
        row.heading ? `Section: ${row.heading}` : undefined,
        row.text
      ]
        .filter(Boolean)
        .join("\n"),
      currentInput: [row.heading, row.text].filter(Boolean).join("\n"),
      id: row.id,
      kind: "material-section",
      strata: [row.classification]
    })
  }
  for (const [id, query] of materialTargets) {
    queries.push({ id: `material-${queries.length}`, kind: "material-section", query, relevantIds: [id] })
  }

  for (const query of queries) {
    const missing = query.relevantIds.filter((id) => !records.has(id))
    if (missing.length > 0) {
      throw new Error(`Query ${query.id} has missing relevant records: ${missing.join(", ")}`)
    }
    if (query.relevantIds.length === 0) {
      throw new Error(`Query ${query.id} has no relevance judgments`)
    }
  }

  const manifest = {
    builtAt: new Date().toISOString(),
    queries,
    records: [...records.values()],
    seed: "legislation-embedding-model-bakeoff-2026-08-22",
    version: 1
  }
  await writeFile(outputPath, `${JSON.stringify(manifest)}\n`, "utf8")
  const counts = Object.groupBy(manifest.records, (record) => record.kind)
  process.stdout.write(
    `${JSON.stringify({ queries: queries.length, records: Object.fromEntries(Object.entries(counts).map(([kind, values]) => [kind, values?.length ?? 0])) })}\n`
  )
} finally {
  await pool.end()
}
