import assert from "node:assert/strict"
import { test } from "node:test"
import { assertRollbackCompatible } from "./production-rollback-check.mjs"

const currentSha = "b".repeat(40)
const targetSha = "a".repeat(40)

test("accepts an application rollback that does not cross database changes", () => {
  const calls = []
  assertRollbackCompatible(
    { currentSha, targetSha, rollbackMcp: true, rollbackWeb: true },
    (_command, arguments_, options) => {
      calls.push(arguments_)
      return options?.encoding ? "" : Buffer.alloc(0)
    }
  )
  assert.equal(calls.length, 2)
})

test("blocks a W rollback across a database contract change", () => {
  assert.throws(
    () =>
      assertRollbackCompatible(
        { currentSha, targetSha, rollbackMcp: false, rollbackWeb: true },
        (_command, arguments_, options) =>
          options?.encoding && arguments_[0] === "diff"
            ? "packages/legislation-core/src/database/migrations/0001_change.sql\n"
            : Buffer.alloc(0)
      ),
    /crosses a database contract change/
  )
})

test("permits an M-only rollback without inspecting database files", () => {
  let calls = 0
  assertRollbackCompatible({ currentSha, targetSha, rollbackMcp: true, rollbackWeb: false }, () => {
    calls += 1
    return Buffer.alloc(0)
  })
  assert.equal(calls, 1)
})
