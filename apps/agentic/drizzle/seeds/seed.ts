import { resolveRuntimeSecrets } from "../../src/azure/secretProvider"
import { createControlPlaneRuntime } from "../../src/persistence/controlPlaneRuntime"
import { seedExampleWorkflows } from "./examples"

const environment = await resolveRuntimeSecrets(process.env, ["POSTGRES_API_URL"])
const runtime = await createControlPlaneRuntime(environment)

try {
  const results = await seedExampleWorkflows(runtime.workflowStore)
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)
} finally {
  await runtime.close()
}
