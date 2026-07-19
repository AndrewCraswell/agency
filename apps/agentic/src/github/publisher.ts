import type { Assignment } from "../contracts/assignment"
import type { WorkerResult } from "../contracts/results"
import type { PublicationResult } from "../orchestrator/state"

export type DraftPullRequestInput = {
  assignment: Assignment
  workerResult: WorkerResult
  patchArtifactPath: string
}

export type DraftPullRequestPublisher = {
  publish(input: DraftPullRequestInput): Promise<PublicationResult>
}
