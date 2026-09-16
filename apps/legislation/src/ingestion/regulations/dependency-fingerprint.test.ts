import { expect, it } from "vitest"
import { stringify } from "yaml"
import { regulatoryDependencyFingerprint } from "./dependency-fingerprint.js"

function fixture() {
  return {
    lockfileVersion: "9.0",
    importers: {
      "apps/legislation": {
        dependencies: { parser: { specifier: "1.0.0", version: "1.0.0(peer@2.0.0)" }, frontend: { version: "3.0.0" } }
      },
      other: { dependencies: { unrelated: { version: "1.0.0" } } }
    },
    packages: {
      "parser@1.0.0": { resolution: { integrity: "parser-integrity" } },
      "peer@2.0.0": { resolution: { integrity: "peer-integrity" } },
      "native@1.0.0": { resolution: { integrity: "native-integrity" } },
      "frontend@3.0.0": { resolution: { integrity: "frontend-integrity" } }
    },
    snapshots: {
      "parser@1.0.0(peer@2.0.0)": { dependencies: { peer: "2.0.0" }, optionalDependencies: { native: "1.0.0" } },
      "peer@2.0.0": { dependencies: { parser: "1.0.0(peer@2.0.0)" } },
      "native@1.0.0": {},
      "frontend@3.0.0": {}
    },
    patchedDependencies: { "parser@1.0.0": { hash: "source-patch" } }
  }
}
const fingerprint = (value: unknown) =>
  regulatoryDependencyFingerprint(stringify(value), "apps/legislation", ["parser"])

it("ignores unrelated frontend and workspace updates while binding the cyclic transitive/peer/optional closure", () => {
  const lock = fixture()
  const original = fingerprint(lock)
  lock.importers["apps/legislation"].dependencies.frontend.version = "4.0.0"
  lock.importers.other.dependencies.unrelated.version = "2.0.0"
  lock.packages["frontend@3.0.0"].resolution.integrity = "unrelated-change"
  expect(fingerprint(lock)).toBe(original)
  lock.packages["peer@2.0.0"].resolution.integrity = "changed-peer"
  expect(fingerprint(lock)).not.toBe(original)
})

it("binds optional dependency artifacts and selected patches", () => {
  for (const modify of [
    (lock: ReturnType<typeof fixture>) => {
      lock.packages["native@1.0.0"].resolution.integrity = "changed"
    },
    (lock: ReturnType<typeof fixture>) => {
      lock.patchedDependencies["parser@1.0.0"].hash = "changed"
    }
  ]) {
    const lock = fixture()
    const original = fingerprint(lock)
    modify(lock)
    expect(fingerprint(lock)).not.toBe(original)
  }
})

it("refuses an unresolved transitive optional dependency", () => {
  const lock = fixture()
  lock.snapshots["parser@1.0.0(peer@2.0.0)"].optionalDependencies.native = "2.0.0"
  expect(() => fingerprint(lock)).toThrow("shape_dependency_package_missing")
})

it("is stable across mapping order and YAML formatting", () => {
  const lock = fixture()
  const reordered = { ...lock, packages: Object.fromEntries(Object.entries(lock.packages).reverse()) }
  expect(fingerprint(reordered)).toBe(fingerprint(lock))
  expect(regulatoryDependencyFingerprint(JSON.stringify(lock), "apps/legislation", ["parser"])).toBe(fingerprint(lock))
})

it("rejects missing roots, unsupported references, missing snapshots and duplicate YAML keys", () => {
  const lock = fixture()
  expect(() => regulatoryDependencyFingerprint(stringify(lock), "absent", ["parser"])).toThrow(
    "shape_dependency_roots_invalid"
  )
  expect(() => regulatoryDependencyFingerprint(stringify(lock), "apps/legislation", ["missing"])).toThrow(
    "shape_dependency_root_missing"
  )
  expect(() => regulatoryDependencyFingerprint(stringify(lock), "apps/legislation", ["parser", "parser"])).toThrow(
    "shape_dependency_roots_invalid"
  )
  expect(() =>
    regulatoryDependencyFingerprint("lockfileVersion: '9.0'\nlockfileVersion: '9.0'", "apps/legislation", ["parser"])
  ).toThrow("shape_dependency_lock_invalid")
  lock.importers["apps/legislation"].dependencies.parser.version = "file:parser.tgz"
  expect(() => fingerprint(lock)).toThrow("shape_dependency_reference_unsupported")
  lock.importers["apps/legislation"].dependencies.parser.version = "2.0.0"
  expect(() => fingerprint(lock)).toThrow("shape_dependency_package_missing")
})
