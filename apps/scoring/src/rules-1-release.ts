export type RulesOneReleaseArtifact = Readonly<{
  id: string
  milestone: string
  path: string
  sourceDigest: string
}>

export type RulesOneReleaseVerification = Readonly<{
  command: string
  id: string
  requiredResult: "pass"
}>

export type RulesOneReleaseReview = Readonly<{
  approvalStatus: "approved-root" | "pending-root-final-review"
  requiredRole: "root-independent-reviewer"
  reviewer: string | null
}>

export type RulesOneRelease = Readonly<{
  artifacts: readonly RulesOneReleaseArtifact[]
  release: "rules-1"
  review: RulesOneReleaseReview
  schemaVersion: 1
  sourceRevision: string
  traceabilityIds: readonly string[]
  verification: readonly RulesOneReleaseVerification[]
}>

export type RulesOneReleaseDigestReader = (sourceRevision: string, path: string) => string

const REQUIRED_MILESTONES = ["M1-01", "M1-02", "M1-03", "M1-04", "M1-05", "M1-06", "M1-07", "M1-08", "M1-09", "M1-10"]
const KNOWN_EVIDENCE_OWNERS = ["M0-02", ...REQUIRED_MILESTONES]
const REQUIRED_TRACEABILITY_IDS = [
  "GEN-03",
  "GEN-04",
  "EPEE-01",
  "EPEE-02",
  "EPEE-03",
  "EPEE-04",
  "EPEE-05",
  "FOIL-01",
  "FOIL-02",
  "FOIL-03",
  "FOIL-04",
  "FOIL-05",
  "SABRE-01",
  "SABRE-02",
  "SABRE-03",
  "SABRE-04",
  "SABRE-05",
  "SABRE-06",
  "SABRE-07"
]
const REQUIRED_VERIFICATION_IDS = ["focused-rule-tests", "types", "lint", "format"]

const focusedRuleTests =
  "pnpm --filter scoring exec vitest run src/epee-state-machine-audit.test.ts src/epee.test.ts src/epee-contact-kernel.test.ts src/epee-resistance.test.ts src/foil.test.ts src/foil-insulation.test.ts src/sabre.test.ts src/bout-state.test.ts src/timing-table.test.ts src/timing-boundary.test.ts src/scoring-property-harness.test.ts src/reference-machine-comparison-capture.test.ts src/scoring-glossary-and-units.test.ts src/scoring-timestamp-guard.test.ts"
const focusedRuleSources =
  "src/epee-state-machine-audit.ts src/epee.ts src/epee-contact-kernel.ts src/epee-resistance.ts src/foil.ts src/foil-insulation.ts src/sabre.ts src/bout-state.ts src/timing-table.ts src/timing-boundary.ts src/scoring-property-harness.ts src/reference-machine-comparison-capture.ts src/canonical-data-clone.ts src/scoring-glossary-and-units.ts"

export const RULES_ONE_RELEASE = {
  artifacts: [
    {
      id: "traceability",
      milestone: "M1-01",
      path: "apps/scoring/docs/fie-traceability-matrix.md",
      sourceDigest: "sha256:aac131bc88fefd0fc03ca03f0955a62110090b50d56030c8612c56e061d5858e"
    },
    {
      id: "epee-audit-contract",
      milestone: "M1-01",
      path: "apps/scoring/docs/epee-state-machine-audit.md",
      sourceDigest: "sha256:4bf36edb7185b9654327f151a36745c289c678de81a0d3edd6e685a7ce96b67f"
    },
    {
      id: "epee-audit-source",
      milestone: "M1-01",
      path: "apps/scoring/src/epee-state-machine-audit.ts",
      sourceDigest: "sha256:4d0bd91a98393515ae642efbfd761c1f6b346915ae366d63e89f9d0755ec5dd4"
    },
    {
      id: "epee-audit-test",
      milestone: "M1-01",
      path: "apps/scoring/src/epee-state-machine-audit.test.ts",
      sourceDigest: "sha256:52b3a892327bc4476198887a3dc16b907a970b83e9717300e57262c8bb50ee2b"
    },
    {
      id: "timestamp-units-source",
      milestone: "M0-02",
      path: "apps/scoring/src/scoring-glossary-and-units.ts",
      sourceDigest: "sha256:c55f38f55dc171991879ed400713ce28bd95445543b01a10c4194a4f0127e821"
    },
    {
      id: "timestamp-units-test",
      milestone: "M0-02",
      path: "apps/scoring/src/scoring-glossary-and-units.test.ts",
      sourceDigest: "sha256:002caf16fac99549e37ad55e46953abc78f6fd8b2fae025c9d9993dd61c8ac74"
    },
    {
      id: "canonical-data-clone-source",
      milestone: "M1-01",
      path: "apps/scoring/src/canonical-data-clone.ts",
      sourceDigest: "sha256:f9d62891d5c12efc306a5561f7426d1c834df32c5e4b78cf4fe6eed9949ce394"
    },
    {
      id: "epee-source",
      milestone: "M1-01",
      path: "apps/scoring/src/epee.ts",
      sourceDigest: "sha256:428d020fd742bbed2de06b2dbef9722e807959bd9ef4c7e786c1593cb9269677"
    },
    {
      id: "epee-test",
      milestone: "M1-01",
      path: "apps/scoring/src/epee.test.ts",
      sourceDigest: "sha256:32778e202477deacf62318fb06bf0c0c5dd8d2a04a286afa14acc897e7da9108"
    },
    {
      id: "epee-contact-kernel-source",
      milestone: "M1-02",
      path: "apps/scoring/src/epee-contact-kernel.ts",
      sourceDigest: "sha256:68c8c2a3f2d34de922d38790e094f2f41d0e0b7061c8947812ece722e1c878a1"
    },
    {
      id: "epee-contact-kernel-test",
      milestone: "M1-02",
      path: "apps/scoring/src/epee-contact-kernel.test.ts",
      sourceDigest: "sha256:d330e532be88c24bd01dfc614a470f3142f595fad7d67626c47cd39ad72e5879"
    },
    {
      id: "timestamp-guard-test",
      milestone: "M1-01",
      path: "apps/scoring/src/scoring-timestamp-guard.test.ts",
      sourceDigest: "sha256:8d014e16ddc087cce8642c6b29804c432f9c63d353e037c3a2ef44a091997a64"
    },
    {
      id: "epee-resistance-contract",
      milestone: "M1-02",
      path: "apps/scoring/docs/epee-resistance-logical-cases.md",
      sourceDigest: "sha256:4283c786c6e83a1102df50282dc69f834dce565b713331719067562a17bcb872"
    },
    {
      id: "epee-resistance-source",
      milestone: "M1-02",
      path: "apps/scoring/src/epee-resistance.ts",
      sourceDigest: "sha256:c347542b3875c704340b174a2475dc1203e0b72c8c2cea650cc09b64c1a10584"
    },
    {
      id: "epee-resistance-test",
      milestone: "M1-02",
      path: "apps/scoring/src/epee-resistance.test.ts",
      sourceDigest: "sha256:23022234a4ac44ef4f758f797d5abae77c8e2b4577e9805d8c82f1b2f0eedc70"
    },
    {
      id: "foil-contract",
      milestone: "M1-03",
      path: "apps/scoring/docs/foil-state-machine-contract.md",
      sourceDigest: "sha256:346c11facbc1cad64fdf27a3ad52384a57f3da1a35e1660969558dbfd3a62fae"
    },
    {
      id: "foil-source",
      milestone: "M1-03",
      path: "apps/scoring/src/foil.ts",
      sourceDigest: "sha256:4627f31f522d662f5cbea7271d1fdb77f77dcb1cc51f11fc8dc857811ce62bea"
    },
    {
      id: "foil-test",
      milestone: "M1-03",
      path: "apps/scoring/src/foil.test.ts",
      sourceDigest: "sha256:4459f63c11c0cfe838e7ae6449fea919ee8b436ffffe1acf8da69eab9028eb36"
    },
    {
      id: "foil-insulation-contract",
      milestone: "M1-04",
      path: "apps/scoring/docs/foil-insulation-contract.md",
      sourceDigest: "sha256:4e7d323400ec1d0b1a78831b9baab6bb928ed3419144f709c43eb3e379e4b342"
    },
    {
      id: "foil-insulation-source",
      milestone: "M1-04",
      path: "apps/scoring/src/foil-insulation.ts",
      sourceDigest: "sha256:5ec955627dfc40ce2f301c5c66d21ac504aa4064c3cfbfcf15a1fb4f27da5ea5"
    },
    {
      id: "foil-insulation-test",
      milestone: "M1-04",
      path: "apps/scoring/src/foil-insulation.test.ts",
      sourceDigest: "sha256:a7b3ddbf65d2151ca69e44a4f774325f09abd855be2fbbf4575d5f700398e7e5"
    },
    {
      id: "sabre-contract",
      milestone: "M1-05",
      path: "apps/scoring/docs/sabre-state-machine-contract.md",
      sourceDigest: "sha256:a496d2b1442d734293ba30201095bff5466f773cdc19833323e8789202941dae"
    },
    {
      id: "sabre-source",
      milestone: "M1-05",
      path: "apps/scoring/src/sabre.ts",
      sourceDigest: "sha256:92b788e17614dda028efbe9025881b440f0efda4f116acbc54f57ad09b85ef15"
    },
    {
      id: "sabre-test",
      milestone: "M1-05",
      path: "apps/scoring/src/sabre.test.ts",
      sourceDigest: "sha256:5d0c3dc967a665d10c14b3a4d76ef1015460339eaed478353ba64740c61f893b"
    },
    {
      id: "bout-state-contract",
      milestone: "M1-06",
      path: "apps/scoring/docs/bout-state-contract.md",
      sourceDigest: "sha256:50839b49dadcd75ea5117766f75e95b7dc3fdcc80f602dea6aeccfd7bf627f94"
    },
    {
      id: "bout-state-source",
      milestone: "M1-06",
      path: "apps/scoring/src/bout-state.ts",
      sourceDigest: "sha256:b95701affb58d35fd36e07525d2db3b4dd9bb1416124ac8d8cd15f8d6010d948"
    },
    {
      id: "bout-state-test",
      milestone: "M1-06",
      path: "apps/scoring/src/bout-state.test.ts",
      sourceDigest: "sha256:56f1a52f97a83721381bf21dd31648024b6cf39c24413917cb0843f2b518660c"
    },
    {
      id: "timing-table-contract",
      milestone: "M1-07",
      path: "apps/scoring/docs/timing-table-contract.md",
      sourceDigest: "sha256:e32adcfd3375a6d52298ee63b643d6fdfb766646a7a97075013af382b322a48b"
    },
    {
      id: "timing-table-source",
      milestone: "M1-07",
      path: "apps/scoring/src/timing-table.ts",
      sourceDigest: "sha256:bb2978197c47c5b4cac53198b472bea42b3b6d3e6b08af406ad95de29083265c"
    },
    {
      id: "timing-table-test",
      milestone: "M1-07",
      path: "apps/scoring/src/timing-table.test.ts",
      sourceDigest: "sha256:419024cd012b3ccd8a1f180473d46ecfa478b12ecd093fd8da9e7b2156c7d53b"
    },
    {
      id: "timing-boundary-contract",
      milestone: "M1-08",
      path: "apps/scoring/docs/timing-boundary-vector-contract.md",
      sourceDigest: "sha256:d414edf3cbec75875a70d86c302d0b9cd7910ba3da9fe1fd7f20e102f5f14319"
    },
    {
      id: "timing-boundary-source",
      milestone: "M1-08",
      path: "apps/scoring/src/timing-boundary.ts",
      sourceDigest: "sha256:7f195c735b1d1c1ddace365cc43434d106876fdc138189c24e6a3e8e9c6d0c21"
    },
    {
      id: "timing-boundary-test",
      milestone: "M1-08",
      path: "apps/scoring/src/timing-boundary.test.ts",
      sourceDigest: "sha256:bd749620509930865aa141864a884fb82ed62efb838efe2ef7bdd9e2be92a972"
    },
    {
      id: "property-contract",
      milestone: "M1-09",
      path: "apps/scoring/docs/scoring-property-test-contract.md",
      sourceDigest: "sha256:9712d61d294e99e9574c7214df3a6d00813376cbb58a8983dfd7ea9c6e6e3ff0"
    },
    {
      id: "property-source",
      milestone: "M1-09",
      path: "apps/scoring/src/scoring-property-harness.ts",
      sourceDigest: "sha256:fc9d935049bfb82319a1cef758002ea6435f59780974f94ed4e95beee63dd2db"
    },
    {
      id: "property-test",
      milestone: "M1-09",
      path: "apps/scoring/src/scoring-property-harness.test.ts",
      sourceDigest: "sha256:7c829ea73b95d9d45370a29ec9230bc41fcdc4ac33eb4e5d63efb157f91c4372"
    },
    {
      id: "reference-capture-contract",
      milestone: "M1-10",
      path: "apps/scoring/docs/reference-machine-comparison-capture-contract.md",
      sourceDigest: "sha256:f62798dca964c8711bf15e1666a92e4e03fc2c7e69fa2ee50a58353df9a64fae"
    },
    {
      id: "reference-capture-source",
      milestone: "M1-10",
      path: "apps/scoring/src/reference-machine-comparison-capture.ts",
      sourceDigest: "sha256:3af0a285e6e5179f16abea0d7ca2888a9bb4305dfc5377f4adb28361261bfe15"
    },
    {
      id: "reference-capture-test",
      milestone: "M1-10",
      path: "apps/scoring/src/reference-machine-comparison-capture.test.ts",
      sourceDigest: "sha256:ac79b6114d53a97e3fb59c89cdab7b8f7f6fa07fc28fa1d3c544f5c3876c856a"
    }
  ],
  release: "rules-1",
  review: {
    approvalStatus: "approved-root",
    requiredRole: "root-independent-reviewer",
    reviewer: "root-independent-reviewer"
  },
  schemaVersion: 1,
  sourceRevision: "afc7e6d44dc80e1147e9990931dafe78271f6cfc",
  traceabilityIds: REQUIRED_TRACEABILITY_IDS,
  verification: [
    { command: focusedRuleTests, id: "focused-rule-tests", requiredResult: "pass" },
    { command: "pnpm --filter scoring check:types", id: "types", requiredResult: "pass" },
    {
      command: `pnpm --filter scoring exec oxlint --max-warnings=0 ${focusedRuleSources} src/rules-1-release.ts src/rules-1-release.test.ts`,
      id: "lint",
      requiredResult: "pass"
    },
    {
      command: `pnpm --filter scoring exec oxfmt --check ${focusedRuleSources} src/rules-1-release.ts src/rules-1-release.test.ts`,
      id: "format",
      requiredResult: "pass"
    }
  ]
} satisfies RulesOneRelease

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function requireExactIdentifiers(label: string, values: readonly string[], expected: readonly string[]): void {
  if (
    new Set(values).size !== values.length ||
    values.length !== expected.length ||
    !values.every((value, index) => value === expected[index])
  ) {
    throw new RangeError(`Invalid rules-1 ${label}`)
  }
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value)
}

function validateArtifact(value: unknown): value is RulesOneReleaseArtifact {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "milestone", "path", "sourceDigest"]) &&
    typeof value.id === "string" &&
    typeof value.milestone === "string" &&
    KNOWN_EVIDENCE_OWNERS.includes(value.milestone) &&
    typeof value.path === "string" &&
    value.path.startsWith("apps/scoring/") &&
    isDigest(value.sourceDigest)
  )
}

function validateVerification(value: unknown): value is RulesOneReleaseVerification {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["command", "id", "requiredResult"]) &&
    typeof value.command === "string" &&
    value.command.startsWith("pnpm --filter scoring ") &&
    typeof value.id === "string" &&
    value.requiredResult === "pass"
  )
}

function isRulesOneReleaseShape(value: unknown): value is RulesOneRelease {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "artifacts",
      "release",
      "review",
      "schemaVersion",
      "sourceRevision",
      "traceabilityIds",
      "verification"
    ]) &&
    value.release === "rules-1" &&
    value.schemaVersion === 1 &&
    typeof value.sourceRevision === "string" &&
    /^[a-f0-9]{40}$/.test(value.sourceRevision) &&
    Array.isArray(value.artifacts) &&
    value.artifacts.every(validateArtifact) &&
    Array.isArray(value.traceabilityIds) &&
    value.traceabilityIds.every((entry) => typeof entry === "string") &&
    Array.isArray(value.verification) &&
    value.verification.every(validateVerification) &&
    isRecord(value.review) &&
    hasExactKeys(value.review, ["approvalStatus", "requiredRole", "reviewer"]) &&
    value.review.requiredRole === "root-independent-reviewer" &&
    (value.review.approvalStatus === "approved-root" || value.review.approvalStatus === "pending-root-final-review") &&
    (value.review.reviewer === null || value.review.reviewer === "root-independent-reviewer")
  )
}

/** Validates the immutable host-only `rules-1` release handoff without loading any scorer or timing value. */
export function validateRulesOneRelease(value: unknown): RulesOneRelease {
  if (!isRulesOneReleaseShape(value)) {
    throw new TypeError("Invalid rules-1 release record")
  }

  requireExactIdentifiers("traceability identities", value.traceabilityIds, REQUIRED_TRACEABILITY_IDS)
  requireExactIdentifiers(
    "verification identities",
    value.verification.map((entry) => entry.id),
    REQUIRED_VERIFICATION_IDS
  )

  const artifactIds = value.artifacts.map((artifact) => artifact.id)
  const artifactPaths = value.artifacts.map((artifact) => artifact.path)
  if (new Set(artifactIds).size !== artifactIds.length || new Set(artifactPaths).size !== artifactPaths.length) {
    throw new RangeError("Invalid rules-1 artifact identities")
  }
  for (const milestone of REQUIRED_MILESTONES) {
    if (!value.artifacts.some((artifact) => artifact.milestone === milestone)) {
      throw new RangeError("Incomplete rules-1 milestone evidence")
    }
  }
  if (
    (value.review.approvalStatus === "pending-root-final-review" && value.review.reviewer !== null) ||
    (value.review.approvalStatus === "approved-root" && value.review.reviewer !== "root-independent-reviewer")
  ) {
    throw new RangeError("Invalid rules-1 review handoff")
  }

  return value
}

/**
 * Verifies the declared source digests through an injected snapshot reader.
 * The host test supplies Git; browser and firmware consumers need not import
 * a filesystem or process API.
 */
export function verifyRulesOneReleaseSourceSnapshot(
  value: unknown,
  readDigest: RulesOneReleaseDigestReader
): RulesOneRelease {
  const release = validateRulesOneRelease(value)
  for (const artifact of release.artifacts) {
    if (readDigest(release.sourceRevision, artifact.path) !== artifact.sourceDigest) {
      throw new RangeError(`Stale rules-1 source digest: ${artifact.path}`)
    }
  }
  return release
}
