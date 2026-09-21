import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  adaptiveDecisionSchema,
  applicationUrl,
  approvedJurisdictions,
  scenarioSchema,
  validateAdaptiveDecision
} from "./scenario-policy"

const authored = {
  id: "moderate-goal",
  objective: "Compare the selected education proposals and their limitations.",
  jurisdictions: ["Puerto Rico", "Canada"],
  adaptive: { persona: "A reporter", constraints: [] },
  steps: [{ id: "identify", prompt: "Which education proposals matter here?" }]
}
const visible = { transcript: "Evidence unavailable", clarification: null, hasFailure: true }
const next = adaptiveDecisionSchema.parse({
  action: "follow-up",
  text: authored.steps[0]!.prompt,
  optionLabels: [],
  reason: "The service is now available; ask the same question intentionally."
})

describe("goal-driven policy", () => {
  it("accepts explicit jurisdictions, empty constraints, and long safe identifiers", () => {
    const scenario = scenarioSchema.parse({
      ...authored,
      id: "a".repeat(300),
      jurisdictions: Array.from({ length: 60 }, (_, index) => `Explicit region ${index}`)
    })
    expect(scenario.id).toHaveLength(300)
    expect(scenario.adaptive?.constraints).toEqual([])
    expect(approvedJurisdictions(scenario)).toHaveLength(60)
  })
  it.each(["../outside", "path/name", "a\\b", "..", "bad\0name"])("rejects unsafe path identifier %s", (id) => {
    expect(scenarioSchema.safeParse({ ...authored, id }).success).toBe(false)
  })
  it("rejects duplicate goals and unapproved narrowing", () => {
    expect(scenarioSchema.safeParse({ ...authored, steps: [authored.steps[0], authored.steps[0]] }).success).toBe(false)
    expect(
      scenarioSchema.safeParse({ ...authored, acceptedNarrowing: { jurisdictions: ["Japan"], reason: "Convenient" } })
        .success
    ).toBe(false)
  })
  it("has no fixed-script or grading contract", () => {
    expect(scenarioSchema.safeParse({ ...authored, maximumExchanges: 8 }).success).toBe(false)
    expect(scenarioSchema.safeParse({ ...authored, clarificationAnswers: [] }).success).toBe(false)
    expect(
      scenarioSchema.safeParse({ ...authored, steps: [{ ...authored.steps[0], requiresRecordsFrom: {} }] }).success
    ).toBe(false)
    expect(adaptiveDecisionSchema.safeParse({ ...next, goals: [] }).success).toBe(false)
  })
  it("accepts intentional repeated questions after failures", () => {
    expect(validateAdaptiveDecision(visible, next)).toEqual(next)
    expect(validateAdaptiveDecision(visible, next)).toEqual(next)
  })
  it("keeps the real application message contract", () => {
    expect(() => validateAdaptiveDecision(visible, { ...next, text: "x".repeat(24001) })).toThrow("24000")
  })
  it("accepts finish without evidence grading", () => {
    expect(validateAdaptiveDecision(visible, { ...next, action: "finish", text: "" }).action).toBe("finish")
  })
  it("validates the actual clarification controls", () => {
    const pending = {
      ...visible,
      clarification: {
        question: "Which region?",
        optionLabels: ["Canada", "Puerto Rico"],
        allowsText: false,
        multiple: false
      }
    }
    const answer = { ...next, action: "clarify" as const, text: "", optionLabels: ["Canada"] }
    expect(validateAdaptiveDecision(pending, answer)).toEqual(answer)
    expect(() => validateAdaptiveDecision(pending, { ...answer, optionLabels: ["Japan"] })).toThrow("controls")
    expect(() => validateAdaptiveDecision(pending, { ...answer, text: "Not supported" })).toThrow("controls")
    expect(() => validateAdaptiveDecision(pending, { ...next, action: "finish", text: "" })).toThrow("clarification")
  })
  it("allows explicitly selected remote origins and non-home entry paths", () => {
    expect(applicationUrl("https://staging.example.org/research").pathname).toBe("/research")
    expect(applicationUrl("http://localhost:3000/").origin).toBe("http://localhost:3000")
    expect(() => applicationUrl("https://user:secret@example.org/")).toThrow("credentials")
    expect(() => applicationUrl("file:///secret")).toThrow("HTTP")
  })
  it("validates the real CLI offline without inference", () => {
    const script = fileURLToPath(new URL("./run-scenarios.ts", import.meta.url))
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", script, "--scenario", "-", "--base-url", "https://staging.example.org/research"],
      { input: JSON.stringify(authored), encoding: "utf8" }
    )
    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toMatchObject({ mode: "plan", approvedJurisdictions: authored.jurisdictions })
  })
})
