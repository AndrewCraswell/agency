# Text comparison prototypes

`DiffViewer` and `ComparisonCard` are app-owned Storybook prototypes. They are not registered in the conversation
catalog, renderer or routes. Existing entity cards are unchanged.

## Rendering contract

Import components from `DiffViewer/DiffViewer` and `ComparisonCard/ComparisonCard`. Both accept:

- `state`: `ready` with a trusted `comparison: DocumentComparison`, or `loading`, `error` or `unavailable` with `left`
  and `right` document references containing `id` and `contentHash`.
- `leftDisplayLabel` and `rightDisplayLabel`: optional version/source display text. Labels never replace document IDs or
  content hashes.
- `leftValidatedSourceUrl` and `rightValidatedSourceUrl`: optional source URLs already validated and bound to those
  documents by the host. The existing source URL schema also rejects unsafe protocols and credential-bearing links
  before rendering. It does not establish a URL's provenance.
- `onRetry`: optional host action, displayed only in the error state.

`DiffViewer` uses `react-diff-view` for unified/split rendering, aligned empty cells, line numbers and inline
highlights. It consumes the package's standard `unifiedDiff` output; there is no custom row alignment implementation.
Pass a full package comparison, not a paginated API response. `defaultViewMode` is `unified` or `split`; narrow screens
use unified mode. `defaultShowUnchanged` enables full context, otherwise the patch's three context lines are shown. The
library's context utilities expand the original stored text. Line numbers refer to stored text, not publisher PDF line
labels. Preferences reset when the input identity changes. `ComparisonCard` accepts `defaultOpen` (false by default) and
opens the same viewer inline.

Production components only render trusted results. They do not run the comparison engine, accept model-authored markup,
apply amendment instructions or infer legal effect. The viewer reports inserted/deleted line counts from the unified
patch, not legal changes. The renderer escapes source text and wraps long lines.

## Storybook examples

`stories/fixtures/databaseDocuments.json` contains read-only snapshots of public full texts and metadata from the app's
database. It includes California AB 2652 (April 8 and April 18, 2024) and H.R. 2513 (introduced, reported, and referred
versions). `stories/comparisonExamples.ts` computes actual package results locally, without live database access. Source
hashes, text hashes, version labels and publisher URLs are retained. Extracted PDF layout/strikeout artifacts are not
silently repaired. No fixture supplies hand-authored hunks.

- `comparisons-diffviewer--state-wording-changes` and `--side-by-side`: compare the two stored California versions.
- `comparisons-diffviewer--ownership-whistleblower-chapter-53`: the real LEG-80 documents, using paragraph granularity.
- `comparisons-diffviewer--federal-bill-revision`: introduced versus reported H.R. 2513 text.
- `comparisons-diffviewer--unchanged`: the same stored document compared against itself to demonstrate the unchanged
  state.
- `comparisons-diffviewer--loading`, `--error` and `--unavailable`: non-success states without invented counts.
- `comparisons-comparisoncard--expanded` and `--open-and-collapse`: inspect the card and use Enter or Space to
  open/close its viewer without losing trigger focus.

Both components have colocated behavior tests using real engine results. Run them with
`pnpm --filter legislation-web exec vitest run src/modules/comparisons`. Start the workshop with
`pnpm --filter legislation-web storybook` and open the Comparisons group. Small synthetic inputs are confined to unit
tests and simulated loading/error states, not the legislation examples.
