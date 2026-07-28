# Shopify Blog Writer product plan

## Product goal

Build a Shopify editorial workspace that turns a merchant's catalog, existing content, subscribed publications, and
commercial priorities into scheduled, reviewable articles. Merchants remain in control of source selection, editing,
links, and publication.

The product should expose an editorial workflow rather than resemble a generic AI chat interface.

## Product principles

1. Make the path from planning through publication visible.
2. Keep merchants in control of evidence, links, and publishing decisions.
3. Treat generated content as a draft until a merchant reviews it.
4. Preserve accepted relationships when article prose is edited or regenerated.
5. Share public source ingestion without sharing tenant-owned Shopify data.
6. Run synchronization and generation as durable, observable jobs.
7. Present recommendations with reasons, not unexplained scores.
8. Target WCAG 2.2 AA across desktop and narrow embedded-admin layouts.

## Information architecture

The primary navigation is:

```text
Home | Plan | Keywords | Articles | Settings
```

Onboarding is a resumable first-run flow, not a permanent navigation destination.

### Route map

```text
/app
/app/onboarding

/app/plan
/app/plan/new
/app/plan/:planItemId

/app/keywords
/app/keywords/competitors
/app/keywords/coverage
/app/keywords/:keywordId

/app/articles
/app/articles/:articleId

/app/settings
/app/settings/sources/:sourceId
```

### Home

Home is an operational dashboard. It prioritizes work requiring attention:

- onboarding and synchronization progress;
- upcoming scheduled articles;
- drafts ready for review;
- proposed links awaiting a decision;
- published articles affected by changed dependencies;
- failed jobs with a clear retry or recovery action.

Home must not duplicate the full planner or article editor.

### Plan

Plan combines ideas, briefs, and scheduling. It has two views over the same records:

- **Calendar** shows scheduled generation and target publication dates.
- **Backlog** shows approved but unscheduled work and generated ideas awaiting a decision.

Search opportunities live under Keywords, not here. Plan is where a merchant commits to work; Keywords is where the
evidence behind that commitment is examined. Ideas arrive here already carrying the cluster they came from, because
generation draws on opportunities without waiting to be told to.

A plan item can start from:

- a merchant-entered title and brief;
- an AI-generated idea;
- an approved search opportunity;
- a future imported campaign;
- a proposal to update an existing article.

Merchants can:

- add a title and brief directly;
- generate ideas from a topic, audience, product group, or content goal;
- approve or dismiss generated ideas;
- edit an approved title and brief;
- drag approved items between dates and the backlog;
- set separate generation and target publication dates;
- choose the destination Shopify blog;
- generate a draft immediately or let a scheduled job generate it.

Approval makes an idea schedulable. It does not generate or publish content automatically.

```text
proposed -> approved -> scheduled -> generating -> draft_ready
        \-> dismissed
```

Calendar movement updates scheduling only. It never silently regenerates or publishes an article.

### Keywords

Keywords is the evidence surface. Plan answers what to write and when; Keywords answers why that work is worth doing.
The two are separate destinations because they change on different rhythms: Plan changes when a merchant commits to
something, Keywords changes when a provider import runs.

Every view in the section carries one header line naming the market and language the numbers were measured in, the
provider, and the date of the most recent import. A keyword metric means nothing outside those dimensions, so they are
stated once at the top rather than repeated per row. When the market is unresolved the section shows that state and a
link to Settings instead of showing numbers.

- **Opportunities** is the default view and the ranked list of clusters worth writing about. One row per cluster, never
  one per spelling variant. A row shows the representative term, how many terms the cluster covers, demand, difficulty,
  intent, which confirmed competitors rank for it, the store's own best position or its absence, and the recommendation:
  write a new article, refresh a named existing article, or no action. The recommendation is never one opaque number:
  it opens the components that produced it. Nothing on this view asks for approval, because idea generation already
  draws from the list on its own. A row shows instead whether it has been claimed and by which idea or article, so the
  view reads as progress against the store's own opportunity set rather than as a queue of decisions. A merchant who
  wants a particular cluster written now can start an idea from its row, and a cluster that should never be written can
  be dismissed with its reason retained.
- **Competitors** answers whether a rival is worth paying to track. The store itself is pinned as the first row so the
  comparison needs no arithmetic, and the columns are: shared terms, the domain's average position across those shared
  terms, its total ranking terms, how many of those sit in the top ten, and its estimated monthly organic traffic. Each
  header names the population it counts, because the provider returns shared-term and whole-domain figures as different
  metric sets and blending them would overstate a large but unrelated site. Last import date and attributed spend close
  the row. Discovered domains awaiting a decision appear here too, so a merchant can accept or reject a
  suggestion after onboarding has finished.
- **Coverage** puts two populations side by side: the terms the store *targets*, from `blog_ideas.target_keyword` and
  article keyword targets, and the terms the store actually *ranks for*, from the provider. Columns are the term, our
  current position, the URL that is actually ranking, demand, difficulty, intent, estimated traffic, and which article
  targets it. The value of the view is in the mismatches, so those are the filters: targeted but not ranking, ranking
  but never targeted, and ranking with a page that is not the article we aimed at. The first is unproven work, the
  second is an accidental win worth reinforcing, and the third is cannibalization. An unresolved term reads as
  unverified and never as a zero.

The keyword detail route shows one term: its twelve-month demand history and trend, difficulty, intent, cost per click,
the result-page composition and the domains holding it, related and long-tail terms, the cluster it belongs to, our own
ranking URL and position history, and the article targeting it if there is one. Every figure names its provider, market,
language, and observation date. Nothing on this route is editable. Decisions belong to Opportunities and to article
detail.

#### How clusters are formed

The unit of work is a page, not a keyword, so the unit of opportunity has to be the set of terms one page can win.
Grouping terms by how similar they read is the obvious approach and the wrong one: two terms can be near-synonyms and
still return entirely different results, and the page that wins one will not touch the other.

The grouping signal we can afford is already inside the data we buy. Ranked keywords arrive with the URL that ranks for
each term, so when one competitor URL holds forty terms, that competitor has already proven those forty terms are
winnable by a single page. We read clusters off pages that already rank rather than inferring them from language, which
costs nothing beyond the import we were running anyway. The same record names the kind of page that won, which is the
question that decides whether we should write anything at all.

That gives a cluster four properties worth scoring separately rather than collapsing into one number:

- **Reachability.** What share of the top ten is editorial rather than commercial. A term whose results are nine
  product and collection pages is not a blog job, and the honest recommendation is no action with that reason stated.
  This is also the guard against the difficulty-zero trap: an easy-looking high-demand term usually looks easy because
  a blog article was never the thing competing for it.
- **Demand.** The cluster's combined demand shown alongside its head term's demand, with neither standing in for the
  other.
- **Distance.** Our best current position across the cluster, which is what produces striking distance, competitor
  gap, and weak hold.
- **Proof.** How many of the cluster's terms one competitor URL holds. A cluster a single page won on forty terms is a
  stronger bet than one assembled from forty pages.

Long-tail terms are supporting terms inside a cluster rather than candidates for articles of their own. A cluster whose
terms are mostly long and question-shaped is usually the better target, because that is where commercial pages compete
least and where one article can honestly cover many terms instead of padding to reach a word count.

Relevance to what the store sells is the merchant's question and not the provider's. The catalogue is already
synchronized, so a cluster whose terms match product and collection names outranks an equally large cluster that
matches nothing. Cost per click is the provider's weak proxy for commercial value; a match against the merchant's own
catalogue is the strong one, and it is first-party.

#### What the opportunity list is actually made of

Real data from the Fencing Club storefront shows the three shapes worth separating, because each implies a different
action and collapsing them into one ranked list would hide that:

- **Striking distance.** The store already ranks between roughly eleven and thirty for a term with real demand. It has
  a page, and the page is close. `fencing equipment` sits at position 11 on 3,600 monthly searches; `fencing sport
  sword` sits at position 30 on 40,500. The action is to strengthen the existing page, not to write a new one.
- **Competitor gap.** A confirmed competitor holds the top ten and the store does not appear at all. The action is a
  new article, and the evidence is the named competitor and the position it holds.
- **Weak hold.** The store ranks, but far down, on a term whose difficulty does not justify the distance. The action is
  a refresh, and the reason to trust it is that the term is already within reach.

Difficulty alone must not decide the ranking. The same sample returns a difficulty of zero on terms with tens of
thousands of monthly searches, which usually means the result page is held by something a blog article cannot displace
rather than that the term is free to take. Score difficulty against the result-page composition the provider already
returns, and treat a suspiciously easy high-volume term as needing a look rather than as a certainty.

#### The opportunity catalogue

Striking distance, competitor gap, and weak hold are the first three detectors, not the whole method. Each detector is
its own rule with its own evidence, its own cost, and its own earliest possible gate, and the ranked list is what they
produce together. Keeping them as a catalogue rather than folding them into one scoring function means a detector can
be added, reweighted, or switched off without redesigning the list, and means every row can name the evidence that
produced it.

##### Signals that call for writing

| Detector | Fires when | Reads | Action | First available |
| --- | --- | --- | --- | --- |
| Uncovered catalogue | A product or collection has no article written about it or linking to it | Synchronized Shopify catalogue and articles | New article | Install |
| Striking distance | We rank 11 to 30 for a reachable cluster whose demand clears the tenant's own floor | Our position, demand, intent, editorial proof | Refresh, to close a short remaining distance | First import |
| Competitor gap | A confirmed competitor holds a top-ten position for a cluster we do not appear in at all | Competitor ranked keywords minus ours | New article | First import |
| Weak hold | We rank past 30 on a cluster whose difficulty sits below one we already hold in the top ten | Our position, difficulty, the gap between our authority and the result page's | Refresh, rebuilding substantially | First import |
| Partial cluster | We hold the top ten for a minor term in a cluster but are absent or far down on its much larger head term | Our positions across one cluster's terms | Refresh, to cover the head term | First import |
| Answerable question | An informational cluster is phrased as a question and the answering position is not ours | Question phrasing, reported intent, our position | New article answering directly | First import |
| Seasonal lead time | Demand history shows a peak well above the year's median, near enough ahead to write for, with nothing scheduled against it | Twelve months of demand history | Schedule the work now | First import |
| Rising demand | The yearly trend is strongly positive, the quarterly trend has not rolled over, and the cluster is reachable | Demand trend and reachability | New article, early | First import |
| Decay | Our position on a term fell while its demand held | Provider-reported previous rank, then our own position history | Refresh, against the last-published revision | First import, where a previous rank exists |

##### Signals that call for not writing

| Detector | Fires when | Reads | Action | First available |
| --- | --- | --- | --- | --- |
| Cannibalization | Two of our URLs both rank for one cluster, or the URL that ranks is not the one we targeted | Our ranking URLs against our article targets | Consolidate or retarget, and write nothing | First import |
| Product-page territory | The cluster's intent is transactional, the result page carries product blocks, and no tracked domain wins it with an editorial URL | Search intent, result-page features, the shape of the winning URLs | Point a collection or product page at it | First import |
| Out of reach | Difficulty sits far above anything we hold in the top ten and nothing on the result page suggests otherwise | The gap between our authority and the result page's | Nothing, and say why | First import |
| Adequately covered | We already hold the top ten for the cluster with an article that targets it | Our positions against our article targets | Nothing; protect it instead | First import |
| Impressions without clicks | We are seen at a position that should earn clicks and do not get them | Search Console impressions, clicks, position | Rewrite the title and description, and leave the body alone | Search Console |
| Unclaimed query | A query brings impressions to a page no article ever targeted | Search Console queries against article targets | Adopt the query as a target on the page already earning it | Search Console |

Every detector runs on the first import. Decay is the only one that is partial there: the provider reports a previous
rank for a term where it has checked that result page before, which on the Fencing Club sample is fifteen of twenty-five
terms, and the remainder fill in once we hold our own history. Seasonality and demand trend look like history detectors
and are not: the provider returns twelve months of demand and a trend direction with the first import. Uncovered
catalogue matters more than its simplicity suggests, because it costs no provider request and is the only detector that
produces anything at all for a store that ranks for nothing yet, which is every store on its first day.

Two rules govern the combined list. No single detector may fill it, because a merchant who only ever sees competitor
gaps will only ever write against competitors and never fix what they already have, so the list interleaves and each
detector is capped. And the second table is not a footnote to the first. Consolidation, retargeting, and no action are
real outcomes, and a blog tool willing to say them is worth considerably more than one that answers every question with
another article.

Every action in both tables resolves to one of four outcomes: a new article, a refresh of a named existing article,
scheduled work whose shape is decided when it is generated, or no article at all.

#### How each signal is computed

Thirteen rules would be thirteen pipelines if each went to the provider for itself. They do not. Every detector above
reads one derived table and two derived numbers, all built once per import.

**The observed result table.** One import returns ranked keywords for our own domain and for each accepted competitor.
Unioned on the keyword, that is one row per keyword and domain carrying position and ranking URL, so for any term we
know which tracked domains rank, where, and with which page. It is deliberately a partial view: an untracked domain
holding position one is invisible to it. It is a floor on the competition, never a complete result page, and every
conclusion drawn from it has to survive that.

**Clusters come from that table's URLs.** Group each competitor's ranked keywords by the URL that ranks. A URL holding
two or more terms is proof that one page can win them together. Merge those groups across domains wherever they share
terms; the merged group is the cluster. Its head is its highest-demand term, its demand is the sum across its terms, and
our own position on each term attaches from our rows of the same table. A cluster therefore arrives with its proof
already attached: the number of distinct competitor pages that have won it.

**Reachability is proven, not assumed.** A cluster is reachable when the provider's reported intent is informational or
commercial, or when any tracked domain holds a top-ten position with an editorial URL. Editorial proof is much the
stronger of the two, because a competitor's blog page sitting in the top ten is direct evidence that an article can rank
there at all. Where neither holds, the cluster is product-page territory and the catalogue says so rather than proposing
an article that cannot win.

**Attainability is an authority gap, not a difficulty number.** Each ranked keyword carries the average domain rank of
the pages ranking for it alongside our own domain rank, so the distance between the two says whether we are outgunned
before a word is written. On the Fencing Club sample our domain rank is 91 against result pages averaging anywhere from
133 to 580: `fencing club near me` at 133 is a fair fight and `epee` at 580 is not. This matters because reported
keyword difficulty is missing on ten of the sample's twenty-five terms, so a design that leans on difficulty alone goes
blind on nearly half its input. Keep difficulty as a secondary signal and a sanity check, and keep the store's own
highest difficulty held in the top ten, which is 17 here, as a coarse upper bound rather than as the primary bar.

**Floors are tenant-relative.** A fixed monthly-volume floor makes the product useless for a niche store and noisy for a
large one. Take the floor from a percentile of the tenant's own cluster-demand distribution, with a small absolute
minimum only to keep single-search noise out of the list.

**Result-page features modify the value, they do not identify the opportunity.** Question blocks appear on twenty-two of
the sample's twenty-five result pages, so their presence discriminates nothing and must never be a trigger on its own.
Two features do carry weight. Product blocks alongside transactional intent are direct evidence of product-page
territory. And an AI overview, present on fifteen of twenty-five, suppresses the clicks a given position earns, so a
cluster whose result pages carry one is worth less than its position and demand suggest and the estimate must say so
rather than quietly overstating the return.

Every field the detectors read arrives in one `ranked_keywords` response, all confirmed against a live request:

```text
keyword_data.keyword_info.search_volume                           demand
keyword_data.keyword_info.monthly_searches[]                      twelve months of history
keyword_data.keyword_info.search_volume_trend                     monthly, quarterly, yearly
keyword_data.keyword_properties.keyword_difficulty                absent on 10 of 25 sampled terms
keyword_data.search_intent_info.main_intent                       with foreign_intent for secondary readings
keyword_data.serp_info.serp_item_types[]                          result-page features
keyword_data.avg_backlinks_info.main_domain_rank                  average authority of the pages ranking
ranked_serp_element.serp_item.rank_absolute                       our position
ranked_serp_element.serp_item.url                                 our ranking URL, which is what forms clusters
ranked_serp_element.serp_item.rank_info.main_domain_rank          our own authority
ranked_serp_element.serp_item.rank_changes.previous_rank_absolute null on 10 of 25 sampled terms
```

Two details of that response constrain how it is presented. Secondary intent is reported separately from main intent, so
a transactional term that also reads as informational is not automatically closed to an article and the product-page
rule has to consult both. And the field groups carry their own freshness timestamps, which differ: on the sample the
demand figures were refreshed in July and the result-page data in May. Provenance therefore records freshness per group
rather than one date for the row, because showing the newest of them next to all the numbers would misrepresent most of
them.

Each detector is then a short predicate over those:

- **Striking distance.** Our best position in the cluster is 11 to 30, demand clears the floor, the cluster is
  reachable. The refresh targets whichever of our articles owns that ranking URL.
- **Weak hold.** Our best position is past 30 while the authority gap says the cluster is within reach. `epees` is the
  sample's clearest case: position 36 on 18,100 searches a month at difficulty 2. Its result pages average a domain rank
  of 504 against our 91, which is the honest counterweight: reachable on difficulty, expensive on authority, and the
  ranking has to state both rather than selling the difficulty figure alone.
- **Competitor gap.** At least one accepted competitor holds a top-ten position in the cluster and we hold nothing
  anywhere in it. Two or more competitors in the top ten raise it, because one competitor ranking can be an accident of
  their authority and two is a pattern.
- **Partial cluster.** We hold the top ten for a term in the cluster while our position on the head term is absent or
  past 30, and the head carries materially more demand. It resolves to a refresh of the page that already ranks.
- **Answerable question.** Question phrasing on an informational cluster where the answering position is not ours.
  Phrasing is the trigger and it costs nothing to compute; `what is an epee` sits at position 14 on 480 searches a month
  and is the sample's clean case. The result page's question block is confirmation at most, because nearly every result
  page has one.
- **Seasonal lead time.** Twelve monthly demand figures, a peak at least half again the year's median, and enough time
  before that peak to write and publish. One year of history shows a peak but cannot show that it repeats, so the
  proposal names the peak it actually saw, and retained snapshots are what eventually turn one observation into a
  pattern.
- **Rising demand.** A strongly positive yearly trend whose quarterly trend has not turned over, on a reachable cluster
  whose competition is not yet established. Rising and merely large are different claims and must not be conflated.
- **Decay.** Our position on a term falls by a meaningful margin while its demand holds. The provider supplies a
  previous rank for terms whose result page it has checked before, which is what lets this run on the first import:
  `equipment for fencing` has gone from 15 to 31 on 3,600 searches a month, and `fencing sport sword` from 20 to 30 on
  40,500. Two cautions. That previous rank is relative to the provider's own last check, not to our last import, so the
  interval is theirs and the wording has to reflect it. And the demand condition is what separates our page getting
  worse from the topic getting smaller.
- **Cannibalization.** Two distinct URLs of ours rank in one cluster, or the URL that ranks is not the one the targeting
  article publishes at. The two cases need different words: the first is a split, the second is a misdirect.
- **Uncovered catalogue.** A synchronized product or collection with no article dependency pointing at it and no article
  targeting its terms. It reads no provider data at all.

**A suppressed cluster is still an answer.** Product-page territory, out of reach, and adequately covered mostly work by
keeping rows out of the list, and a list that silently omits things is a list a merchant stops trusting. Keep suppressed
clusters queryable and reachable from the Keywords section, each carrying the rule that suppressed it, so that "why is
this term not here" has an answer.

#### What a refresh means

Refresh is not a vague instruction to improve something. It is a plan item with `origin: refresh` carrying the
`article_id` of the page that already ranks, so it lands on the calendar beside new-article work and moves through the
same pipeline rather than through a separate mechanism. What happens when it runs is already defined by the article
model: generation runs against the existing article and its brief, the result is saved as a `regenerated` revision, and
`current_revision_id` advances. The article's identity, its history, and the revision currently live on Shopify are
untouched until the merchant explicitly publishes the new one.

Four things already in the plan are what make a refresh safe enough to recommend. Search performance is snapshotted
before regeneration, so there is a baseline to judge the result against. Deterministic rewrite warnings report removed
targets, lost heading coverage, and changed claims, and a structured comparison reports search-intent drift. Accepted
links are reapplied afterwards, so a refresh does not silently break the internal linking a merchant approved. And the
regeneration date becomes a marker on the position chart, so the merchant can see what moved and when.

What differs between detectors is not the mechanism but the instruction the plan item carries into the brief. Striking
distance asks for a short push on a page that is nearly there. Weak hold asks for a substantial rebuild, because
position 36 on a term with difficulty 2 says the page is not really competing. Partial cluster asks for the head term
to be covered without losing the terms already won. Decay asks for what the last-published revision had and this one
does not. Impressions without clicks asks for the title and description only and must not touch the body, because the
body is not what failed. The detector supplies the scope and the reason, and both travel with the plan item as
structured fields rather than as prose a later step has to re-infer.

One rule keeps refresh distinct from writing. A cluster an article already owns produces a refresh, never a second
article, because a second article aimed at a cluster we already rank for is the cannibalization the catalogue has its
own detector to catch.

#### How the import runs

The import is a monthly job per tenant. Monthly is what the data justifies rather than a budget compromise: the
provider serves its own database rather than a live result page, and it refreshes on its own schedule, which on the
Fencing Club sample left the result-page fields two months older than the demand fields. A weekly import would mostly
re-read numbers that had not moved and pay for the privilege. Monthly is still short enough that a position slide
surfaces while it is worth acting on, because the thing being tracked is a competitor's standing rather than a price.

Cost follows from the cadence and from how much of each domain is bought, so those are the two numbers to argue about.
The provider bills a fixed charge per request plus a charge per returned row, measured here at $0.012 and $0.00012
respectively, and the domains involved are far larger than a full read would be worth: one competitor in the Contoso
Camp sample ranks for 79,420 terms, which at the per-row price is nearly ten dollars for that domain alone. The import
therefore buys a capped slice per domain rather than the whole domain. A thousand rows costs thirteen cents per domain,
so a six-domain tenant is seventy-nine cents an import and about nine dollars a year at a monthly cadence. Cost is very
nearly linear in domain count, roughly a dollar and a half per competitor per year, which is why the competitor
allowance is the thing to vary by plan.

The cap is a ceiling rather than a purchase, and small stores rarely reach it. Only returned rows are billed, so the
fencing supplier's pool of 198 terms bills about four cents against a large retailer's full thirteen. Niche tenants
therefore cost a fraction of the table above, and they are also the ones least likely to be on the largest plan.

The slice is ordered by search volume, largest first, not by position. Ordering by position was the first attempt and
it was wrong in an instructive way: every row it bought came back at position one or two, because those are the terms
the domain already wins. That is the one slice of a domain's keywords that cannot contain an opportunity.

Ordering by demand alone was not enough either. On the Contoso Camp competitors it bought the brand head and nothing
else: patagonia, garmin, hydro flask, salomon. Real demand, and not a single term an article could win. So a
competitor's request is narrowed at the provider to informational intent, to terms the competitor holds within the top
fifty, and to demand below thirty thousand searches. The same hundred rows then came back as snowboard sizing guide,
bike size chart, ski areas in colorado and aspen mountain ski resort.

Each of those clauses has to hold in any vertical, because the same request is sent for a national outdoor retailer and
for a niche club supplier, and the two sample stores differ in size by three orders of magnitude. Intent and position
qualify a term rather than measure a market, so they travel unchanged. The ceiling travels too, though not for the
reason it first appears to: it removes almost nothing from the pool, sixty-two terms of 27,401 on the largest
competitor measured, yet it is the whole reason the purchase returns phrasings instead of brands. Because rows are
bought largest demand first, the ceiling sets where sampling begins rather than what qualifies. What it asserts is that
above thirty thousand searches a store blog loses whatever its niche, which is a claim about the result page and not
about the size of the market.

A demand floor was tried and removed, and the reason is worth keeping because it is the shape of mistake this filter
invites. Excluding terms under two hundred searches looked harmless on the large competitors, and it was: taking the
hundred largest terms never reaches a two-hundred-search keyword, so the floor discarded twenty-two thousand rows that
were never going to be bought. On the fencing supplier it was the only clause that mattered, cutting the pool from 198
terms to 46 and halving what a small store could buy. A floor asserts that a quiet term is not worth writing about,
which is a claim about how big the market is, and in a niche the quiet terms are the winnable ones. A filter tuned on
one vertical's largest stores will do this repeatedly, so a clause earns its place only if it can be defended without
reference to how big the market happens to be.

Brand names still come through, because the provider reads a query for a brand as informational research. Suppressing
them is left to the derived layer, where the store's own catalogue is available to judge against and where the
judgement costs nothing to revise. Narrowing further at the provider would mean paying again to discover a filter was
too aggressive.

The store's own domain is bought unfiltered. Where we rank badly, and on terms nobody would call informational, is
precisely what the weak-hold and decay signals read, so narrowing that request would discard the evidence about
ourselves that the feature most needs.

A domain that fails does not end the run. Each domain is one provider request, so a competitor the provider has no data
for, or a request that errors, is recorded against that domain and the rest of the import proceeds. Discarding the
domains that answered because one did not would throw away evidence already paid for. The run reports itself as partial
when some domains failed and as failed only when none succeeded, and a domain that failed after the provider answered
still records what the answer cost, because that money left the account whether or not the rows survived.

The cadence itself lives in the n8n schedule rather than in the app, and the app must not re-implement it. What the
app keeps for a scheduled run is a one-hour window, wide enough to absorb a retry or a duplicated delivery and no
wider. A window sized to the cadence would be a bug rather than a safeguard: a schedule that fires on the first of the
month is 31 days apart in one place and 28 in another, so a month-long guard would silently skip February's run and
every short month after it. Guarding a cadence we do not own is how that mistake gets written.

A merchant can also refresh by hand, and that control is metered to once a week per tenant. This is a spending ceiling
rather than a claim about freshness, and it is deliberately far above the point where the provider would have new
figures, so that a merchant who has just added a competitor can have it measured without waiting for the schedule. A
request inside the window does no work and spends nothing. It reports success together with when the data was
collected, because from the merchant's side the question was answered and the data is current: that is a normal
outcome and must never be presented as an error, a failure, or a refusal.

Every keyword operation resolves its tenant from the authenticated Shopify session and from nothing else. No loader,
action, or job accepts a tenant identifier, shop domain, or store handle supplied by the caller; the identifier is
looked up from the session, every query is filtered by it, and the scheduled and internal entry points carry it on the
job row instead. The rule is worth stating plainly here because keyword evidence is the first thing this app holds that
is expensive to collect and directly useful to a rival. A store must never be able to read, or cause a charge against,
another store's evidence, and a keyword route that takes an identifier from the request is one bug away from allowing
exactly that.

#### How this is built

The section is four layers, and the third one is what decides whether any of it stays correct as detectors are added.

**The provider client** does input and output and nothing else. It authenticates, requests, parses the response against
a schema, and returns rows together with the cost the provider reported. It holds no rules of its own. Beside it sits a
normalizer, the only place that knows the provider's field names, so changing provider changes those two files and
nothing downstream.

**The raw store** is three tables written once and never updated. One row per import records provider, endpoint, market,
language, trigger, request time, cost, and row count. One row per import and domain records what that domain's request
cost, how many rows it returned, how many were available, the domain's own authority score, and whether it failed. One
row per keyword and domain records the observation. The middle table exists because a run is not one request: the
provider is asked separately about each domain, and the answers arrive with their own costs, counts, and failures.
Because the store is append-only, an import can be replayed, one import can be compared against another, and a genuine
response can be lifted straight out of it to become a test fixture.

**The derived core is pure.** Cluster formation, calibration, every detector, scoring, and selection are plain functions
from arrays to arrays. They import nothing that reaches the database or the network. The naming convention already in
use enforces that rather than leaving it to discipline: server-only modules carry a `.server` suffix, so a pure module
cannot reach the database without the build objecting. This is what makes the correctness question answerable, because
a detector whose entire behaviour is visible from its input can be tested without a store, a session, or a provider.

**The derived store** holds clusters and opportunities, and every import replaces it wholesale rather than merging into
it. Derived rows edited in place drift away from the evidence that produced them. The one thing that must outlive
recomputation is a merchant's decision, so a dismissal is kept in its own small table keyed by a fingerprint of the
cluster's terms rather than by a row identity the next import will throw away.

Testing follows from that shape, and it has to, because reviewing recommendations by hand does not scale past the first
few stores. Provider responses for deliberately unlike stores are checked in as fixtures: one large authoritative
domain, one store ranking for almost nothing, one narrow niche, and one non-English market. The tests then assert
properties rather than opinions. The store with no rankings still produces catalogue opportunities and produces none of
the detectors that need an authority estimate. The large store produces a capped list rather than one proportional to
its size. Every row carries its evidence. No detector fills the list. And no threshold anywhere in the code is a
literal read off one store, which is the failure this whole arrangement exists to prevent.

#### How the section is presented

The three views are sibling routes rather than tabs, because the Polaris web component set has no tab primitive and
because each view deserves its own link. They share one page shell.

- The page is `s-page` at `inlineSize="large"`. Competitors carries nine columns and the default page grid caps its main
  column at 638px, which is not enough. Going wide also removes the `aside` slot, so nothing in the section may depend
  on a sidebar.
- The market, language, provider, and last-import line lives in the page `accessory` slot, as separate text elements
  rather than one run of punctuation.
- The page `supplementalStart` slot carries the section's single banner: the market is unresolved, an import is running,
  or the last import is old enough that the numbers should be distrusted. One banner at a time, naming the action that
  clears it.
- Each view is an `s-table` at `variant="auto"`, which renders as a table on wide viewports and as a list on narrow
  ones. That is what lets a nine-column comparison survive a phone, so the column set can be as wide as the data
  deserves rather than as narrow as the smallest screen.
- The table formats its own columns. Positions and counts are `numeric`, cost per click and attributed spend are
  `currency`, and the `listSlot` designations decide what the narrow layout promotes.
- Search and filter controls sit in the table's `filters` slot so that a filtered table still reads as one object.
- Every view paginates. The store ranks for 478 terms and the provider offered 3,595 candidate domains for one small
  storefront, so no view may assume it can render its whole population.

Because the narrow layout discards column grouping, a group header cannot carry meaning that the merchant needs. Any
column whose number depends on a population says so in its own header. This is why the competitor headers read as
average position on shared terms and total ranking terms rather than sitting under a shared banner.

Each view maps its columns to the narrow layout deliberately:

- **Opportunities.** The shape reads as the kicker, so a scan down the narrow list groups striking distance, competitor
  gap, and weak hold without reading a number. The representative term is primary, the recommendation is secondary, and
  demand, difficulty, intent, our position, and the ranking competitors are labelled pairs. The recommendation opens the
  score components in a popover. A claimed row names the idea or article that took it and offers no action; an unclaimed
  row offers to write it now, and dismiss sits in a row menu so that the destructive choice is never the easy one. The
  row itself links to keyword detail.
- **Competitors.** The store is the first row and wears a badge naming it as the store rather than relying on position
  alone, because a sorted table invites the assumption that row one is the winner. The store row carries no accept,
  reject, or tracking actions. The domain is primary, shared terms is secondary, and everything else is labelled.
  Undecided suggestions render in the same table with their own badge and an accept or reject pair.
- **Coverage.** The mismatch is the kicker, since the mismatch is the reason the row exists. The term is primary and the
  ranking URL is secondary, shown as an absence when there is none. The three mismatch filters are a select in the
  filters slot rather than three separate routes, because a merchant moves between them while thinking about one term.

#### Where a chart earns its place

Most keyword tools answer every question with a chart. Here a chart has to beat a number, which it only does when the
shape of the data is the message. Three qualify.

- **Position distribution, on Competitors.** The provider already returns ranking counts bucketed by position band, so
  the histogram needs no computation. Our 478 terms with 40 in the top ten and an average position of 35.7 is a long
  right tail; a rival's 1,365 terms with 708 in the top ten is mass on the left. That contrast is the entire
  competitive story, and no row of numbers delivers it as quickly.
- **Twelve-month demand, on keyword detail.** Seasonality is a shape. A term that triples every spring changes when an
  article should be written rather than whether, and that is a scheduling decision Plan consumes directly.
- **Our position over time, on keyword detail.** The only honest answer to whether a refresh worked, and only when it
  carries a marker at every date we published or regenerated an article targeting the term. A bare line shows that
  something moved. A line with publication markers shows whether our own work is what moved it, which is the question
  the merchant is actually asking. It stays empty until several imports exist and says so rather than drawing one
  point as a trend, and it stops short of claiming attribution: the markers show coincidence in time, and the page
  says so in words. Search performance on article detail already carries revision publication markers for the same
  reason, so the two surfaces should read the same way.

Deliberately not built: a demand-against-difficulty scatter. It is the standard chart in this category and it points
merchants at exactly the terms this plan warns about, because the cheapest-looking high-demand terms are the ones held
by pages a blog article cannot displace. Everything that chart would say correctly is already said by the ranked list
and the shape badge.

Charts use Recharts, which the preferred tech stack already names for this job. The publication markers are what settle
it: an annotated time series with reference markers and tooltips is real work to hand-roll, and once one chart needs a
library the rest should use the same one rather than leaving the section half hand-drawn. Colours come from Polaris
tokens rather than a chart palette, so a chart reads as part of the admin. Every chart is accompanied by the same
figures as text, because a plotted line conveys nothing on its own to a screen reader.

Presentation rules for the whole section:

- No bare numbers. Every metric carries its provider and observation date.
- Estimates and first-party measurements never share a column. When Search Console arrives it gets its own labelled
  columns rather than being blended into an estimate.
- Absence is absence. A term the store does not rank for is shown as not ranking, not as position zero. A term the
  provider does not cover is shown as unavailable, not as zero demand.
- Traffic figures are the provider's estimate of traffic value, not measured sessions, and are labelled as such
  wherever they appear next to Shopify numbers that are measured.
- Any control that triggers a provider request says so before it runs, because imports cost money.
- Empty states explain what an import will do and what it needs. They are not spinners over nothing.

### Articles

The Articles index lists durable editorial records, not transient generation results. It supports search and filters for:

- draft;
- needs review;
- ready to publish;
- published;
- needs attention;
- failed.

The article detail route owns the editorial workflow:

- title, excerpt, tags, and destination Shopify blog;
- editable article content;
- saved revision history;
- sanitized storefront preview;
- primary and supporting keyword targets;
- **Search performance**, **Store engagement**, and **Sales impact** trends;
- specific pre-publication warnings such as **Target keywords removed** or **Search intent may have changed**;
- commercial crosslink recommendations;
- further-reading recommendations;
- regeneration into a new revision;
- save to Shopify as an unpublished draft;
- explicit publication when write support is complete.

Editing and regeneration create revisions. They do not replace the article's identity or discard accepted dependencies.

The current checkpoint introduces stable `articles` identities and moves review to `/app/articles/:articleId`.
Recommendations reference the article directly and persist the synchronized destination resource type so the UI can
count products, collections, blogs, articles, and pages. **Crosslinks** may suggest any synchronized resource type;
**Further reading** accepts only article destinations. Refresh and Add/Remove selection are available on article detail.
Article content now lives in immutable `article_revisions`, with `articles.current_revision_id` and
`articles.published_revision_id` naming the revision shown in the app and the one last sent to Shopify. `blog_drafts`
survives only as the landing table the current n8n workflows write to. Polishing selected links into a new revision,
saving the resulting relationships, and retiring the temporary `blog_drafts` bridge remain part of BW-030, BW-038,
BW-041, and BW-042.

### Settings

Settings owns store connections, source management, publishing defaults, and optional integrations. It exposes only
capabilities that are implemented.

#### Sources

Sources has two distinct sections:

1. **Store content** contains tenant-owned Shopify products, collections, blogs, articles, and pages.
2. **Subscribed sources** contains public external publications used to ground generated content.

The UI calls external inputs **Sources**. The data model calls them **publications** to avoid confusion with Shopify
`Blog` containers.

For each source, show:

- synchronization state;
- last successful refresh;
- indexed document count;
- next scheduled refresh;
- actionable failures;
- resync and unsubscribe actions.

Unsubscribing removes tenant access to the source. It does not delete shared source data while another tenant remains
subscribed.

#### Publishing and integrations

Settings also contains:

- Shopify connection and synchronization controls;
- keyword data connection status, with a Search Console connection only once that work is scheduled;
- the resolved keyword market and language, showing the Shopify signal each was derived from and allowing a correction
  when the resolution is wrong or the country is outside provider coverage;
- competitor domains, resolved against that market rather than configured with their own dimensions here;
- Shopify analytics access;
- default destination blog;
- generation schedule, cadence, and time zone;
- brand voice and content defaults;
- notification preferences;
- source and data-management controls.

## Onboarding

Onboarding is a resumable multi-step flow at `/app/onboarding`.

### Step 1: Connect store

- Confirm the authenticated shop and required permissions.
- Explain any missing scope in terms of the capability it blocks.
- Never accept a shop or tenant identifier from form data.

### Step 2: Sync store content

- Dispatch a durable initial synchronization.
- Show phase, progress, indexed counts, last checkpoint, and retryable failures.
- Let the merchant leave while work continues.
- Resume the same job after navigation or process restart.

The state machine is:

```text
pending -> catalog_sync -> content_sync -> indexing -> ready
                                     \-> failed -> retrying
```

### Step 3: Choose sources

- Accept publication home pages, RSS feeds, or article URLs.
- Resolve each input to a canonical publication before subscribing.
- Detect an existing shared publication and subscribe without starting a duplicate crawl.
- Show what content will be used and when it was last refreshed.

### Step 4: Set publishing defaults

- Choose a default destination Shopify blog.
- Set the merchant's time zone and preferred generation cadence.
- Explain that generated articles remain drafts until reviewed.

### Step 5: Review setup

- Summarize indexed Shopify resources and subscribed publications.
- Surface incomplete or failed work without hiding successful steps.
- Continue to Plan when the minimum grounding data is ready.

Contextual empty states continue onboarding after first run. Do not front-load explanations for features the merchant
cannot use yet.

## Content and subscription model

### Tenant-owned Shopify resources

Shopify resources remain in the tenant-isolated resource index defined by
[Link intelligence architecture](./link-intelligence-architecture.md). They are never deduplicated or shared across
tenants, even when storefront content is publicly reachable.

Every query and relationship includes the authenticated tenant ID. Shopify global IDs are not treated as globally unique
without that tenant ID.

### Shared public sources

Public external content can be ingested once and subscribed to by many tenants:

```text
source_publications
- publication_id
- canonical_url
- title
- feed_url
- sync_status
- last_synced_at
- next_sync_at

source_documents
- document_id
- publication_id
- canonical_url
- title
- current_revision_id
- published_at

source_document_revisions
- revision_id
- document_id
- content
- content_hash
- retrieved_at

tenant_source_subscriptions
- tenant_id
- publication_id
- status
- subscribed_at
- preferences
```

Canonical publication and document URLs provide global deduplication. Retrieval authorization always joins through an
active `tenant_source_subscriptions` row before selecting documents or chunks.

Source synchronization is reference-counted operationally: one refresh updates shared documents for every subscriber,
and shared data is retained while at least one active subscriber needs it.

The current Settings checkpoint reuses the existing shared `public.blogs` registry, keyed by normalized hostname, and
maps tenants through `blog_writer.tenant_blog_subscriptions`. It supports registration, listing, and removal only. The
publication ID, document, revision, refresh-job, status, and preference fields above remain part of the source-ingestion
slice and must extend or migrate this shared identity without making blog rows tenant-owned.

## Planning model

Generated ideas are candidates; plan items are approved editorial work.

```text
content_ideas
- tenant_id
- idea_id
- title
- angle
- target_keyword
- rationale
- status

content_plan_items
- tenant_id
- plan_item_id
- origin: manual | generated | refresh
- title
- brief
- audience
- target_keyword
- status
- scheduled_generation_at
- target_publish_at
- destination_blog_resource_id
- source_idea_id
- article_id
```

Approving an idea creates or promotes one plan item. Dismissing it preserves the decision without adding it to the
calendar. A uniqueness constraint prevents one idea from creating multiple plan items for the same tenant.

Store scheduling timestamps in UTC and retain the tenant time zone used for calendar presentation and recurrence.

## Article and revision model

An article is a durable editorial identity. Its revisions hold mutable content.

```text
articles
- tenant_id
- article_id
- plan_item_id
- shopify_article_gid
- destination_blog_resource_id
- status
- current_revision_id
- published_revision_id

article_revisions
- tenant_id
- revision_id
- article_id
- title
- excerpt
- body
- content_hash
- origin: generated | edited | regenerated | imported
- created_at
```

Saving an edit or regeneration creates a revision and advances `current_revision_id` transactionally. Publishing records
the exact revision sent to Shopify. A later edit does not change the published revision until the merchant publishes
again.

Generation and publication are separate actions. Scheduled generation may create a draft automatically; publication is
always explicit.

## SEO intelligence and performance measurement

SEO intelligence combines three different evidence classes. They must remain distinguishable in storage and in the UI:

1. **First-party search performance** from Google Search Console provides observed queries, landing pages, impressions,
   clicks, click-through rate, and average position for the merchant's verified property.
2. **Market estimates** from a keyword-data provider provide competitor rankings, related queries, search volume,
   seasonality, difficulty, intent, and SERP composition.
3. **Storefront outcomes** from Shopify provide page views, sessions, product engagement, and commerce metrics after a
   visitor reaches the store.

Search Console is the source of truth for how the merchant's pages performed in Google Search, but its API returns top
rows rather than a complete query ledger. Paid-provider metrics are estimates and must show their provider and observation
date. Shopify engagement indicates what visitors did on the store; it does not prove that an article or rewrite caused a
sale or ranking change.

### What exists today

Two pieces are already in the database and constrain how this slice is built:

- `blog_ideas.target_keyword` holds a keyword for every idea, written by the idea-generation model. It has no provider,
  market, volume, difficulty, or observation date, so it is a proposal, not evidence. Plan already displays it. Grounding
  this existing column against the keyword provider is the first useful slice of this section, ahead of competitor
  discovery, because it makes a claim the UI already makes true.
- `tenant_competitor_domains` holds normalized competitor hostnames from Settings, with no market dimensions or metric
  history attached.

Market estimates are the first evidence class to be built. Search Console arrives later and nothing in the interface
offers to connect it until it does.

### Provider strategy

Keep provider contracts separate from the normalized SEO domain model:

```text
SearchPerformanceProvider
- Google Search Console initially

KeywordIntelligenceProvider
- DataForSEO initially
- Ahrefs adapter when backlink depth or customer-provided Ahrefs access justifies it

CommerceAnalyticsProvider
- ShopifyQL initially
```

DataForSEO is the initial keyword provider because its API directly supports domain competitors, ranked keywords,
location and language filters, search volume history, difficulty, intent, and per-request cost reporting. It is
pay-as-you-go with no subscription floor, which keeps per-tenant cost attributable while the pricing model is still being
decided.

Ahrefs is a viable alternative, not a blocked one. Direct API access is included on every paid plan from Lite upward,
with no contract below Enterprise. Three things decide against it for the prototype rather than forever:

- Rows per request are capped at 100 on Lite, 250 on Standard, and 500 on Advanced. Importing the keyword profile of a
  competitor domain means paginating through thousands of rows, so the cap turns one logical import into many billed
  requests.
- API integration units are pooled across the subscription, so spend cannot be attributed to the tenant that caused it.
  That attribution is what plan limits and pricing depend on.
- Surfacing Ahrefs data to our merchants is redistribution, which runs through their application-gated Ahrefs Connect
  programme. That needs clearing before launch, not after the integration is built.

The cost comparison can now be calculated rather than guessed. Every Labs operation is priced identically at $0.012 per
request plus $0.00012 per returned row, confirmed from the account's own price list and from this project's own
requests. A thousand rows therefore costs thirteen cents per domain, so a six-domain tenant is seventy-nine cents an
import and roughly nine dollars a year at the monthly cadence. Cost is nearly linear in domain count, about a dollar
and a half per competitor per year, which is why the competitor allowance and not the row cap is the lever to vary by
plan. So a flat Advanced Ahrefs subscription at roughly $5,400 a year does not start to win until many hundreds of
tenants, and the crossover moves with competitor allowance rather than with depth. That is exactly why BW-077 records
the real number instead of trusting this arithmetic.

**Decision:** start on DataForSEO and revisit once there is a baseline. Reopen the comparison when BW-077 has measured
spend across real tenants, or earlier if row caps, unit consumption, or the Ahrefs Connect redistribution terms turn out
to be materially different from the assumptions above. Switching provider should be an adapter change and a backfill, not
a re-modelling; if it ever looks like more than that, the port has leaked.

Only the DataForSEO Labs Google API is needed, with the Keywords Data API as a volume-only fallback. Labs is served from
DataForSEO's own database rather than live SERP scraping, which suits content planning; the SERP API is priced per live
query and is only warranted if rank tracking is added later. Backlinks, OnPage, Content Analysis, Merchant, and AI
Optimization are out of scope. Confirm exact request paths against the v3 documentation when implementing.

| Need | Labs operation | Provides |
| --- | --- | --- |
| Ground an idea keyword | `get-keyword-overview` | Search volume, cost per click, paid competition, intent, and monthly searches |
| Suggest competitors | `get-competitors-domain` | Domains ranking for the same terms as the merchant storefront |
| Import competitor keywords | `get-ranked-keywords` | Every term a domain or page ranks for |
| Detect content gaps | `get-domain-intersection` | Terms two domains both rank for in the same result page |
| Expand a seed term | `get-keyword-ideas`, `get-related-keywords` | Long-tail and related terms for clustering |
| Score difficulty separately | `get-keyword-difficulty` | Difficulty for up to 1,000 terms when overview data is not needed |

Location and language are per-request parameters on every operation, supplied as the provider's full names such as
`United States` and `English` rather than codes, and the node offers no picker to populate them. Device is not a
parameter on these keyword operations; it applies to result-page data, so a keyword metric is keyed by location and
language alone. Keep the device column for the evidence classes that do expose it rather than recording a value the
provider never varied.

#### Resolving the market and language

Three facts were verified against the live schema and the live provider, and they decide the design:

- `shopLocales { locale primary }` requires `read_locales` and `read_markets_home`. Both are already granted, and the
  store scan already reads the primary locale and stamps it onto every synchronized resource. It is simply not persisted
  against the tenant.
- The `markets` and `backupRegion` queries require `read_markets`, which is **not** granted. Enumerating a merchant's
  configured markets would need a scope change and merchant re-consent, so it is not available for this slice. The
  shop's own country and currency are available without any scope change, from `billingAddress.countryCodeV2` and
  `currencyCode` on `shop`.
- The provider publishes its own catalogue at the Labs `locations_and_languages` endpoint, which is free and returns 94
  entries, each carrying `country_iso_code`, `location_code`, `location_name`, and the languages available for that
  location. Cache it and resolve against it. Do not hand-write a country table.

Resolution is therefore: the shop's country code selects the location entry by `country_iso_code`, and the primary
locale's language subtag selects the language by `language_code` within that entry's available languages. Both sides of
the mapping come from data, so a provider catalogue refresh widens coverage without a code change.

The gap this leaves must be stated plainly rather than papered over. The shop's billing country is where the business is
registered, which is usually but not always where it sells, and 94 supported locations is far short of the country list
Shopify accepts. An unresolved or wrong market is a normal outcome, not an edge case, so Settings shows the resolved
pair alongside the signal it was derived from and lets the merchant correct it to any supported pair. Keyword work does
not run at all while the pair is unresolved. Silently falling back to `United States` would corrupt every metric
downstream for every merchant who is not American, and would do it invisibly.

The volume-only fallback is the Keywords Data API Google Ads search volume endpoint, which returns no difficulty or
intent and is therefore not sufficient on its own for opportunity scoring.

One detail of `get-competitors-domain` shapes the whole Competitors view: the response contains the target domain as a
row alongside its competitors, and each row carries two separate metric sets. `metrics` covers only the terms that row
shares with the target, while `full_domain_metrics` covers the domain as a whole. Those must never be mixed in a single
column, because one answers "how do they do against us" and the other answers "how big are they". One request therefore
produces both the store's own ranking summary and the competitor list, which is why competitor discovery and the store
benchmark are one import rather than two.

Keyword requests run in n8n alongside the other content workflows for as long as n8n remains the backend. The normalized
tables and provenance rules below still apply: n8n writes snapshots in the same shape an in-process adapter would, so
moving the call into the app later is a transport change rather than a re-modelling.

Every keyword metric is only meaningful inside the market and language it was requested under, so those dimensions are
part of the key, never optional decoration. Resolve one default pair per tenant as described above rather than opening
with a picker, keep the merchant correction available for when the resolution is wrong or unsupported, and keep the
columns so a second market can be added later without migrating history.

Retain normalized snapshots and a reference to the redacted raw provider artifact. Record provider, endpoint or dataset,
market, language, device, collection time, data freshness, and request cost for every import. Cost is recorded per
request and attributed to the tenant that caused it, so plan limits and pricing can be derived from measured spend rather
than estimates.

### Competitor and long-tail discovery

Merchants select or approve competitor domains for each market. Automatic competitor discovery may suggest domains, but
must exclude marketplaces, social networks, publishers, and other irrelevant high-authority sites unless the merchant
keeps them.

Onboarding should not present an empty competitor field. Run `competitors_domain` against the storefront during setup and
present the filtered result as suggestions the merchant accepts or rejects. A suggestion is never a stored competitor:
only accepted domains reach `tenant_competitor_domains`, and nothing else in the pipeline reads a suggestion. This gives
the first run real data to work from without asking a merchant to recall competitor URLs from memory.

The provider's own `exclude_top_domains` flag is not enough on its own. Running discovery against the Fencing Club
storefront with that flag set still returned the sport's national governing body among the top results: a domain that
shares hundreds of terms and ranks far better, but that no merchant would call a competitor and that no content
strategy can displace. Classification is therefore our work, and the merchant's accept-or-reject decision is the real
filter. Roughly three and a half thousand domains came back for one small storefront, so the suggestion list must be
short, ordered, and explained rather than exhaustive.

Settings currently stores the normalized hostname list in `blog_writer.tenant_competitor_domains`. Market, language,
device, provider import, and metric history remain part of the SEO intelligence slice; no keyword research runs when a
merchant changes this list.

The opportunity pipeline:

1. Import keywords for the store and approved competitors in the same market, language, device, and search engine.
2. Find queries where competitors rank and the store is absent or materially weaker.
3. Expand promising topics with related and long-tail queries.
4. Cluster terms by the URLs already ranking for them, so that terms one page has been proven to win group together
   rather than terms that merely read alike.
5. Score clusters using demand, trend, attainable difficulty, competitor gap, catalog relevance, and commercial value.
6. Detect overlap with existing articles and products before proposing new content.
7. Recommend either a new plan item, an update to an existing article, or no action.

Opportunity status is:

```text
detected -> claimed -> planned -> measuring
         \-> dismissed
         \-> suppressed
```

A cluster is claimed when an idea is generated from it, whether generation drew it automatically or a merchant picked
it from the Opportunities view. Claiming does not generate content by itself; the idea moves through the same review
and scheduling as any other. A cluster already owned by an article produces a refresh rather than a second article,
which is how keyword cannibalization is prevented. Dismissed is a merchant's decision and survives the next import;
suppressed is a detector's, and stays queryable together with the rule that caused it.

### Feeding opportunities into generation

Research that never reaches the prompt is decoration, and a keyword handed to a writing prompt as a bare string is
barely better than none. What travels is a **generation directive**: a structured object the app compiles when an idea
is generated from a cluster, and stores on the idea and the plan item that follows it.

```text
generation_directive
- mode: new_article | refresh | metadata_only
- article_id                     (refresh and metadata_only only)
- primary_term
- supporting_terms[]             each with role: supporting | question | variant
- intent
- landing_page_shape: guide | comparison | how_to | answer | glossary | listicle
- must_cover[]                   head term, question phrasings, the terms the refresh is missing
- proof_urls[]                   competitor pages already winning the cluster
- internal_link_targets[]        products and collections the cluster is relevant to
- detector
- evidence
```

The fields that matter most are the ones a prompt cannot invent. `must_cover` is where a partial cluster puts the head
term it is missing and an answerable question puts the phrasing people actually search. `proof_urls` are the pages that
already win, so the draft is measured against real competition rather than against nothing. `internal_link_targets` are
what make the article sell rather than merely inform.

Four connection points, in the order they run:

1. **Selection.** This happens automatically rather than by merchant approval. Idea generation reads the tenant's
   highest-scoring unclaimed clusters and works from those, so the ordinary route from evidence to article has no
   approval step in it at all: the merchant asks for ideas and the ideas arrive already anchored in demand they can
   inspect afterwards. A free-text focus still works and narrows the cluster set rather than replacing it. An idea with
   no cluster behind it stays allowed and stays labelled unverified. A cluster is claimed only once an idea exists, so
   two runs cannot both take it, and the Opportunities view reads claimed rows back as progress.
2. **Shaping.** `landing_page_shape` selects the outline the draft is built against, `must_cover` becomes required
   headings, and the proof pages set the depth the draft has to reach. A six-hundred-word post does not displace the
   pages currently holding a cluster, and the proof URLs are how the workflow knows that before writing rather than
   after measuring.
3. **Retrieval.** The draft workflow already grounds itself in the store's indexed resources. The directive's link
   targets and cluster terms bias that retrieval toward the products this cluster is actually about, which is the
   difference between an article that mentions the store and one that sells for it.
4. **Verification.** The returned revision is checked against the directive: the primary term in the title and opening,
   the `must_cover` entries present as headings, the link targets used. Missing coverage of the primary target is a
   review signal, not a hard gate; the removed-target warning already covers the regeneration case.

The transport does not change. The existing workflows take a thin payload and read what they need from the database by
identifier, so the directive travels the same way: the app passes the plan item, and the workflow reads the directive
rather than receiving it inline.

Two manual paths stay open beside the automatic one, because a merchant will sometimes know something the evidence does
not. They can start an idea from a specific opportunity row, which compiles the same directive from that cluster. Or
they can add an idea themselves and type the keywords it targets. Typing a keyword unaided is where a merchant invents
terms nobody searches for, so that input completes against terms already observed for the store and for its accepted
competitors, each suggestion showing its demand and whether the store already ranks for it. A term chosen from those
suggestions arrives already resolved and can be scored, ranked, and counted as coverage immediately. A term typed
freehand is still accepted, and is still labelled unverified until it resolves against the provider.

Three rules keep this from decaying. **The directive is data, never prose** — flattened into the brief text it cannot be
verified afterwards, and a merchant editing the brief destroys it silently. **A negative instruction is routed, not
prompted** — `metadata_only` must reach a title-and-description workflow rather than the draft workflow carrying an
instruction not to touch the body, because an instruction a model is free to ignore is not a constraint. And
**generation consumes keyword evidence and never produces it**: a model may propose a term, but a term becomes evidence
only by resolving against the provider, and only a resolved term can be scored, ranked, or counted as coverage.

### Keyword and observation model

Keywords attach to the stable article identity. Measurements attach to a date and the landing URL actually observed.
Publishing events connect a measurement window to the exact article revision that was live.

```text
seo_properties
- tenant_id
- property_id
- provider
- external_property_ref
- canonical_domain
- status

seo_competitors
- tenant_id
- competitor_id
- domain
- market
- language
- status

seo_keywords
- keyword_id
- normalized_term
- search_engine
- market
- language
- device

seo_keyword_metric_snapshots
- keyword_id
- provider
- observed_at
- search_volume
- monthly_volumes
- difficulty
- intent
- cpc
- serp_features

seo_provider_requests
- tenant_id
- request_id
- provider
- endpoint
- operation
- market
- language
- device
- requested_at
- cost
- status

idea_keyword_resolutions
- tenant_id
- idea_id
- keyword_id
- resolved_at
- resolution: resolved | unresolved

keyword_imports
- tenant_id
- import_id
- provider
- endpoint
- location_name
- language_code
- trigger: scheduled | manual
- requested_at
- completed_at
- cost
- row_count
- status: running | succeeded | partial | failed
- error_code

keyword_import_domains
- tenant_id
- import_id
- domain
- is_own_domain
- domain_rank
- row_count
- available_row_count
- cost
- status: running | succeeded | failed
- error_code

keyword_observations
- tenant_id
- import_id
- keyword
- domain
- is_own_domain
- rank_absolute
- rank_group
- ranking_url
- previous_rank_absolute
- search_volume
- monthly_searches
- difficulty
- main_intent
- foreign_intents
- serp_item_types
- serp_average_domain_rank
- serp_result_count
- estimated_traffic_volume
- field_freshness
- observed_at

keyword_clusters
- tenant_id
- import_id
- cluster_id
- fingerprint
- head_keyword
- terms
- demand
- our_best_position
- our_best_url
- competitor_page_count
- serp_average_domain_rank
- reachability
- evidence

keyword_opportunities
- tenant_id
- import_id
- opportunity_id
- cluster_id
- detector
- verdict: new_article | refresh | metadata_only | suppress
- score
- score_components
- target_article_id
- claimed_by_idea_id
- evidence

keyword_decisions
- tenant_id
- fingerprint
- decision: dismissed
- reason
- decided_at

article_keyword_targets
- tenant_id
- article_id
- keyword_id
- role: primary | supporting | observed
- status
- assigned_at

article_publications
- tenant_id
- publication_id
- article_id
- revision_id
- canonical_url
- published_at
- superseded_at

article_search_observations
- tenant_id
- article_id
- keyword_id
- observed_landing_url
- provider
- observed_on
- impressions
- clicks
- click_through_rate
- average_position

resource_engagement_daily
- tenant_id
- resource_type: article | product
- resource_id
- canonical_url
- observed_on
- provider
- page_views
- sessions
- product_views
- add_to_carts
- orders
- revenue
```

The keyword tables divide by who owns their lifetime. `keyword_imports`, `keyword_import_domains`, and
`keyword_observations` are append-only evidence: written once by an import, never updated, and readable as a fixture
afterwards. The three split apart because a run spans one provider request per domain, so cost, status, row counts,
and the domain's own authority score are properties of a request rather than of the run or of a term, and a domain
whose request fails has to be recordable without discarding the domains that answered. `keyword_clusters` and
`keyword_opportunities` are derived and replaced wholesale by each import, because derived rows edited in place stop
agreeing with the evidence they came from. `keyword_decisions` exists precisely because that replacement would
otherwise resurrect what a merchant dismissed, so it is keyed by a fingerprint of the cluster's terms rather than by a
cluster identity the next import discards. `seo_keywords` and `seo_keyword_metric_snapshots` remain the per-term
history that keyword detail reads, which is a different question from what one import observed.

An observed query can become a supporting or primary target only through a reviewable decision. Preserve the original
query text for display while using a normalized term for matching. Never overwrite historical provider snapshots when a
provider revises its estimates.

### Rewrite safeguards

No system can ensure that a rewrite will not hurt rankings. The product reduces risk with explicit baselines, revision
comparison, controlled publication, and post-publication monitoring.

Before generating or publishing a rewrite:

- capture 28-day and 90-day Search Console baselines for the article's actual landing URL and queries;
- identify primary, supporting, and newly observed queries;
- preserve the current title, headings, metadata, canonical URL, internal links, and accepted dependencies;
- compare the candidate revision for intent drift, lost topic coverage, changed claims, and removed link targets;
- block automatic publication and show material regressions for merchant review.

After publication:

- associate observations with the publication event and exact revision;
- compare 7-day, 28-day, and 90-day windows with appropriate prior-period and year-over-year baselines;
- alert on meaningful losses in clicks, impressions, position, page engagement, or commerce outcomes;
- allow the merchant to restore a prior revision or create a targeted refresh proposal.

Rank and traffic changes are observational, not proof of causation. Reports must show seasonality, incomplete data,
provider freshness, and external changes where known instead of claiming that one rewrite caused the result.

### Shopify analytics

Use ShopifyQL through the Admin GraphQL API as the preferred source for native store analytics. It requires the
`read_reports` scope and Shopify's protected customer data approval. Start with a feasibility query against the target
store to confirm which page-view, session, landing-page, product, and sales dimensions are exposed for its plan and data.

ShopifyQL metrics provide aggregate context. Article page views attach to the canonical article URL; product views and
commerce metrics attach to products or store activity. Do not infer that an article assisted a product view or sale from
matching dates, traffic changes, or the HTTP referrer. Detailed article journey measurement belongs to the deferred
content analytics tracker.

## Recommendations and dependencies

Recommendations are proposals. Dependencies record relationships actually incorporated into an article.

```text
article_recommendations
- tenant_id
- recommendation_id
- article_id
- source_revision_id
- objective: commercial_crosslink | further_reading
- destination_type
- destination_id
- placement
- anchor_text
- rationale
- evidence
- status: proposed | accepted | rejected | stale | applied

article_dependencies
- tenant_id
- dependency_id
- article_id
- applied_revision_id
- relationship_type
- destination_type
- destination_id
- destination_revision_or_hash
- placement
- status
- last_verified_at
```

Accepting a recommendation must:

1. Reload and verify the destination for the authenticated tenant.
2. Require the reviewed source revision.
3. Apply the placement deterministically without regenerating prose.
4. Create a new article revision.
5. Create or update the dependency edge.
6. Mark the recommendation applied.

Regeneration creates new prose, then attempts to reapply still-valid dependencies deterministically. Ambiguous or
missing placements become review conflicts; they are never silently dropped.

Reverse dependency lookup identifies affected articles when a product becomes unavailable, an article is unpublished,
a canonical URL changes, or a subscribed source publishes a relevant revision. These events create refresh proposals,
not automatic rewrites.

## Durable jobs

Source crawling, indexing, scheduled generation, publication, SEO imports, analytics aggregation, and impact analysis
run as durable jobs. An HTTP action dispatches work and returns job identity; it does not hold the request open for
completion.

Store synchronization is the exception, and deliberately so. It is owned by n8n: one workflow synchronizes a single
store and then asks for indexing, and a second sweeps every store that has gone 72 hours without a sync. Both call one
bearer-authenticated endpoint in the app, which scans and persists a whole store in one request. The workflow layer owns
the retries, the ordering, and the run history, so the merchant's button and the schedule are the same run seen from two
sides, and the request is held open because a merchant who has just pressed a button is owed the result. A catalogue too
large for one request still needs the resumable form; it belongs behind the same endpoint rather than beside it.

Every job has:

- a tenant ID, except a globally shared source-refresh job;
- an idempotency key;
- persisted phase and cursor;
- bounded retries;
- cancellation rules;
- redacted failure details;
- timestamps and progress suitable for merchant-facing status.

A shared source-refresh job may update only public source tables. Tenant-specific retrieval or generation begins only
after authorization through a subscription.

The keyword import runs monthly per tenant from the n8n schedule, and is also reachable by hand from Settings where it
is metered to once a week. Both entry points create the same job with an idempotency key derived from the tenant and
the hour, so a repeated manual request joins the work already recorded instead of starting a second one and paying
twice.

## Delivery plan

The ordered, implementation-sized work for this plan is tracked in the
[MVP implementation backlog](./mvp-backlog.md). The backlog defines the first working editorial release separately from
the source and SEO increments that complete the planned MVP.

### 1. Validate onboarding with Fencing Club

- Deploy the app to a public HTTPS host and select Custom distribution for the store. A production store cannot be a
  `shopify app dev` target, so live-store acceptance is blocked until this is done, and so is every schedule: a
  development tunnel has no address that outlives a restart, so the sync workflows cannot reach the app.
- Install and authorize the app for the Fencing Club store.
- Run the initial traversal against its larger product, collection, article, blog, and page set.
- Record pagination volume, duration, failures, and index counts.
- Replace request-bound synchronization with resumable jobs before treating large-store onboarding as complete.
- Verify that leaving and returning to onboarding preserves progress.

**Exit gate:** Fencing Club reaches `ready` without a long-lived browser request, duplicate resources, or partial-snapshot
deactivation.

### 2. Add shared source subscriptions

- Add publication, document, revision, and tenant-subscription tables.
- Canonicalize and deduplicate publication registration.
- Add resumable feed, sitemap, and document refresh jobs.
- Enforce subscription authorization in every retrieval query.
- Build onboarding source selection and the Sources page.

**Exit gate:** Two tenants can subscribe to one publication, one refresh updates shared content, and neither tenant can
retrieve a publication it does not subscribe to.

### 3. Build Plan and scheduling

- Add content ideas and plan items with explicit promotion semantics.
- Build backlog and calendar views over the same records.
- Support manual briefs, generated ideas, approval, dismissal, drag scheduling, and destination-blog selection.
- Dispatch idempotent generation jobs at the scheduled time.

**Exit gate:** A merchant can create or approve an idea, schedule it, and receive exactly one reviewable draft after the
scheduled generation time.

### 4. Build article editing and Shopify publication

- Add durable articles and immutable revisions.
- Build the Articles index and `/app/articles/:articleId` editor.
- Add autosave or explicit save with revision-conflict handling.
- Preserve the sandboxed preview.
- Add explicit Shopify draft creation and publication with actionable user errors.
- Reauthorize every already-installed store whenever the requested scopes change. An existing installation does not
  receive a newly added scope such as `write_content` until the merchant approves the app again, and publishing fails
  until they do.

**Exit gate:** A merchant can edit a generated draft, save revisions, create or update the corresponding Shopify draft,
and publish an explicitly selected revision.

### 5. Add SEO intelligence and outcome measurement

- Add provider-neutral keyword, competitor, opportunity, target, publication, and observation tables.
- Resolve the tenant market and language from Shopify against the cached provider location catalogue.
- Implement DataForSEO competitor gaps, ranked keywords, long-tail expansion, and metric snapshots behind a provider
  port.
- Build the Keywords section with its Opportunities, Competitors, Coverage, and keyword detail views.
- Feed approved clusters into idea generation and carry them through the brief into draft generation.
- Add keyword targets, revision warnings, and performance trends to article detail.
- Connect Search Console and import page-query performance on a durable schedule.
- Prove available ShopifyQL engagement dimensions using the Fencing Club store.
- Add publication-event baselines and post-publication monitoring without causal claims.

**Exit gate:** A merchant can approve a competitor keyword opportunity, publish a targeted article revision, and compare
its search and storefront performance with the preserved pre-publication baseline and visible data provenance.

### 6. Apply recommendations and persist dependencies

- Move recommendations from draft identity to article and source-revision identity.
- Support anchor and placement adjustment before approval.
- Apply accepted crosslinks and further reading deterministically.
- Persist dependency edges and preserve them across regeneration.
- Detect destination changes and create reviewable refresh proposals.

Follow [Link intelligence architecture](./link-intelligence-architecture.md) and its
[focused backlog](./link-intelligence-backlog.md) for retrieval, ranking, and isolation acceptance.

**Exit gate:** Accepted relationships survive editing and regeneration, and a changed destination identifies every
affected article without rewriting published content.

### 7. Operational hardening

- Add queue lag, synchronization age, generation latency, retry, and failure telemetry.
- Add dead-letter and replay tooling.
- Run cross-tenant isolation tests across subscriptions, jobs, retrieval, articles, recommendations, and dependencies.
- Verify keyboard, accessible-name, status-announcement, desktop, and narrow-layout behavior in the integrated app.

**Exit gate:** Operators can diagnose and recover failed work without database edits, and tenant-isolation tests pass at
every durable boundary.

## Deferred work

Do not expand the primary navigation for these capabilities until the core workflow is established:

- Ahrefs backlink intelligence beyond the initial keyword-provider contract;
- content analytics tracker for article engagement and assisted product journeys;
- storefront related-content theme blocks;
- automatic content-refresh campaigns;
- collaborative roles and approvals.

These capabilities should enter Home, Plan, Articles, Sources, or Settings unless customer research demonstrates a new
top-level destination is necessary.

### Content analytics tracker

Build detailed content measurement as an explicit, consent-aware Shopify integration after the core editorial and SEO
workflow is established. Use a theme app extension app embed together with an app Web Pixel rather than a `ScriptTag`,
manual theme edit, or referrer-based approximation.

The tracker starts an article exposure from Shopify's standard `page_viewed` event when a consented visitor views a
mapped article URL. A direct landing, bookmark, copied link, or returning visit therefore begins an article cohort
without requiring an external or internal referrer. Resolve the canonical URL and event timestamp against
`article_publications` on the server so the observation attaches to the exact revision that was live.

The app embed may publish bounded custom engagement events that Shopify's standard events do not provide:

- `blog_writer:article_engaged` after defined active-time or scroll thresholds;
- `blog_writer:article_product_link_clicked` for an explicit product crosslink selection.

The Web Pixel combines those events with only the required Shopify standard events, including `page_viewed`,
`product_viewed`, `product_added_to_cart`, and `checkout_completed`. Validate event shape, resolve article and product
identifiers within the tenant, and deduplicate Shopify event IDs so retries do not inflate aggregates. The tracker is
merchant-facing analytics, not a security or billing system.

The app requires `write_pixels` and `read_customer_events`, declares its Customer Privacy purposes, and runs only when the
merchant activates it and the visitor's consent permits it.

Use a short-lived pseudonymous journey key only where permitted. Resolve events into daily aggregates, then expire the
event-level journey data. Do not retain customer identity, full browsing histories, or arbitrary URL query strings. Do
not add internal UTM parameters because they can corrupt the merchant's acquisition attribution.

```text
article_journey_aggregates_daily
- tenant_id
- article_id
- article_revision_id
- product_resource_id
- observed_on
- attribution_model: first_article_touch | last_article_touch | assisted
- attribution_window
- article_views
- engaged_views
- product_link_clicks
- product_views
- add_to_carts
- checkouts
- orders
```

The tracker supports merchant-facing metrics such as **Engaged article views**, **Product visits after reading**, and
**Assisted orders**. These are bounded attribution models, not proof that the article caused an outcome. The UI must show
the model, attribution window, consent limitations, activation date, and data coverage. Counts from ShopifyQL and the
tracker remain separate because their collection methods and populations differ.

**Exit gate:** Direct and referred article visits can start consented article cohorts; downstream product and checkout
events aggregate against the correct article revision; raw journey data expires on schedule; and reports never rely on
the HTTP referrer or claim causal impact.

## Product safety and acceptance

- AI-generated content is labeled and reviewable.
- The model cannot invent destination URLs or tenant identity.
- External source provenance remains traceable to a canonical document revision.
- Store content and telemetry never mix tenants.
- Generated drafts are never published automatically.
- Recommendation application preserves unrelated article content.
- Source or destination changes create proposals rather than silent published-content edits.
- Every new or changed merchant workflow is verified in the integrated browser at desktop and mobile sizes.
