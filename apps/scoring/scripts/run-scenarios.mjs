import { runScenarioCli, serializeScenarioRunCliReport } from "../dist/scenario-runner-cli.js"

const run = runScenarioCli(process.argv.slice(2))
process.stdout.write(serializeScenarioRunCliReport(run.report))
process.exitCode = run.exitCode
