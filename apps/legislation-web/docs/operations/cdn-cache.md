# CDN cache operations

Railway CDN caching is enabled only for production `legislation-web` until a persistent staging W service exists. The
service uses HTML mode `Auto`, honors stale-while-revalidate directives, uses a two-hour fallback TTL and purges HTML
after successful deployments.

## Cache contract

| Surface | Origin contract | Expected edge result |
| --- | --- | --- |
| `/_next/static/*` | Fingerprinted assets with immutable headers | `MISS`, then `HIT` |
| `/_next/image` | Next.js-generated cache headers | Follow origin freshness |
| `/representatives` | Public static HTML with `s-maxage` | `MISS`, then `HIT` |
| `/` | Runtime-dependent HTML with `private, no-store` | `DYNAMIC` |
| `/conversations/*`, `/records/*` | Personalized or request-dependent HTML with `private, no-store` | `DYNAMIC` |
| `/api/*`, `/chat` | Authenticated or personalized responses with `private, no-store` | `DYNAMIC` |
| `/health`, `/ready` | Live operational responses with `private, no-store` | `DYNAMIC` |
| Any authorized request | Authorization request header | No cache lookup |
| Any response with `Set-Cookie`, `private`, `no-store`, `Vary: *` or `Vary: Cookie` | Railway skip condition | `DYNAMIC` |

Run the production-safe acceptance probe from the repository root:

```powershell
$env:LEGISLATION_CDN_SMOKE_BASE_URL = "https://legislation-web-production-b024.up.railway.app"
pnpm --filter legislation-web smoke:cdn
```

## Purge operations

Fingerprint changes make old `/_next/static/*` assets unreachable after a release, so normal deployments must not purge
the full cache. Railway automatically purges HTML after successful W deployments.

Use an HTML purge when incorrect public HTML remains cached after a correction:

```powershell
railway cdn purge html --project 2378281c-c1c7-4530-8525-5f313741d19b --environment production --service legislation-web
```

Use a full purge only when cached non-HTML content is unsafe or materially incorrect:

```powershell
railway cdn purge all --project 2378281c-c1c7-4530-8525-5f313741d19b --environment production --service legislation-web
```

Railway purges are service-wide; per-URL purge is not supported. Record the incident, reason, command scope and operator.
After any purge, run `smoke:cdn` and verify the corrected browser workflow. Disable CDN globally only when unsafe cached
content continues to be served after a confirmed full purge.
