# Conversations and product integration

## 1. Purpose and decisions

September 15, 2026. Design the conversation as a way to **ask, inspect and act on legislative research**, not a second
application containing copies of Issues, Following and every record page. The primary users are association policy
researchers and solo/boutique public-affairs researchers preparing recurring member/client updates.

**Simpler is more useful:** one conversation surface, one explicit reference model, existing evidence views, and writes
through the owning feature. A question must not require an issue, an upload, an organization or integration setup.
Direct controls remain usable without chat. The user never needs to narrate a task the interface already performs well.

This document owns conversation entry, turns, rendered content, references/citations and write-back interaction. Read
with the [product specification](../product/product-spec.md), [IA](../product/information-architecture.md),
[shared design brief](design.md), [organization behavior](../product/organization-features.md) and
[research API](../engineering/api/search-and-diffs.md). It specifies intended behavior, not implemented routes, a deployed
assistant or approval of every visible canvas control. Existing source, privacy, commercial and authorization gates apply.

| Decision | Keep simple by |
| --- | --- |
| Conversation access | Reusing the canonical conversation page and responsive evidence layout, not adding a floating assistant or chat on every record |
| Context | Showing selected references and scope before Send; navigation alone never supplies page content |
| Replies | Using a small set of typed content blocks and shared record components, not arbitrary model-generated interfaces |
| Reasoning visibility | Showing truthful work progress and inspectable evidence, never private chain-of-thought or invented reasoning narration |
| Saving work | Separating persisted conversation history from explicit writes to Issues, Findings, Brief and Following |
| Repeat work | Reopening an existing conversation or issue without inventing conversation folders, agent modes or branching trees |

Navigate: [entry](#3-entry-from-anywhere), [turns](#4-turns-and-composer), [content](#5-rendered-content),
[references](#6-references-and-tagging), [citations](#7-citations-and-source-inspection),
[progress](#8-progress-not-private-chain-of-thought), [write-back](#9-writing-back-to-the-product),
[acceptance](#12-design-deliverables-and-acceptance).

## 2. Primary use cases

| Job | Entry and input | Useful answer | Where durable work belongs |
| --- | --- | --- | --- |
| Answer a client/member question | New conversation or Search; explicit jurisdiction/session | Concise cited explanation and relevant records | Conversation alone unless the user saves selected findings |
| Explain a changed provision | Ask on a bill, amendment or selected passage; identified version/pair | What changed, exact passages and material qualifiers | Selected findings in an issue; not a silently updated brief |
| Compare jurisdictions | Ask with selected records/passages and explicit scope | Small source-backed comparison distinguishing textual differences from legal conclusions | Issue findings/comparison; cross-bill synthesis is not the same-bill diff API |
| Understand an actor or event | Ask on a person, committee, vote, meeting or agenda item | Identity, motion/action, recorded position and source context | Canonical evidence remains the record; save only relevant findings |
| Maintain an issue | Resume research from issue or ask about selected new matches | Suggested relevance judgments and supported findings | Explicit include/exclude or finding writes under that issue |
| Prepare a recurring update | Ask with selected findings and reporting interval | Proposed selection or wording with citations | The issue's Brief preparation/review flow, not a second report editor in chat |
| Configure monitoring | Ask to follow a record/query, or use its direct Follow control | One exact follow proposal with supported events, channels and cadence | Following after confirmation; an issue reference alone creates no follow |
| Understand an update or delivery problem | Ask from an update/selected delivery with permitted context | Explain the legislative change or confirmed delivery state and link to recovery | Existing evidence/Following/settings view; no autonomous resend or global settings change |

One shared experience serves these jobs. No lawyer/citizen/association mode selector. General web research, autonomous
legal/compliance judgments, newsroom production, mass outreach and an all-purpose support chatbot are not added here.

## 3. Entry from anywhere

### One conversation surface

Use `/conversations/{conversationId}` for persisted work and the existing home composer for a new unsent conversation.
On desktop, contextually opened evidence sits beside the conversation when space permits. On narrow screens use the
same conversation full-width, with one-step return to the source. Do not create an independent floating chat history,
per-record chat, nested assistant drawer or a second composer beside the main one.

Add one conversation icon to the authenticated application header when conversation is not already visible. Accessible
name and tooltip: **Open conversation**. It resumes the conversation explicitly active in this browser tab and ownership
context, or opens an empty composer if none exists. It never reads the current page into context. Existing New conversation
always starts a separate empty draft; Conversations remains the full history list. Mobile exposes the same command in the
existing header/navigation, not a floating control competing with record actions.

| Entry/action | Conversation destination | What changes before Send |
| --- | --- | --- |
| Open conversation | Active conversation in this tab and authorized personal/workspace context, otherwise an empty draft | Nothing added; draft and reference selection restored |
| New conversation | Empty draft in the explicit current ownership context | No copied references, issue binding or prior messages; scope remains editable |
| Open from Conversations/recent history | The chosen conversation after authorization | Restores its draft and context, not the record currently underneath it |
| Ask on a record, passage or comparison | Active conversation in the same ownership context, otherwise an empty draft | Adds the selected reference to the composer; focuses it; does not send a prewritten question |
| Add to context | Same target rules as Ask | Adds only the selected reference; no generated answer or product write |
| Resume research from an issue | Resume the active conversation if already associated with this issue; otherwise choose an authorized related conversation or New conversation | Stage the issue scope/reference explicitly; do not load a colleague's personal chat |
| Ask from Updates/Following | Same target rules as record Ask | Adds the exact change or permitted rule/delivery context, not the entire inbox or private payload |
| Global command from Settings | Same as Open conversation | No automatic address, billing, credential or account data attachment |

The draft header shows the destination conversation title and Personal or workspace audience. The same compact
destination picker offers New conversation and authorized recent conversations when the user wants another target.
Do not ask for a destination on every ordinary addition; never infer it from a record URL or auto-resume an unrelated
conversation from another tab, account or workspace. If there is an unsaved draft, preserve it with its original owner.

**Ask**, **Add to context** and **Resume research** share this mechanism, not three implementations. Use Ask on record
headers, Add to context for selected passages/results, and Resume research on the issue. Do not put all three controls
beside the same object. Stage a reference once for the same identity/version/range; distinct versions remain distinct.

Opening chat from a list, record, issue or setting records a return location with its filters, page, selected evidence,
scroll and focus. Return/Back reverses navigation, not work already submitted. No duplicate page/drawer history when
expanding the same record. The header command is unavailable outside an authorized application session; sign-in preserves
the intended destination but never replays a question or mutation automatically.

## 4. Turns and composer

### Linear, durable turns

A turn is one submitted user message with its scope/reference snapshot and one assistant response that can contain several
typed blocks. Retrieval events and action status attach to that turn; each tool call does not become another message.
System notices appear only for a meaningful context change, interruption or permission event, not routine narration.

| State | Presentation and behavior |
| --- | --- |
| Draft | Editable multiline question, scope, selected references and Send; references alone do not send or create an empty saved thread |
| Sending | Preserve local input until server acknowledgment; use a stable submission identity so reconnection cannot duplicate the message |
| Working | One assistant response with truthful activity status and Stop; stream grounded text/blocks as available, not broken controls or unbound citations |
| Complete | Final ordered content, citations and applicable next actions; response may still disclose partial evidence/coverage |
| Stopped | Keep received output marked incomplete; stop supported read/generation work and reject late overwrite; do not imply an already submitted write was cancelled |
| Failed or disconnected | Keep question, references and partial response; check the existing run before offering a new attempt |
| Needs clarification | Ask the smallest necessary question or show a record/scope selector; wait rather than guess the bill, period, audience or destination |

One generation runs per conversation at a time. The next question can be drafted but is not silently queued or sent;
Send resumes when the run settles. Other conversations can run independently subject to the eventual service limits.
In a shared conversation, concurrent submissions are serialized by the server; a losing submission stays a draft rather
than silently reordering the discussion. Shared editing/version conflicts must not overwrite another member's work.

Keep the initial model simple: no editing sent messages in place, response branch trees, parallel agents or model picker.
Corrections are follow-up turns. A recovery attempt stays within the failed turn with its original input snapshot and a
visible attempt state; prior partial output remains distinguishable. A completed answer can be revisited with a new turn,
not regenerated invisibly beneath findings already saved from it.

Scope and references are editable for subsequent questions. Submitted turns preserve their own input snapshot, source
versions and citations. The draft carries the current explicit reference set between turns until removed or replaced;
opening new evidence and viewing result cards do not grow it. Scope edits never rewrite an earlier answer.

Do not mark a conversation saved until acknowledged. Conversation persistence is separate from saving a finding/follow.
Use automatic titles from the first question, rename and deletion in existing history controls; meaningful activity dates
belong there, not a timestamp on every streamed block. No automatic public sharing or notification to workspace members.

Deletion uses one consequence review identifying the conversation and any in-progress work. It never deletes separate
issues, findings or follows, or claims to undo an already submitted action. Failed deletion retains the conversation;
unknown deletion checks the original operation. Stop ongoing reads when supported, prevent late resurrection, and keep
required mutation recovery available through the owning feature. Retention/reauthentication policy still needs approval.

### Composer and accessibility

Use the existing multiline composer with Send/Stop, scope controls and a single reference-picker entry. Enter sends and
Shift+Enter adds a line when not composing with an input method; the visible Send control always works on mobile.
Reference selection never submits. Keep unsent text when choosing references, destinations or evidence.

Keep the text input focused and editable after submission and while generating; prevent another submission without
disabling the whole composer. Put the input first in its control group, with Send/Stop and reference actions following.
Use standard message/list semantics and names for efficient screen-reader navigation; avoid inserting extra controls
between the message list and input. Picker arrow keys select a candidate, Enter adds it, and Escape returns to the draft.

Reference chips show type, identifying label and version/period where relevant. Each has an accessible remove action;
long labels truncate visually but retain an accessible full name. A collapsed list can use an actual reference count,
with every selected item available to inspect/remove. Do not show tokens, arbitrary quotas or a graph of context nodes.

Announce meaningful state changes with a polite live region, not every token. Do not force-scroll someone reading earlier
messages; provide the existing Jump to latest action. Keyboard selection, Escape, focus restoration, zoom and the mobile
keyboard must work without obscuring the composer or turning every citation into an oversized card.

## 5. Rendered content

Text first; structured content only when it makes the task easier to inspect or act on. Reuse the same identity, source
and status components as the owning feature. Avoid a prose summary, identical card and identical table for the same result.

| Content type | Render in the turn | Open the full feature for |
| --- | --- | --- |
| Cited explanation | Short paragraphs, headings/lists and inline citations; explicit qualifiers beside the affected claim | Supporting evidence and follow-up research |
| Clarification | One question, record candidates or focused scope choices | Full discovery only when the compact choice is insufficient |
| Record result/collection | Typed bill, person, committee, meeting, amendment, vote, document or material rows/cards; identity and useful excerpt | Filters, complete pageable results and full record detail |
| Passage/quotation | Exact bounded quote, source/version/section and inspect/copy controls | Surrounding text in the shared reader |
| Activity/timeline | Bounded ordered actions, actors and source links | Complete activity history and per-event details |
| Bill progress | Recorded jurisdiction/measure-specific stages, not a percentage | Underlying actions and uncertainty in bill detail |
| Comparison | Small table or changed-text excerpt with identified inputs and citations per substantive cell/row | Full same-bill diff or issue comparison; no inaccessible wide table on mobile |
| Issue/finding reference | Compact name/scope or selected finding with source and review status | Issue overview, Records or Findings; no full issue dashboard inside a reply |
| Brief proposal | Short proposed outline/wording and selected findings, clearly not saved or reviewed | The issue's Brief selection, generation, review and copy workflow |
| Action proposal/receipt | Exact action, target/destination, relevant consequences and confirmed/failed/unknown state | Existing confirmation/editor or owning object, using the same contract |
| Limitation/error | Specific missing, unavailable, unsupported or interrupted state beside affected content | Source access or a safe recovery action, not a generic disclaimer rail |

Use at most five records per preview, consistent with the IA; View all carries exact search/filter scope. Paging and
result-window limits remain truthful. Opening View all is read-only, not another user question or an all-results selection.
Long timelines and tables open their owning views; text remains selectable and copyable with citation mappings.

Render only supported, validated block types and safe Markdown. No arbitrary HTML, executable code, model-invented
forms or actions/URLs. Unsupported blocks retain validated readable content when available and disclose the unavailable
interaction; they cannot disappear silently or become executable buttons. Stable block IDs/order allow reconnection
without duplicate cards. A streamed action becomes interactive only after validation and permission checks.

## 6. References and tagging

**Reference** means an object the user intentionally provides as research context. **Citation** means retrieved evidence
supporting an assistant claim. **Destination** means where an explicit action will save work. Selecting one does not
automatically establish either of the others. "Tags" here are reference tokens, not taxonomy labels, people notifications
or access grants.

The reference button and typing `@` open the same searchable picker. Choosing an item adds an identified chip to the
composer; typed names or ambiguous pasted identifiers remain plain text until resolved. `@` is an optional shortcut,
not required syntax and not a person-mention notification feature. Matching internal Tabra links can offer the same
resolved reference; arbitrary URLs remain text and are not fetched as general web research.

### What can be referenced

| Type | Bind and display | What it does not include automatically |
| --- | --- | --- |
| Bill or amendment | Canonical ID, jurisdiction/session; exact text version when the request concerns text | Every related bill, document or future version |
| Person/representative | Canonical person with relevant office/service period | All historical offices, constituents, contact records or notification recipients |
| Committee/civic body | Canonical organization and relevant period | A customer workspace or all related documents |
| Vote or legislative action | Exact event ID, body/date and motion/action; linked person position when selected | An outcome inferred from one person's vote or a claim about political intent |
| Meeting/agenda item | Identified event/item, notice/date and available materials | Transcript, recording, attendance or decisions not present in the source |
| Document or supporting material | Exact document/material identity and version/source date | Whole unseen text when only a section is processed, or a new file upload |
| Section or selected passage | Exact document/version, section and validated range; quote preview | Unsupported precision from an approximate search highlight |
| Comparison | Identified pair and selected passages/hunks | A new official source or automatic cross-bill diff support |
| Search/query | Query, mode and normalized supported scope/filters | A snapshot of every matching record or permission to follow the query |
| Issue | Authorized issue and scope revision; explicit selected records/findings | Entire conversation history, all query matches, unrelated client notes or every document in the issue |
| Finding/annotation | Identified issue item/revision and its source links; label user interpretation | Official authority or automatic reviewed status in a new output |
| Brief draft | Authorized identified draft/revision and selected content | Approval, all prior revisions, publication or permission to overwrite it |
| Update | Exact underlying change and its canonical evidence links | Inbox read state as legislative evidence or other matching users' data |
| Follow/selected delivery | Authorized rule or batch/channel identity and safe configuration/status | Secrets, raw payloads, addresses or a credential-bearing destination URL |

Record, source and context types need their owning contracts. Current research-answer retrieval covers bills, amendments,
passages and supporting materials; person/body/event tools and private issue/finding references need the orchestration
and authorization layer described below. A type appearing in this design does not expand the existing endpoint enum.

Not initially referenceable: whole conversations, another account/client's private work, users as notification mentions,
credentials, raw addresses, payment/session data, arbitrary websites, uploaded PDF/DOCX/TXT, media or an unbounded
"everything in this workspace" selection. Referencing a previous answer's finding reuses its underlying sources and labels
its interpretation; a model answer is not evidence for itself. No conversation-to-conversation context graph is needed.

### Context rules

- The composer shows one explicit working scope and optional active issue. Issue scope, reporting interval and selected
  references are separate. Adding an issue or out-of-scope reference must not silently replace the current scope or the
  write destination; expose the mismatch and obtain the specific choice before a conflicting request runs.
- Resolve relative dates into a visible interval and timezone before a scoped request executes; identify the filtered
  date field. Do not apply a session constraint to a person/body endpoint that cannot support it or silently broaden a
  failed filter. The resolved scope stays with the submitted turn; a later scope edit affects only subsequent requests.
- A bare bill reference is an identity. At execution, resolve relevant record revision/text versions and record exactly
  what was used. An explicit version/passage is pinned. New source data may inform a new turn, never rewrite an old one.
- Adding an issue uses its specified scope and selected content, not an eager attachment of the entire issue corpus.
  Retrieval is bounded and may inspect relevant records; expose inaccessible, unavailable, stale or omitted inputs.
  Required evidence cannot be silently dropped to meet a context budget; ask the user to narrow the task when necessary.
- A selected reference is context, not an instruction or proof. Quoted documents, annotations and tool output cannot
  override the user's request, authorize actions, reveal system prompts or redirect data to another destination.
- Reauthorize references before retrieval, generation, display and writes. Picker search/counts cannot reveal inaccessible
  records or workspaces. Membership loss clears protected cached content and disables further use; do not turn a historical
  message snapshot into perpetual access. Storage retention/deletion remains an explicit contract gate.
- Keep the interface to one visible reference list. Per-turn details can show inputs versus actually cited evidence;
  hidden retrieval/summarization must not be described as reading every attached record or entire conversation history.

## 7. Citations and source inspection

| Concern | Design rule |
| --- | --- |
| Placement | Put citation markers immediately after the supported claim; tables cite the relevant cell/row. A generic Sources footer alone is insufficient |
| Identity | Resolve marker IDs to server-validated canonical evidence, never model-invented URLs or a bibliography fabricated from titles |
| Preview | Show source/publisher, record identity, exact version/date, available section/page and supporting snippet; do not imply a page/line/range not supported by the locator |
| Open | Reuse the reader/record/vote/meeting view; preserve conversation position and return focus to the marker |
| Multiple sources | Reuse a citation ID for the same evidence within a response; a synthesis can cite multiple sources without repeating full cards |
| Changing sources | Historical answer stays bound to the evidence used. Offer a new turn with newer evidence; never silently retarget citations or saved findings |
| Missing evidence | Distinguish missing extraction, unavailable version, access denial and absent support; keep valid content but withhold/qualify the unsupported claim |
| User commentary | Attribute annotations to the user and keep them distinct from quotations and generated interpretation; cite their underlying evidence where available |
| Copy/save | Preserve statement-to-source mappings, source/version identifiers and applicable qualifiers. Copying text does not mark it reviewed or create a public conversation link |

Use local marker numbers/IDs scoped to the response, not globally stable citation numbers. Persist their evidence mapping
with the answer and with a saved finding; deleting chat cannot leave the finding dependent on a missing message to resolve
its sources. A scope/reference chip is not a citation. Opening, adding or copying a citation is not evidence review.

Stream only validated claim/citation units or show incomplete output without a false supported state. Never display a
clickable marker that has no resolved target. The current `ResearchCitation` supports record/document/section identity,
snippet and source references; exact range locators and other evidence types require approved extensions. Cross-state
comparison must retain both source/version identities and qualifiers, not imply applicability or legal superiority.

## 8. Progress, not private chain-of-thought

Do not display, request, store as a product artifact or reconstruct private model chain-of-thought, hidden prompts or
internal deliberation. What users need is **what the system is doing, what evidence it used, and what remains uncertain**.

| Surface | Show | Do not show |
| --- | --- | --- |
| While working | One current, truthful phase such as Searching records, Reading source text or Comparing versions; Stop | Simulated percentages, speculative internal reasoning, token-by-token thoughts or fake completed steps |
| Optional activity disclosure | Short server-recorded steps: executed query/scope, successfully retrieved records/versions, completed comparison and explicit failure | Raw prompts/tool payloads, secrets, lengthy agent logs or claims that fetched metadata equals reading full text |
| Answer | Concise explanation supported by citations and meaningful limitations | Uncited policy/legal conclusions or confidence percentages derived from ranking scores |
| Explanation on request | A short evidence-based rationale describing relevant facts, comparison method and uncertainty | A claimed transcript of the model's private reasoning |

The existing step-trace component can provide this collapsed disclosure, labeled **Search steps and sources**. It is
optional task history, not required reading or proof the answer is correct. Derive events from actual execution rather
than letting the model narrate successful work. If the backend cannot emit a phase reliably, show a neutral Working
state; if counts/latency are unavailable, omit them. Keep failures that affect the answer visible beside that answer.

## 9. Writing back to the product

Conversation history stores discussion. The owning feature stores research or configuration. There is no invisible
two-way synchronization between an answer and an issue: new chat text cannot overwrite findings, scope, a reviewed brief
or a follow merely because the conversation references that object.

| Intent | In chat | Commit and destination |
| --- | --- | --- |
| Save selected record(s) | User selects results and Add to issue | Existing issue picker/create flow, exact selected IDs and authorized destination; no follow created |
| Save selected finding | Selected claim/quote, annotation and citations with Save to issue | Explicit commit to Findings, preserving sources; starts needing review, not an approved finding |
| Change issue scope or inclusion/exclusion | Proposed changes and affected query/follow consequences | Owning scope/record review flow; revision checked at confirmation |
| Prepare or revise a brief | Suggested selection/wording, with Open brief to continue | Issue Brief owns selection, replacement/generation, review and copy; do not maintain a separate chat report draft |
| Follow/edit/pause/stop | One supported action proposal with exact target, events, effective delivery settings and consequences | Existing follow confirmation/editor commits through the same authorized service as direct controls |
| Review, approve or share output | Link to the identified issue/output in its owning view | Explicit review/approval/recipient decision there; a model cannot approve its own output or infer recipients |
| Change account/access/credentials/billing | Navigate to the correct authorized settings control | No inline model-driven secret handling, role changes, purchases, destructive account action or blanket resend |

The final Save/Follow/Stop action is the confirmation. Do not add a second generic Are you sure dialog where the exact
destination and consequences are already visible. A proposed action does nothing until confirmed; normal navigation
and opening references do not need confirmation. Existing source-related direct actions remain available outside chat.

Action states are Proposed -> Saving -> Confirmed, or Failed/Unknown. Persist the operation identity, user-approved input
and authoritative receipt with the initiating turn. Only a service result may say Saved or Following. Reopen the same
operation to check an unknown outcome; no blind retry. Duplicate confirmation must not duplicate the record or rule.

Revalidate permissions, target revision, effective preferences and audience at commit. A changed preview must be reviewed
again, not silently applied. Stop generation, close chat, browser navigation and sign-in do not roll back a committed write.
Use Undo only where the owning contract supports reversal. A record changed later shows its current state when opened,
while the historical receipt remains an accurate statement of what happened then.

Direct actions performed outside chat update their owning feature and show its normal result. Do not manufacture user
messages or append every external UI event to the conversation. A chat-initiated flow completed in an owning view returns
one linked receipt to that initiating turn, even after navigation. If its conversation was deleted, the committed resource
and any required recovery receipt still survive under their owner; do not recreate the conversation.

## 10. Minimal implementation boundary

The [conversation backlog](../backlog/backlog.md#conversation-and-research) already owns persistence, context, streaming,
citations and actions. Extend that coherent work rather than adding a second chat service or using MCP as an internal
web transport. The web assistant uses the same authorized application services as direct controls and the HTTP API.

| Contract to settle | Needed for this design |
| --- | --- |
| Conversation/turn/run identity | Owner/workspace, linear ordered messages, durable acknowledgment, run/attempt recovery and deletion/retention |
| Context revision | Explicit scope/reference manifest, resolved evidence versions, draft ownership, context-budget omissions and authorization |
| Response envelope | Validated typed blocks, claim/citation bindings, safe links/actions and replay-safe streaming order |
| Activity events | Real service phases and sanitized executed-step summaries; no private reasoning payload |
| Action proposal/receipt | Exact approved inputs/destination, revision checks, idempotent commit and reconcile endpoint; same owning mutation contract |
| Entry/return state | Tab-local selected conversation per ownership context, unsent drafts, issue associations and source return/focus |

The existing research-answer endpoint is not a conversation history API, multi-turn orchestrator or mutation executor.
Person/body/meeting/vote context may need dedicated authorized retrieval tools; issue, finding and draft revisions require
their application contracts. Do not serialize unsupported types into an existing `recordTypes` enum or pretend a
same-bill document diff supports arbitrary jurisdiction comparisons. Feature controls wait for actual service support.

## 11. Canvas alignment and simplification

Read-only inspection on September 15 found these reusable anchors in [legislation.pen](../../legislation.pen). This
document is a handoff for the following changes, not a claim that the canvas has been edited or interactions tested.

| Existing anchor | Use or reconcile |
| --- | --- |
| `fSLz1`, app header | Add the single Open conversation entry for non-chat surfaces; preserve search, bell and account responsibilities |
| `beDKK`, thread header | Keep title and explicit scope; remove public Share and ambiguous whole-conversation Follow from the initial model; follow the identified record/query via an exact proposal |
| `epfSj`, attach menu | Reuse as the reference picker; remove unsupported upload choices, file-in-issue claims and invented file quotas; @ uses this same picker |
| `h4Q7t`, step trace | Keep optional executed search/source history, collapsed by default; no hidden-thought narration or fabricated counts |
| `cbBs4`, citation preview; `uTxNa`, version pin | Preserve exact evidence and newer-version distinction; refreshing evidence is a new explicit turn |
| `K1aUN`, system notice | Keep meaningful scope changes; Undo only where a real reversal exists; no routine notices after every click |
| Shared typed conversation cards and record views | Reuse identities/actions; do not add duplicate record pages or a second report editor |

Do not build uploads, voice, model/agent modes, branching, public chat sharing, per-record threads, a global reference
library, auto-distribution or universal settings actions to finish this workflow. A supported later extension needs the
product's ICP/value gate and its source/privacy/service contract, not just an extra menu item.

## 12. Design deliverables and acceptance

Produce connected examples using existing components, not one new page per state. Use a single coherent source fixture
set; do not mix fictional votes/versions with real evidence or treat preview dates as current release evidence.

| Connected example | What must be demonstrated |
| --- | --- |
| Ask from a bill and return | Existing draft/title/audience visible; one reference added; no auto-send or issue write; source page state restored |
| Start elsewhere or switch conversations | Global entry adds no page context; New conversation stays empty; destination picker preserves each draft; cross-workspace references never leak |
| Tag and narrow context | Button and @ share a picker; identities disambiguated; duplicate versus distinct versions handled; out-of-scope/unavailable/budget cases require a visible decision |
| Question -> progress -> answer -> citation | One durable turn, truthful optional activity, bounded typed results and validated inline citations; read exact source and return with focus |
| Stop, disconnect and recover | Partial output distinguishable; no duplicate send/blocks or stale overwrite; unknown write reconciled independently of generation |
| Delete a conversation | One consequence review; separately saved findings/follows survive with resolvable sources; failure/unknown and a late run cannot silently erase or recreate the conversation |
| Answer -> finding -> brief | Save only selected supported content to the named issue; review is not automatic; Brief remains the sole preparation/review/copy surface |
| Follow from chat | One exact proposal, correct effective preferences, confirmed receipt and shared owning state; repeated click/reconnect does not duplicate it |
| New source version or access revoked | Historical evidence does not silently change; later turn uses explicit new inputs; revoked/private content is not leaked from picker/cache/history |
| Shared work when offered | Correct audience, concurrent-turn/draft conflict handling and independent review; private research is not shared by merely changing the selector |

For each distinct interaction, show desktop and narrow/mobile layout, keyboard and screen-reader names, long content,
empty/partial/unavailable states and source return. Final implementation acceptance must run in the integrated browser;
static canvas screenshots do not establish it. Measure time to a checkable answer and saved briefing input, including
reviewer effort, rather than number of chat features. If a user must manage two histories, two drafts of the same report
or repeated destination dialogs for an ordinary task, simplify the design before adding more controls.

Content review used Microsoft Content Style Guide guidance for concise sentence-case commands and consistent verbs,
and [Fluent AI accessibility guidance](https://ai.fluentui.dev/?path=/docs/get-started-accessibility) for composer focus,
message semantics and efficient keyboard navigation. This informs the design; it is not automatic copy approval,
browser acceptance or a requirement to replace Tabra's component system.