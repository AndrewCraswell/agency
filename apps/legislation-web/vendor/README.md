# AI SDK archive

The user authorized a downloaded archive on September 15, 2026 because public npm is blocked on the development VPN and
the configured Microsoft feed serves an unrelated `ai@0.14.1` package. Its direct `ai@7.0.94` tarball URL also
returned 404. Registry configuration and TLS verification were not changed.

## Artifact and verification

- File: `ai-7.0.94.tgz`, containing Vercel AI SDK `ai@7.0.94`.
- Official release: https://github.com/vercel/ai/releases/tag/ai%407.0.94
- Published file manifest: https://unpkg.com/ai@7.0.94/?meta
- Published files: https://unpkg.com/ai@7.0.94/
- All 640 files were downloaded and checked against the manifest's SHA-256 integrity and byte length.
- Published files, including package metadata and licenses, were retained unchanged under `package/`.
- Local archive SHA-256: `1c0b05fa952ad6de2b2f245a9a9fe9e7dac03d59f806dfa51aea797928cf973f`.

This is a **rebuilt archive**, not the original npm tarball. Per-file checksums establish consistency with UNPKG's
manifest, not independent npm provenance verification. No upstream npm tarball integrity or attestation is claimed.

## Installation

The app references the archive directly. Root and Railway workspace files override only `ai@7.0.94` to the same archive
so the React adapter resolves the identical core. All other dependencies still resolve through the configured registry.
Keep the archive available with the lockfile; the Docker build already copies the application directory.

Use `pnpm install --frozen-lockfile` from the repository root. A full workspace install is required for the hoisted
development layout; a filtered install left incomplete dependency directories during this setup.

Verified imports: `streamText` and `tool` from `ai`, `useChat` from `@ai-sdk/react@4.0.97`, `createMCPClient` from
`@ai-sdk/mcp@2.0.46`, and `createOpenRouter` from `@openrouter/ai-sdk-provider@3.0.0`. Import verification makes no
model request and does not establish live chat or deployment acceptance.

When the approved feed can serve the correct package, replace the direct archive dependency with an exact registry
version and remove both archive overrides in the same lockfile update. Revalidate imports and the application build.
