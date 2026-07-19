import { traceable } from "langsmith/traceable"

export type TraceReference = {
  traceId: string
  runId: string
  projectName: string
  name: string
}

export type TraceOperationOptions = {
  name: string
  metadata: Readonly<Record<string, string | number | boolean>>
  tags?: readonly string[]
  onTrace?: (reference: TraceReference) => void | Promise<void>
}

export async function traceOperation<Result>(
  options: TraceOperationOptions,
  operation: () => Promise<Result>
): Promise<Result> {
  let reference: TraceReference | null = null
  const tracedOperation = traceable(
    async () => {
      if (reference !== null) {
        await options.onTrace?.(reference)
      }
      return operation()
    },
    {
      name: options.name,
      metadata: { ...options.metadata },
      tags: options.tags === undefined ? undefined : [...options.tags],
      tracingEnabled: process.env.LANGSMITH_TRACING === "true",
      processInputs: () => ({}),
      processOutputs: () => ({ status: "completed" }),
      on_start: (runTree) => {
        if (runTree !== undefined) {
          reference = {
            traceId: runTree.trace_id,
            runId: runTree.id,
            projectName: runTree.project_name,
            name: options.name
          }
        }
      }
    }
  )
  return tracedOperation()
}
