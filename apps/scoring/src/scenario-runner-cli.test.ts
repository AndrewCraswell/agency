import { createHash } from "node:crypto"
import * as fs from "node:fs"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  SCENARIO_RUN_CLI_REPORT_FORMAT,
  SCENARIO_RUN_CLI_REPORT_VERSION,
  runScenarioCli,
  serializeScenarioRunCliReport
} from "./scenario-runner-cli.js"
import { MAX_INPUT_FILE_BYTES } from "./scenario-runner.js"

const fixtureDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/golden-scenarios")
const temporaryDirectories: string[] = []

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "scoring-scenario-runner-cli-"))
  temporaryDirectories.push(directory)
  return directory
}

function fixturePath(name: string): string {
  return join(fixtureDirectory, name)
}

function digest(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

describe("scenario runner CLI", () => {
  it("emits byte-stable, content-addressed evidence for one scenario", () => {
    const path = fixturePath("epee-contact-boundaries.json")
    const first = runScenarioCli([path])
    const second = runScenarioCli([path])

    expect(first).toMatchObject({
      exitCode: 0,
      report: {
        command: "run-scenarios",
        error: null,
        format: SCENARIO_RUN_CLI_REPORT_FORMAT,
        input: { contentDigest: digest(path) },
        runnerReport: { status: "passed" },
        schemaVersion: SCENARIO_RUN_CLI_REPORT_VERSION,
        status: "completed"
      }
    })
    expect(serializeScenarioRunCliReport(first.report)).toBe(serializeScenarioRunCliReport(second.report))
  })

  it("returns the runner mismatch exit code without changing its authority", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "mismatch.json")
    const fixture = JSON.parse(readFileSync(fixturePath("epee-contact-boundaries.json"), "utf8")) as Record<
      string,
      unknown
    >
    const expectation = fixture.expect as Record<string, unknown>
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      path,
      `${JSON.stringify(
        { ...fixture, expect: { ...expectation, finalState: { hitCount: 99, isLocked: true } } },
        null,
        2
      )}\n`,
      "utf8"
    )

    expect(runScenarioCli([path])).toMatchObject({
      exitCode: 1,
      report: { error: null, runnerReport: { status: "failed" }, status: "completed" }
    })
  })

  it("replaces an oversized serialized result with a bounded error report", () => {
    const path = fixturePath("epee-contact-boundaries.json")

    expect(runScenarioCli([path], 1)).toMatchObject({
      exitCode: 2,
      report: {
        error: { code: "output-too-large" },
        input: { contentDigest: digest(path) },
        runnerReport: null,
        status: "output-too-large"
      }
    })
  })

  it("does not read an oversized input just to calculate its identity", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "too-large.json")
    writeFileSync(path, Buffer.alloc(MAX_INPUT_FILE_BYTES + 1))

    expect(runScenarioCli([path])).toMatchObject({
      exitCode: 2,
      report: { input: { contentDigest: null }, runnerReport: { error: { code: "input-too-large" } } }
    })
  })

  it.each([
    [[], "usage"],
    [["--json"], "unexpected-option"],
    [["one.json", "two.json"], "usage"],
    [["--input", "one.json"], "unexpected-option"],
    [["docs/golden-scenarios/epee-contact-boundaries.txt"], "invalid-path"]
  ])("rejects unsupported invocation %#", (arguments_, code) => {
    expect(runScenarioCli(arguments_)).toMatchObject({
      exitCode: 2,
      report: { error: { code }, runnerReport: null, status: "invalid-invocation" }
    })
  })

  it("rejects missing paths and directories", () => {
    const directory = temporaryDirectory()

    expect(runScenarioCli([join(directory, "missing.json")])).toMatchObject({
      exitCode: 2,
      report: { error: { code: "input-not-file" } }
    })
    expect(runScenarioCli([directory])).toMatchObject({
      exitCode: 2,
      report: { error: { code: "invalid-path" } }
    })
  })
})

it("reports the working directory and tolerates unavailable evidence digests", () => {
  expect(runScenarioCli([process.cwd()]).exitCode).toBe(2)
  const spy = vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
    throw new Error("read unavailable")
  })
  try {
    expect(runScenarioCli([fixturePath("epee-contact-boundaries.json")])).toMatchObject({
      exitCode: 0,
      report: { input: { contentDigest: null } }
    })
  } finally {
    spy.mockRestore()
  }
})

vi.mock("node:fs", { spy: true })
