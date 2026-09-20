# Relationship analytics

## Goal

Answer relationship listings, comparisons, and rankings through bounded database queries, not model-side pagination
and counting. PostgreSQL remains authoritative. GraphQL and a second graph store are not required.

## Inventory and boundaries

The canonical schema contains jurisdictions and sessions; people, aliases, external identifiers, service terms, and
organization memberships; organizations and their hierarchy; bills, sponsors, actions, committee links, and related
bills; structured amendments, amendment actions, and amendment relations; votes and individual positions; meetings,
participants, agendas, calendars, and explicit outcome links; bill documents and supporting publications; legal codes,
editions, provisions, and regulatory publications.

Search vectors, embeddings, and passage copies are derived indexes, not additional records to count. Ingestion history
and checkpoints describe collection, not legislative activity. Subscriptions, webhook credentials, account records, and
operational internals are outside public research.

Legal publication metadata and text retain their existing authorization and publication gates. Analytics must not
create an alternate route around those gates. The public catalog exposes only explicitly registered civic datasets;
inspect the current catalog rather than relying on historical row counts.

## Tools

- `describe_analytics` discovers public datasets, fields, supported relationship paths, and counting semantics.
- `analyze_legislation` selects relationship rows or aggregates them, filters facts, groups, calculates distinct counts
  and conditional rates, filters aggregate results, and orders a bounded result window.

Inputs are strict typed JSON. A registry owns every table, column, and permitted relationship. The compiler accepts no
SQL, arbitrary identifiers, expressions, or functions. Values are bound parameters. Joins are bounded in depth and
number; result size, offset, input size, and statement execution time are capped. All execution is read-only.

Counts are distinct at the selected identity grain, including composite relationship identities. Multiple one-to-many
joins must never inflate a count. Rates expose their numerator and denominator; zero denominators produce null.
Ranking covers the full filtered database population before applying the output limit. Stable secondary ordering makes
tied results deterministic; the result states when a limit can cut a tie. List windows are not a complete census.

## Meaning and evidence

Primary sponsorship and cosponsorship are separate. Explicit abstentions, absences, present, and not-voting remain
separate. Amendment records and amendment-format documents are not interchangeable. A collection timestamp is not an
effective or legislative event date. Unknown person links remain unknown, never a fabricated person or a zero.

Session and jurisdiction are explicit filters. The model resolves ambiguous identity and current-session scope using
the existing discovery tools. Unknown active status must not be inferred from a session label. Exact person or
organization name filters require resolution to a canonical ID; literal substring discovery remains available but does
not establish identity.

Every result retains the normalized query, dataset grain, returned window, execution time, and a coverage disclaimer.
Rows expose canonical identifiers and source URLs when selected. Aggregate claims describe the stored population, not
universal coverage. Exact counts are not evidence that upstream collection is complete. A query receipt supports
reproduction and drilling into contributing records; it is not an invented publisher citation.

## Telemetry

Telemetry covers compilation, execution, and serialization with the normalized query hash, dataset, paths, joins,
window, elapsed time, row count, and bytes. Langfuse observations inherit the active chat trace; Sentry spans inherit
the HTTP trace and retain request correlation. Failures include stage, category, and PostgreSQL code without raw SQL or
database messages. Inputs use the shared credential sanitizer; full result rows are not copied into diagnostics.

## Evaluation

Freeze 100 natural-language questions spanning the public catalog and supported operations before an evaluation run.
Each case has independently authored SQL and counting-grain expectations. The model receives the question and production
tool schemas/catalog, never the reference SQL, metric expectations, or answer. Execute its actual tool calls and retain
plans, outputs, answers, token usage, latency, and errors.

Compare identities, counts, filters, ranking, and rates against the oracle on the same database snapshot where possible;
record source drift explicitly otherwise. Do not accept an empty result as meaningful coverage of a positive case.
Unsupported scope must be reported, not guessed.

Use the configured production model and reasoning policy unless the evaluation explicitly tests a proposed change.
Compiler and integration tests cover injection, invalid paths, fan-out, nulls, ties, denominator semantics, limits, and
read-only enforcement. Exercise the chat workflow in the integrated browser and run focused checks followed by the
required repository verification.

From W, run:

```powershell
pnpm tool agent/evaluate-analytics --references
pnpm tool agent/evaluate-analytics
pnpm tool agent/evaluate-analytics --case analytics-023
pnpm tool agent/evaluate-analytics --replay <run-directory>
```

Use `--output <directory>` to select an ignored artifact directory. A full run writes a manifest, case records, and a
summary. Question, source, and tool-schema hashes; exact plans; responses; snapshot IDs; and failures are retained.
Reference SQL has a 60-second offline deadline; production analytics uses its configured database deadline. Each case
uses one repeatable-read, read-only snapshot for reference and tool queries.

Alias-only differences remain distinct from strict passes. Equal values with the wrong identity grain fail. Fabricated
citation anchors fail because the tool-only harness issues no citation snapshots. Empty and all-zero cases require plan
review rather than a positive coverage claim. Date-only values stay date-only. Ranking questions retain zero
relationship counts unless explicitly restricted.

Replay reexecutes exact retained plans against the current snapshot; it is not new model inference or a first-pass
accuracy measurement. A retained answer that differs because current tool and reference queries agree on changed source
data is source drift, not a pass for the original answer.

## Promotion gate

Do not claim full acceptance until one fresh frozen 100-question run passes every strict identity, scope, grain, metric,
row, and citation check. Focused reruns prove only their selected cases and do not retroactively convert an earlier run
into a full pass. Do not resample failures until a passing set appears.

Before promotion:

- review empty and all-zero cases against exact positive predicates and source coverage;
- verify that population-versus-measure decisions are applied consistently across every metric branch;
- preserve zero-child parents where the parent is the grouping entity;
- require valid helper aggregates and reject unused, duplicate, or ambiguous metric aliases;
- measure cold-cache query behavior against the production deadline;
- verify Langfuse and Sentry correlation without exposing query rows or credentials;
- run real PostgreSQL fixture tests; and
- complete desktop, mobile, keyboard, and accessible-name acceptance in the integrated browser.

Store run-specific reports with the evaluation artifacts, not as links or status journals in this contract. Linear owns
remaining work and promotion status.
