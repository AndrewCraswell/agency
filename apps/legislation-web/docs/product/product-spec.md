# Legislative intelligence product specification

## Product direction

Updated September 15, 2026. Rostra helps a policy researcher **find relevant legislation, verify what changed, maintain
an issue, and prepare a cited member or client update**. The outcome is repeatable, checkable research with less preparation
and review work, not simply more tracked bills or another AI answer.

This specification owns product priorities and boundaries. The [information architecture](information-architecture.md)
owns navigation and proposed browser routes; the [design handoff](../design/design.md) owns detailed interactions and
acceptance. The [product backlog](../backlog/backlog.md) tracks delivery. Designs, API contracts and passing tests are
not interchangeable evidence of a released customer workflow.

## Primary user

| Priority | Customer and buyer | Job worth paying for | Qualification |
| --- | --- | --- | --- |
| Primary organization target | Trade associations/professional bodies with roughly 1-5 policy researchers; policy director or executive director buys | Recurring member/board updates, especially where cross-jurisdiction verification consumes substantial effort | Named issues, supported jurisdictions, recurring output and budget; team use requires delivered shared access/review |
| Initial individual entry | Independent consultants and boutique public-affairs researchers; owner or partner buys | Verified client answers and recurring client updates | Can evaluate one research task without replacing the firm's entire operating system |
| Selective next cohort | Funded advocacy/nonprofit policy teams; policy or program director buys | Evidence-based issue updates | Stable funding and a research need, not primarily mass outreach |

The [ICP strategy](icp.md) owns complete profiles and acquisition/economic hypotheses. These priorities are not validated
demand. Journalists, specialist lawyers and researchers can use the same evidence workflow without separate product modes.
Citizens do not set the paid roadmap; enterprise, public-sector and developer offers require their own qualification.

[Competitors by ICP](competitors.md) shows that tracking, AI, citations and comparisons already exist elsewhere. Start by
supplementing the buyer's existing tools on a real briefing task. Do not claim cheaper, faster or more accurate than a
competitor without comparable evidence, or promise to replace its CRM, news, public widgets or analyst service.

## Core jobs and experience

Conversation remains home and the flexible entry for a new question. Issues provide durable research and repeat work;
the user can open an issue, inspect evidence and prepare a brief directly without starting another conversation. No
dashboard, persona selection, mandatory issue creation or MCP setup stands before the first useful answer.

The [conversation integration design](../design/conversations.md) defines access from any surface, turns, rendered
content, references/citations, truthful work progress and explicit writes back to the owning feature. Chat history,
research references and saved findings/follows remain distinct; this does not add private reasoning display or a second
issue/brief editor.

| Job | Required journey | Successful outcome |
| --- | --- | --- |
| Answer a policy question | Select jurisdiction/session -> find candidates -> inspect source passages, actors and versions -> answer with citations | A useful answer with explicit scope and limitations; saving an issue is optional |
| Maintain an investigation | Create/reopen issue -> include or exclude records -> retain findings and annotations -> revise scope deliberately | Reusable research across conversations, without automatically following or approving every match |
| Prepare the recurring update | Select findings and reporting scope -> compare exact versions -> inspect evidence -> review and copy the brief | A checked member/client briefing input, not an automatically published report |
| Notice and assess changes | Explicitly follow records/queries -> review Updates or issue developments -> inspect change -> revise findings | Relevant legislative changes first; settings and delivery troubleshooting remain accessible but secondary |
| Collaborate when required | Use authorized workspace -> assign/review selected work -> approve an identified report revision -> share with intended audience | Organization-owned, isolated research; a separate delivery gate, not implied by personal review |

### Essential capabilities and distinctions

- Bills, representatives and committees remain first-class research/follow targets. Their activity, meetings, amendments,
  votes and materials support the research job; they do not require separate persona dashboards or new top-level hubs.
- Preserve canonical identity, official source links, exact document versions/passages and surrounding qualifiers.
  Every substantive generated claim must cite retrieved evidence. Separate official facts, generated interpretation
  and user assessment. Do not silently replace a saved citation with the latest text.
- Bill progress follows the applicable jurisdiction/measure process and recorded actions, not a completion percentage.
  Enactment is not the effective date; an individual's vote position is not the aggregate outcome; unknown is not No.
- An issue contains explicit scope, records, queries, exclusions and selected findings. A conversation contains questions
  and context. A follow controls monitoring. Opening evidence, adding context, including a record, reviewing a finding
  and following it are distinct actions. Do not combine their effects to reduce apparent steps.
- A personal brief preserves its selected evidence and review state. Changing its reviewed content or source selection
  requires review again. It is not independent approval, an immutable report archive or a shared-client entitlement.
- Keep one Updates inbox and bell state through Novu for in-app/email. Following defaults to matched legislative events;
  delivery history is secondary and attempts are disclosed on demand. Accepted, delivered, suppressed, failed and unknown
  remain distinct per channel/batch; receipt is not human review. No guaranteed alert arrival is implied.
- Preserve draft, scope, selected evidence, filters and position when returning. Recover an unknown write by checking
  the original operation; do not blindly retry. Use one meaningful consequence review, with Undo only for a supported reversal.

## Scope and complexity budget

| Layer | Keep or add | Value and boundary |
| --- | --- | --- |
| Core research | Conversation, Issues with Records/Findings/Brief, evidence readers/comparison, Updates and Following | Completes the recurring output job; no separate Research or Reports destination |
| Supporting discovery | Search and bill/person/committee/meeting directories under Explore | Direct access and scalable browsing without forcing every task through chat |
| Conditional organization work | Durable ownership, workspace isolation, membership/offboarding, issue assignment and report review | Necessary for association/boutique team sales; never substitute shared personal credentials |
| Conditional output/distribution | Reviewed exports, branding, named-recipient sharing and additional organization delivery channels | Add only for a qualified reporting requirement, with rights, authorization and delivery acceptance; no publishing platform by default |
| Secondary setup | Account/privacy, optional Address, notification preferences, external MCP and webhooks under Settings | Keep supported paths, not mandatory professional onboarding or new primary navigation |
| Separate expansion | Complete regulatory/current-law research, enterprise controls and commercial data distribution | Governed by their own contracts, readiness and economics; not unlocked by an attractive mockup |

Show complexity at the point of need: scope at search/issue controls, source limitations beside affected evidence,
review consequences before output changes, and delivery diagnostics in selected detail. Avoid generic explanatory rails,
routine Checked/Updated/As-of decoration and duplicate Open controls. Keep real publication/event/service dates, reporting
intervals, source uncertainty, permission boundaries and destructive consequences. Simplification must not hide them.

For proposed complexity, name the target ICP, recurring job, simpler alternative, expected benefit, owner and acceptance
check. Add it only when needed to complete that job or protect correctness/privacy, not to match a competitor checklist.
Do not silently cancel already approved API/data work; this hierarchy governs product emphasis and additional scope.

## Personal and organization delivery

The first complete acceptance target is a personal researcher performing the core loop in verified source scope.
The [organization specification](organization-features.md) owns the shared extension: organization as owner, workspace
as client/initiative access boundary, issue as investigation. It is not a separate research product or a generic CRM.

Shared conversations, isolated client work, assignments, approval and recipient grants need actual authorization and
lifecycle acceptance before organization sales. Personal research stays private when someone joins an organization.
Adding selected findings must not expose the original conversation or another client's notes. Reusing a source does not
reuse its audience or approval. Organization switching cannot move unsaved work or grant access.

[Pricing](pricing.md) owns plans, seat policy, billing and commercial rights. Paid plans and collaboration are proposed
delivery, not activated by this specification. Personal copy/review remains useful without DOCX/PDF export, branded
sharing, Teams/Slack routing or an API resale contract. A customer requiring those capabilities must wait for their
delivery rather than receive a misleading replacement promise.

## Acceptance and success measures

### Customer workflow acceptance

| Scenario | Required evidence |
| --- | --- |
| Association member update | Scoped issue, irrelevant match excluded, changed provision inspected against exact versions, findings reviewed and copied with source links; reopen for the next update without rebuilding the investigation |
| Consultant client question | Correct jurisdiction/session resolved, actor/vote context verified when relevant, concise cited answer produced; save only selected work to an issue, without a mandatory setup/migration project |
| Monitoring and recovery | Trace an update to its source and matching rule; edit/pause/stop deliberately; distinguish suppression/failure/unknown and reconcile an unknown write without duplication |
| Evidence navigation at scale | Filter/paginate real-sized collections, inspect a deep passage or meeting/vote from contextual and direct entry, then return without losing selection, draft or position |
| Shared team work, when offered | Authorized colleague reviews an identified output revision; changed content invalidates approval; sharing and offboarding cannot expose personal or another workspace's research |

These scenarios must pass in the integrated browser on desktop and mobile, including keyboard/focus/accessibility,
empty/partial/unavailable evidence and interrupted operations. A canvas transition note is not a browser test.
Use a prospect's public issue and supported jurisdictions; record data limitations rather than infer nationwide acceptance.

The [ICP validation plan](icp.md#7-validation-and-decision-rules) measures preparation plus reviewer effort, repeat use,
paid conversion, support cost and renewal. Its suggested 30% time-saving target is a pilot hypothesis, not a release
performance claim. No critical citation/version error is acceptable in the reviewed pilot output.

### Retained retrieval targets

These are evaluation requirements, not claims of achieved production performance or whole-corpus completeness.

| Scenario | Target |
| --- | --- |
| Known bill | Correct canonical record within two seconds at the service boundary; title, recorded status, available sponsors and an official link |
| Topical discovery | A relevant bill in the first ten results for at least 90% of documented test prompts; no result outside requested filters; explicit pagination/limits |
| Timeline | All stored events in stable chronological/upstream order with deterministic ties and available source links |
| Passage search | Exact phrases found lexically; semantic evaluation recall at ten at least 80%; bill, version, section and source URL on every match |
| Version comparison | Unambiguous input versions; added/removed/unchanged passages distinguished; truncation disclosed |

Release requires clean repository verification, accurate [data documentation](../../../legislation-ingestion/docs/engineering/data-sync-catalog.md),
validated external services and current [API/passage acceptance](../operations/passage-search-delivery.md), plus the
relevant customer workflows above. State activation/freshness follows per-jurisdiction
[Open States acceptance](../../../legislation-ingestion/docs/operations/openstates-rollout-checklist.md); ingestion fixtures alone are insufficient.

## Application and API boundary

The web app, [HTTP API](../engineering/api/README.md) and external MCP use one authorized application-service layer for
canonical records, search, source-grounded answers, diffs and supported subscriptions. The broad data model includes
people, organizations/commissions, meetings, materials and OCR sections without turning every object into primary navigation.
In-app/email use the [notification contract](notification-experience.md); webhooks remain a supported integration path.
Client authorization, data rights, service commitments and commercial entitlements require their owning acceptance.

Core representative research includes historical/current service, source profiles, sponsorship, amendments, vote
positions and committee/event activity. Address lookup and extracted mentions remain separately governed by the
[identity roadmap](../engineering/identity-and-representative-roadmap.md). Manual discovery requires no address;
raw address input is not an MCP contract and is not retained by default.

## Explicit exclusions

- No general web research, arbitrary external MCP servers in the web assistant, public conversation sharing or
  autonomous policy/legal conclusions. External clients accessing Rostra's MCP remain included.
- No CRM/PAC, mass advocacy, exclusive newsroom or outsourced analyst service, public member portal, legal citator,
  compliance obligations register or automated legal deadline determination in the core research product.
- Committee recordings/transcripts, media processing and calendar actions remain deferred until explicitly approved
  for a required research scenario. Existing meeting notices, agendas and supported materials remain in scope.
- Regulatory/current-law and downstream data offers need separate scope, source rights and release acceptance;
  proposed-law evidence is not a complete legal research product.
- Temporal, LangChain, LangGraph, Redis, OpenSearch, dedicated vector stores and graph databases remain deferred until
  measured PostgreSQL/orchestration limits justify them.

Reconsider an exclusion only through an explicit product/architecture decision naming the ICP need, evidence, cost,
owner and effect on the release contract. A broader competitor's feature list is not that decision.
