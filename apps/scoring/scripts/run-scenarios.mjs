import { serializeScenarioRunReport, runScenario } from "../dist/scenario-runner.js"

const inputPath = process.argv[2]
if (inputPath === undefined || process.argv.length !== 3) {
  const report = {
    error: { code: "usage" },
    format: "scoring-golden-run-report",
    input: { kind: "scenario", path: "" },
    runner: "golden-scenario-runner",
    schemaVersion: "1.0.0",
    scenarios: [],
    status: "invalid-input",
    summary: { failed: 0, passed: 0, scenarioCount: 0 }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.exitCode = 2
} else {
  const run = runScenario(inputPath)
  process.stdout.write(serializeScenarioRunReport(run.report))
  process.exitCode = run.exitCode
}
