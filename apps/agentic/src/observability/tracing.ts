import { traceable } from "langsmith/traceable"

export type TraceOperationOptions = {
  name: string
  metadata: Readonly<Record<string, string | number | boolean>>
  tags?: readonly string[]
}

export async function traceOperation<Result>(
  options: TraceOperationOptions,
  operation: () => Promise<Result>
): Promise<Result> {
  const tracedOperation = traceable(operation, {
    name: options.name,
    metadata: { ...options.metadata },
    tags: options.tags === undefined ? undefined : [...options.tags],
    tracingEnabled: process.env.LANGSMITH_TRACING === "true",
    processInputs: () => ({}),
    processOutputs: () => ({ status: "completed" })
  })
  return tracedOperation()
}
