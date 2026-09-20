# Entity card facts

Conversation result pages, selected record cards and retained profile details share
[`entityCardSchema`](../../src/modules/conversations/entityResults.ts). Each entry in `fields` has a required,
typed `id`, a display `label`, a string `value` and optional explanatory `detail`.

Projectors and renderers select facts by `id`, never by English labels or the presence of explanatory text.
The projector owns default labels through `entityFactLabels`; labels and details remain presentation copy.
Kind-specific card layouts, date formatting, source navigation and existing suppression of secondary details
are unchanged. This is not a configurable card/layout engine.

## Membership counts

`organizationSummary.membershipCompleteness` describes the displayed member count:

- `complete`: a recorded count with explicitly complete membership relations, or an independent published
  `memberCount`. Zero is a known count and renders as `0 members`.
- `partial`: a positive recorded count without explicitly complete relations. Compact cards say
  `recorded members` even if the field's label or explanation changes or is absent.
- `unknown`: no usable count. A zero recorded count without complete relations does not establish an empty
  organization; the member field is omitted. Compact cards retain the independent active/inactive status, if known.

An independent published total does not establish that the membership relationship preview is exhaustive.
Full cards retain the projector's explanatory text. See [membership API projection](committee-membership-history.md)
for relationship history and coverage.

Checked-in story snapshots use the current fact contract. New results and retained-source reprojection use the same
projector; there is no label-based compatibility reader or migration of disposable prototype sessions.
