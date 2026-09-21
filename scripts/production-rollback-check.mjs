import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

const fullCommitSha = /^[0-9a-f]{40}$/u
const migrationRoot = "packages/legislation-core/src/database/"

export function assertRollbackCompatible({ currentSha, targetSha, rollbackMcp, rollbackWeb }, git = execFileSync) {
  if (!fullCommitSha.test(currentSha) || !fullCommitSha.test(targetSha)) {
    throw new Error("Rollback commits must be full Git commit SHAs")
  }
  if (!rollbackMcp && !rollbackWeb) throw new Error("At least one application rollback must be selected")
  git("git", ["merge-base", "--is-ancestor", targetSha, currentSha], { stdio: "ignore" })
  if (rollbackWeb) {
    const databaseChanges = git("git", ["diff", "--name-only", targetSha, currentSha, "--", migrationRoot], {
      encoding: "utf8"
    })
      .split(/\r?\n/u)
      .filter(Boolean)
    if (databaseChanges.length > 0) {
      throw new Error("W rollback crosses a database contract change; use a reviewed forward fix or database restore")
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  assertRollbackCompatible({
    currentSha: process.env.CURRENT_COMMIT_SHA?.trim().toLowerCase() ?? "",
    rollbackMcp: process.env.ROLLBACK_MCP === "true",
    rollbackWeb: process.env.ROLLBACK_WEB === "true",
    targetSha: process.env.ROLLBACK_COMMIT_SHA?.trim().toLowerCase() ?? ""
  })
}
