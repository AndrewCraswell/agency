import { z } from "zod"
import type { ScenarioDisplayCase } from "../../src/scenario-display-projection"

const sideSchema = z.enum(["left", "right"])
const weaponSchema = z.enum(["epee", "foil", "sabre"])
const lineSchema = z.object({ line: z.string(), state: z.string() }).loose()
const inputSchema = z.object({ atUs: z.int().nonnegative(), id: z.string().min(1), lines: z.array(lineSchema) }).loose()
const signalSchema = z
  .object({ audible: z.string().optional(), latched: z.boolean().optional(), visual: z.string().optional() })
  .loose()
const expectedDecisionSchema = z
  .object({
    decisionAtUs: z.int().nonnegative(),
    disposition: z.string().min(1),
    id: z.string().min(1),
    side: sideSchema.optional(),
    signal: signalSchema.optional()
  })
  .loose()
const expectedNonEventSchema = z
  .object({
    assertion: z.string(),
    assertionReasonCode: z.string(),
    id: z.string().min(1),
    window: z.object({ throughUs: z.int().nonnegative() }).loose()
  })
  .loose()
const uncertaintySchema = z.object({ atUs: z.int().nonnegative(), id: z.string().optional() }).loose()
const errorSchema = z
  .object({ atInputId: z.string().optional(), code: z.string().optional() })
  .loose()
  .nullable()
  .optional()
const expectedSchema = z
  .object({
    decisions: z.array(expectedDecisionSchema),
    error: errorSchema,
    nonEvents: z.array(expectedNonEventSchema),
    status: z.string().optional(),
    uncertainty: z.array(uncertaintySchema)
  })
  .loose()
const resultSchema = z
  .object({
    actualStatus: z.string().optional(),
    decisions: z.array(z.unknown()),
    diagnostics: z.array(z.unknown()).optional(),
    error: errorSchema,
    mismatches: z.array(z.unknown()),
    uncertainty: z.array(uncertaintySchema)
  })
  .loose()
const executableCaseSchema = z
  .object({
    expected: expectedSchema,
    result: resultSchema,
    scenario: z
      .object({
        description: z.string().optional(),
        inputs: z.array(inputSchema),
        ruleRevision: z.string().min(1),
        scenarioId: z.string().min(1),
        title: z.string().optional(),
        weapon: weaponSchema
      })
      .loose(),
    status: z.enum(["failed", "passed"]),
    timing: z
      .object({
        contactMinimumUs: z.int().nonnegative().optional(),
        lockoutUs: z.int().nonnegative().optional(),
        reason: z.string().optional(),
        status: z.enum(["available", "unavailable"])
      })
      .loose()
  })
  .loose()
const plannedCaseSchema = z
  .object({
    evidence: z.object({ reason: z.literal("evidence-incomplete"), status: z.literal("incomplete") }),
    expected: z.null(),
    result: z.null(),
    scenario: z
      .object({
        description: z.string().optional(),
        scenarioIds: z
          .array(z.string().min(1))
          .min(1)
          .refine((scenarioIds) => new Set(scenarioIds).size === scenarioIds.length),
        traceabilityId: z.string().min(1),
        weapon: weaponSchema
      })
      .loose(),
    status: z.literal("planned-requirement")
  })
  .loose()
const reportSchema = z
  .object({
    cases: z.array(z.union([executableCaseSchema, plannedCaseSchema])),
    reportId: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
    summary: z.object({
      executable: z.object({
        failed: z.int().nonnegative(),
        passed: z.int().nonnegative(),
        total: z.int().nonnegative()
      }),
      plannedRequirements: z.int().nonnegative()
    })
  })
  .superRefine((report, context) => {
    const failed = report.cases.filter((testCase) => testCase.status === "failed").length
    const passed = report.cases.filter((testCase) => testCase.status === "passed").length
    const plannedRequirements = report.cases.filter((testCase) => testCase.status === "planned-requirement").length
    if (
      report.summary.executable.failed !== failed ||
      report.summary.executable.passed !== passed ||
      report.summary.executable.total !== failed + passed ||
      report.summary.plannedRequirements !== plannedRequirements
    ) {
      context.addIssue({ code: "custom", message: "Report summary does not match the parsed cases", path: ["summary"] })
    }
  })

export type ExecutableSimulatorCase = z.infer<typeof executableCaseSchema> & ScenarioDisplayCase
export type PlannedSimulatorCase = z.infer<typeof plannedCaseSchema>
export type SimulatorCase = ExecutableSimulatorCase | PlannedSimulatorCase
export type SimulatorReport = Omit<z.infer<typeof reportSchema>, "cases"> & { cases: SimulatorCase[] }

export function isExecutableCase(testCase: SimulatorCase): testCase is ExecutableSimulatorCase {
  return testCase.status === "failed" || testCase.status === "passed"
}

export async function fetchSimulatorReport(path: string, init?: RequestInit): Promise<SimulatorReport> {
  const response = await fetch(path, init)
  if (!response.ok) throw new Error(`The scenario runner returned ${response.status}`)
  const parsed = reportSchema.parse(await response.json())
  return { ...parsed, cases: parsed.cases }
}
