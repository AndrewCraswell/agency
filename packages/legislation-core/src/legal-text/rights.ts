import { digest } from "@repo/legislation-core/legal-text/contracts"
import { assertRights } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"

export async function requireRights(
  client: Pick<pg.PoolClient, "query">,
  profile: string,
  operation: "retainRaw" | "displayText" | "localSearch" | "apiMcp"
) {
  const row = await client.query<{ policy: unknown; policy_hash: string }>(
    "SELECT policy,policy_hash FROM legislation.legal_rights_profiles WHERE id=$1 AND is_active FOR SHARE",
    [profile]
  )
  invariant(row.rows[0], "rights_profile_unavailable")
  const policy = assertRights(row.rows[0].policy, operation)
  invariant(digest(JSON.stringify(policy)) === row.rows[0].policy_hash, "rights_profile_modified")
}
