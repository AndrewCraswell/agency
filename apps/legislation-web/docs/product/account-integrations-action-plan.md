# Account, privacy and integrations action plan

Requirements retained from the September 15, 2026 review. This is pending design/implementation work, not a current
canvas census or release claim. Recheck named canvas anchors before changing them. Screen-count targets and duration
estimates are not acceptance criteria; reuse existing forms, inline states and consequence reviews.

The latest September 2026 scope decision removes in-app MCP connection status and standalone session-lifecycle screens.
MCP setup gives the server address, authentication method and steps; users verify access in their own client. Existing
sign-in/account flows still enforce expiry, sign-out, safe return and protected-data cleanup without new screen
families.

Scope and navigation belong to the [product specification](product-spec.md) and [IA](information-architecture.md).
[Pricing](pricing.md) owns commercial decisions, [authentication](../operations/authentication.md) owns provider setup,
and the [webhook contract](../engineering/api/subscriptions-and-webhooks.md) owns delivery/security behavior.

## Required behavior

| Area                 | Required behavior                                                                                                | Gate or constraint                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Account and sessions | Supported identity/settings and sign-out; preserve intended destination across reauthentication                  | Session inventory, remote sign-out and authorization revocation require verified provider support                             |
| Session expiry       | Handle within existing authentication flow; lock protected UI, block mutations and reject late private responses | No standalone session-lifecycle screens; local cleanup cannot depend on remote revocation and sign-in never replays an action |
| Data and privacy     | Actual held-data categories, policy links and one owning control per category                                    | No unsupported export/delete completion promises or universal Clear everything action                                         |
| Address              | One editor in Settings; manual discovery remains possible; resolve once and discard raw input by default         | Retention and boundary rechecks require separate approved contracts; working jurisdictions are not a home address             |
| Address outcomes     | Distinguish ambiguous candidates, unsupported coverage and provider failure; explicit removal consequences       | Resolve-once cleanup overrides ordinary draft recovery; no hidden retention or automatic representative/follow changes        |
| MCP                  | Actual environment URL, authentication method and supported client setup                                         | No in-app connection/verification status; verify access in the external client                                                |
| Webhooks             | Create/verify, detail, edit, rotate and remove using shared form/confirmation patterns                           | Safe HTTPS destination validation; secrets never in logs, model context or routine delivery details                           |
| Billing              | Provider-backed values under approved plan/entitlement policies                                                  | No invented invoice/renewal data, permanent unlimited promises or cancellation effect on follows                              |

## Webhook lifecycle

| Surface            | Content and state                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New destination    | Name, safe absolute HTTPS URL, event restrictions and inline validation                                                                                               |
| Verification       | One-time secret with deliberate reveal/copy, receiver setup and explicit verification; processing, timeout, non-success and challenge mismatch remain distinguishable |
| Destination detail | Lifecycle, restrictions, linked follows, key metadata and selected delivery history; edit/pause/rotate/remove only when authorized and supported                      |
| Secret rotation    | Preview overlap policy; show server-returned key identity and validity; reconcile lost responses against current active keys rather than revealing an obsolete secret |
| Consequence review | URL change requires reverification and an agreed queued-delivery policy; pause/remove previews affected channels and independently retained follows                   |

Use the same application-owned operation identity for unknown-outcome recovery. Do not blindly resend, rotate again or
infer recipient processing from endpoint acceptance. Pending, accepted, delivered, suppressed, failed and unknown are
not interchangeable; collapse attempts by default, not their meaning.

## Decisions before enabling controls

| Decision                                           | Owner and required evidence                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Retained address and removal                       | Product/privacy/provider: whether retention is offered, exactly what remains, and whether boundary rechecks exist         |
| Queued deliveries after destination change         | Product/backend: cancel, hold or explicitly reauthorize application-controlled dispatch; do not invent one policy in copy |
| Session/grant inventory and revocation             | Identity owner: verified AuthKit capabilities and safe behavior when provider calls fail                                  |
| Free boundaries, seats, cancellation and proration | Pricing/product: published terms and enforced entitlement behavior                                                        |
| Personal export                                    | Privacy/backend: included/excluded data, format, authentication, expiry, rights and retention                             |
| Account deletion                                   | Privacy/backend: synchronous/tracked outcome and recovery that remains usable after ordinary account access ends          |

Represent an unresolved decision in design annotations, not a working-looking control. Keep policy links and verified
support routes where useful; do not duplicate policy prose as a permanent interface tutorial.

## Canvas reconciliation

These are review anchors, not assertions that they remain unchanged. Do not retire components based on zero-use guesses.

| Earlier review anchors        | Check before implementation                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `a7zzi`, `rUBO5`, `vEsnC`     | One address owner and consistent retention wording; remove unsupported recheck timestamps/promises and duplicate editors |
| `mzh4Z`, `LWqXS`, `n5JKp`     | Reuse billing inline states; do not render unresolved commercial terms as facts                                          |
| `X6Gf7`, `FqTce`              | Supported account controls and a real Data and privacy destination; lifecycle gates visible in the handoff               |
| `ZSccR`, `iiu5Z`              | MCP instructions only, without connection status; complete supported webhook lifecycle without new primary navigation    |
| `D5zhUj` and session recovery | Concise failure/recovery and non-enumerating authentication; no privacy tutorial rail                                    |

## Acceptance

1. Account, privacy, address and personal representative views give one consistent account of stored data and ownership.
2. Ambiguous/failed address resolution preserves only permitted transient input; resolve-once and removal leave exactly
   the promised state and do not change research scope or follows.
3. Session expiry/sign-out lock protected content, survive provider failure, preserve safe return and reject stale
   responses.
4. MCP setup provides correct instructions without claiming to observe the client's connection or verification state.
5. Webhook verification, URL change, rotation and removal preserve security, confirmed consequences and recoverable
   outcomes.
6. Unapproved billing, export, deletion or provider capabilities remain gated rather than simulated as available.

Exercise desktop/mobile, keyboard, source return and failure/unknown variants. Start with truthful existing controls,
privacy/session recovery and then the supported webhook/MCP lifecycle. Add billing or retained-address flows only after
their decisions are approved. A static mockup is not provider or browser acceptance.
