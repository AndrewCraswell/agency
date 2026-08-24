/**
 * Bounded command-line adapter for the golden scenario runner.
 *
 * This module owns command parsing and evidence presentation only. Scenario
 * validation, execution, and comparison remain exclusively in scenario-runner.
 */

import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import { basename, extname, relative, resolve, sep } from "node:path"
import { MAX_INPUT_FILE_BYTES, runScenario, type ScenarioRun, type ScenarioRunReport } from "./scenario-runner.js"

export const SCENARIO_RUN_CLI_REPORT_FORMAT = "scoring-golden-scenario-cli-report" as const
export const SCENARIO_RUN_CLI_REPORT_VERSION = "1.0.0" as const
export const MAX_SCENARIO_RUN_CLI_REPORT_BYTES = 4 * 1024 * 1024

type CliErrorCode = "input-not-file" | "invalid-path" | "unexpected-option" | "usage"

type CliReportError = CliErrorCode | "output-too-large"

export type ScenarioRunCliReport = Readonly<{
  command: "run-scenarios"
  error: { code: CliReportError } | null
  format: typeof SCENARIO_RUN_CLI_REPORT_FORMAT
  input: { contentDigest: string | null; path: string | null }
  runnerReport: ScenarioRunReport | null
  schemaVersion: typeof SCENARIO_RUN_CLI_REPORT_VERSION
  status: "completed" | "invalid-invocation" | "output-too-large"
}>

export type ScenarioRunCliResult = Readonly<{
  exitCode: 0 | 1 | 2
  report: ScenarioRunCliReport
}>

function pathForReport(filePath: string): string {
  const cwdRelative = relative(process.cwd(), filePath)
  return (cwdRelative.length === 0 ? basename(filePath) : cwdRelative).split(sep).join("/")
}

function errorResult(code: CliErrorCode, inputPath: string | null = null): ScenarioRunCliResult {
  return {
    exitCode: 2,
    report: {
      command: "run-scenarios",
      error: { code },
      format: SCENARIO_RUN_CLI_REPORT_FORMAT,
      input: { contentDigest: null, path: inputPath },
      runnerReport: null,
      schemaVersion: SCENARIO_RUN_CLI_REPORT_VERSION,
      status: "invalid-invocation"
    }
  }
}

function resolveInputPath(arguments_: readonly string[]): { path: string } | ScenarioRunCliResult {
  if (arguments_.length === 0) return errorResult("usage")
  if (arguments_.length !== 1)
    return errorResult(arguments_.some((argument) => argument.startsWith("-")) ? "unexpected-option" : "usage")

  if (arguments_[0].startsWith("-")) return errorResult("unexpected-option")

  const inputPath = resolve(arguments_[0])
  const reportPath = pathForReport(inputPath)
  if (extname(inputPath) !== ".json") return errorResult("invalid-path", reportPath)
  if (!existsSync(inputPath) || !statSync(inputPath).isFile()) return errorResult("input-not-file", reportPath)
  return { path: inputPath }
}

function inputDigest(inputPath: string): string | null {
  try {
    if (statSync(inputPath).size > MAX_INPUT_FILE_BYTES) return null
    return `sha256:${createHash("sha256").update(readFileSync(inputPath)).digest("hex")}`
  } catch {
    return null
  }
}

function isCliResult(value: { path: string } | ScenarioRunCliResult): value is ScenarioRunCliResult {
  return "exitCode" in value
}

function outputTooLarge(inputPath: string, contentDigest: string | null): ScenarioRunCliResult {
  return {
    exitCode: 2,
    report: {
      command: "run-scenarios",
      error: { code: "output-too-large" },
      format: SCENARIO_RUN_CLI_REPORT_FORMAT,
      input: { contentDigest, path: pathForReport(inputPath) },
      runnerReport: null,
      schemaVersion: SCENARIO_RUN_CLI_REPORT_VERSION,
      status: "output-too-large"
    }
  }
}

function completedReport(inputPath: string, contentDigest: string | null, run: ScenarioRun): ScenarioRunCliReport {
  return {
    command: "run-scenarios",
    error: null,
    format: SCENARIO_RUN_CLI_REPORT_FORMAT,
    input: { contentDigest, path: pathForReport(inputPath) },
    runnerReport: run.report,
    schemaVersion: SCENARIO_RUN_CLI_REPORT_VERSION,
    status: "completed"
  }
}

/**
 * Executes exactly one scenario document or corpus manifest from one JSON
 * pathname. No flags or option aliases are accepted.
 */
export function runScenarioCli(
  arguments_: readonly string[],
  outputByteLimit = MAX_SCENARIO_RUN_CLI_REPORT_BYTES
): ScenarioRunCliResult {
  const input = resolveInputPath(arguments_)
  if (isCliResult(input)) return input

  const contentDigest = inputDigest(input.path)
  const run = runScenario(input.path)
  const result: ScenarioRunCliResult = {
    exitCode: run.exitCode,
    report: completedReport(input.path, contentDigest, run)
  }
  if (Buffer.byteLength(serializeScenarioRunCliReport(result.report), "utf8") > outputByteLimit)
    return outputTooLarge(input.path, contentDigest)
  return result
}

export function serializeScenarioRunCliReport(report: ScenarioRunCliReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
