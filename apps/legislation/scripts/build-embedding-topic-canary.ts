import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { loadConfig } from "../src/config/config.js"
import { createDatabase } from "../src/db/database.js"

interface TopicDefinition {
  id: string
  jurisdictionId: string
  primarySubjects: string[]
  query: string
  secondarySubjects: string[]
  sessionId: string
}

interface BillRow {
  id: string
  subjects: string[]
}

const topics: TopicDefinition[] = [
  {
    id: "cannabis-regulation",
    jurisdictionId: "jurisdiction:ky",
    primarySubjects: ["Cannabis"],
    query: "marijuana legalization, licensing, and regulation",
    secondarySubjects: [],
    sessionId: "session:ky:2026rs"
  },
  {
    id: "consumer-protection",
    jurisdictionId: "jurisdiction:va",
    primarySubjects: ["Consumer Protection"],
    query: "protect consumers from unfair or deceptive business practices",
    secondarySubjects: [],
    sessionId: "session:va:2017"
  },
  {
    id: "school-discipline",
    jurisdictionId: "jurisdiction:in",
    primarySubjects: ["SCHOOLS; Discipline"],
    query: "student discipline, suspension, and school conduct",
    secondarySubjects: [],
    sessionId: "session:in:2025"
  },
  {
    id: "voter-registration",
    jurisdictionId: "jurisdiction:in",
    primarySubjects: ["ELECTIONS, Voters and Voting; Registration"],
    query: "voter registration and maintaining voter rolls",
    secondarySubjects: [],
    sessionId: "session:in:2021"
  },
  {
    id: "energy-conservation",
    jurisdictionId: "jurisdiction:va",
    primarySubjects: ["Energy Conservation and Resources"],
    query: "energy conservation, efficiency, and renewable resources",
    secondarySubjects: [],
    sessionId: "session:va:2018"
  },
  {
    id: "firearms",
    jurisdictionId: "jurisdiction:in",
    primarySubjects: ["FIREARMS AND WEAPONS"],
    query: "guns, firearm possession, and weapon safety",
    secondarySubjects: [],
    sessionId: "session:in:2026"
  },
  {
    id: "housing-development",
    jurisdictionId: "jurisdiction:in",
    primarySubjects: ["AGENCIES; Housing and Community Development Authority (IHCDA)"],
    query: "housing and community development programs and financing",
    secondarySubjects: [],
    sessionId: "session:in:2025"
  },
  {
    id: "immigration",
    jurisdictionId: "jurisdiction:oh",
    primarySubjects: ["Immigration"],
    query: "immigration, visas, and treatment of noncitizens",
    secondarySubjects: [],
    sessionId: "session:oh:136"
  },
  {
    id: "behavioral-health",
    jurisdictionId: "jurisdiction:va",
    primarySubjects: ["Behavioral Health and Developmental Services"],
    query: "mental health, developmental disability, and behavioral health services",
    secondarySubjects: [],
    sessionId: "session:va:2019"
  },
  {
    id: "prescription-drugs",
    jurisdictionId: "jurisdiction:in",
    primarySubjects: ["HEALTH; Prescription Drugs and Medications"],
    query: "prescription drug access, dispensing, and medication regulation",
    secondarySubjects: [],
    sessionId: "session:in:2026"
  }
]

function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

function cohort(id: string): "control" | "treatment" {
  const bucket = createHash("sha256").update(id).digest().at(0)
  if (bucket === undefined) {
    throw new Error(`Unable to assign canary cohort for ${id}`)
  }
  return bucket % 5 === 0 ? "control" : "treatment"
}

const outputPath = argument("--output", "evals/embedding-topic-canary.json")
if (outputPath === undefined) {
  throw new Error("Missing --output")
}

const config = loadConfig()
const { pool } = createDatabase({ ...config.database, maxConnections: 1 })

async function selectTopicBills(topic: TopicDefinition): Promise<BillRow[]> {
  const parameters = [topic.jurisdictionId, topic.sessionId, [...topic.primarySubjects, ...topic.secondarySubjects]]
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await pool.query<BillRow>(
        `select id, subjects
         from legislation.bills
         where jurisdiction_id = $1
           and session_id = $2
         and summary is not null
         and length(summary) >= 80
         and embedding is null
         and subjects && $3::text[]
         order by id`,
        parameters
      )
      return result.rows
    } catch (error) {
      if (attempt === 3) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500))
    }
  }
  throw new Error(`Unable to select topic bills for ${topic.id}`)
}

try {
  const queries = []
  const treatmentBillIds = new Set<string>()
  const controlBillIds = new Set<string>()
  for (const topic of topics) {
    const bills = await selectTopicBills(topic)
    if (bills.length < 8) {
      throw new Error(`Topic ${topic.id} has only ${bills.length} judged candidates`)
    }
    const judgments = bills.map((bill) => {
      const billCohort = cohort(bill.id)
      const relevance = bill.subjects.some((subject) => topic.primarySubjects.includes(subject)) ? 3 : 1
      if (billCohort === "treatment") {
        treatmentBillIds.add(bill.id)
      } else {
        controlBillIds.add(bill.id)
      }
      return { cohort: billCohort, id: bill.id, relevance }
    })
    queries.push({
      id: `topic-${topic.id}`,
      judgments,
      jurisdictionIds: [topic.jurisdictionId],
      query: topic.query,
      queryClass: "broad-topic",
      sessionIds: [topic.sessionId],
      tool: "search_bills"
    })
  }
  const manifest = {
    controlBillIds: [...controlBillIds].sort(),
    dimensions: 1536,
    limits: {
      maximumBills: 200,
      maximumDocumentSections: 0,
      maximumSupportingMaterialSections: 0
    },
    model: "openai/text-embedding-3-small",
    queries,
    rolloutId: "embedding-topic-canary",
    seed: "legislation-embedding-topic-canary-2026-08-22",
    treatmentBillIds: [...treatmentBillIds].sort(),
    treatmentSectionIds: []
  }
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  process.stdout.write(
    `${JSON.stringify({ controls: controlBillIds.size, queries: queries.length, treatments: treatmentBillIds.size })}\n`
  )
} finally {
  await pool.end()
}
