import { basename, resolve } from "node:path"
import { z } from "zod"
import { AzureBlobArtifactStore, LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { inventoryPeopleHistory } from "../src/ingestion/openstates/people-history.js"
import { validatePeopleRepositorySnapshot } from "../src/ingestion/openstates/people-repository.js"
import { planPeopleLegislativeTerms } from "../src/ingestion/openstates/people-term-plan.js"
import { archivePeoplePilot, readArchivedPeoplePilot } from "../src/ingestion/openstates/pilot-archive.js"

const directory = process.argv[2]
const destination = process.argv[3]
const lane = z.enum(["entities", "history"]).parse(process.argv[4] ?? "entities")
const state = z.enum(["nc", "ak"]).parse(process.argv[5] ?? "nc")
if (!directory || !destination) {
  throw new Error(
    "Usage: pnpm archive:openstates-pilot <run-directory> <local-directory|azure> [entities|history] [nc|ak]"
  )
}
const account = process.env.AZURE_STORAGE_ACCOUNT
if (destination === "azure" && !account) {
  throw new Error("AZURE_STORAGE_ACCOUNT is required")
}
const target =
  destination === "azure" ? new AzureBlobArtifactStore(account!, "state-sources") : new LocalArtifactStore(destination)
const archived = await archivePeoplePilot(
  new LocalArtifactStore(directory),
  target,
  basename(resolve(directory)),
  lane,
  state
)
const replay = await readArchivedPeoplePilot(target, archived.manifestPath)
if (replay.lane === "history") {
  const { sourceRoles: _roles, ...result } = inventoryPeopleHistory(replay.files, replay.state)
  const plan = planPeopleLegislativeTerms(replay.files, replay.retrievedAt, replay.state)
  process.stdout.write(`${JSON.stringify({ ...archived, ...result, plannedTerms: plan.terms.length })}\n`)
} else {
  const result = validatePeopleRepositorySnapshot(replay.files, replay.retrievedAt, replay.state)
  process.stdout.write(
    `${JSON.stringify({ ...archived, replayStatus: result.status, coverageIssues: result.coverageIssues })}\n`
  )
}
// A rejected source snapshot is still archived successfully for diagnosis.
