import { createHash, randomUUID } from "node:crypto"
import { z } from "zod"
import { agents } from "../contracts/agent"
import type { LinearClient } from "../linear/client"
import type { BindWorkflowRunInput, ControlPlaneStore } from "../persistence/controlPlaneStore"

const SchedulerOptionsSchema = z
  .object({
    repositoryOwner: z.string().trim().min(1),
    repositoryName: z.string().trim().min(1)
  })
  .strict()

function requestDigest(input: Omit<BindWorkflowRunInput, "requestDigest">): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex")
}

export class ScrumMasterScheduler {
  readonly #linear: Pick<LinearClient, "listCandidates">
  readonly #store: ControlPlaneStore
  readonly #options: z.output<typeof SchedulerOptionsSchema>
  readonly #runId: () => string
  #scheduling = false

  constructor(
    linear: Pick<LinearClient, "listCandidates">,
    store: ControlPlaneStore,
    options: z.input<typeof SchedulerOptionsSchema>,
    runId: () => string = randomUUID
  ) {
    this.#linear = linear
    this.#store = store
    this.#options = SchedulerOptionsSchema.parse(options)
    this.#runId = runId
  }

  async schedule(): Promise<boolean> {
    if (this.#scheduling) {
      return false
    }
    this.#scheduling = true
    try {
      const [candidateList, runs] = await Promise.all([
        this.#linear.listCandidates(50),
        this.#store.listWorkflowRuns(200)
      ])
      const activeRuns = runs.filter((run) => run.status === "queued" || run.status === "running")
      if (activeRuns.some((run) => run.sourceWorkItemId === null)) {
        return false
      }
      const availableEngineer = agents.find(
        (agent) => agent.role === "engineer" && !activeRuns.some((run) => run.assignedAgentId === agent.id)
      )
      if (availableEngineer === undefined) {
        return false
      }
      const handledWorkItemIds = new Set(
        runs.flatMap((run) => (run.sourceWorkItemId === null ? [] : [run.sourceWorkItemId]))
      )
      if (!candidateList.issues.some((issue) => !handledWorkItemIds.has(issue.id))) {
        return false
      }
      const inputWithoutDigest = {
        runId: this.#runId(),
        graphVersion: "delivery-v2",
        repositoryOwner: this.#options.repositoryOwner,
        repositoryName: this.#options.repositoryName
      }
      const run = await this.#store.bindWorkflowRun({
        ...inputWithoutDigest,
        requestDigest: requestDigest(inputWithoutDigest)
      })
      await this.#store.recordWorkflowEvent(run.runId, {
        sourceId: "scrum-master-scheduled",
        node: "scheduleScrumMaster",
        outcome: "completed",
        summary: `Scheduled independent scrum-master review for ${candidateList.issues.length} dependency-ready tasks`,
        details: { availableAgentId: availableEngineer.id, candidateCount: candidateList.issues.length },
        createdAt: new Date()
      })
      return true
    } finally {
      this.#scheduling = false
    }
  }
}
