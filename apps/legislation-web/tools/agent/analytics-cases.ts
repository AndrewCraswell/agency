import type { AnalyticsHelperMetric, AnalyticsMetricBinding } from "../../src/modules/evaluations/analyticsChecks"

export type AnalyticsCase = {
  id: string
  question: string
  referenceSql: string
  expectedMetrics: string[]
  requiredScope?: string
  metricBindings?: AnalyticsMetricBinding[]
  helperMetrics?: AnalyticsHelperMetric[]
}

const cases: AnalyticsCase[] = []
function add(question: string, select: string, from: string, where = "", group = "", order = "", limit = 10) {
  cases.push({
    id: `analytics-${String(cases.length + 1).padStart(3, "0")}`,
    question,
    expectedMetrics: [],
    referenceSql: `select ${select} from ${from}${where ? ` where ${where}` : ""}${group ? ` group by ${group}` : ""}${order ? ` order by ${order}` : ""} limit ${limit}`
  })
}

const sponsorships =
  "legislation.bill_sponsors sponsor join legislation.bills bill on bill.id = sponsor.bill_id left join legislation.people person on person.id = sponsor.person_id"
const currentBills = "bill.session_id = 'session:us:119'"
const primary = `${currentBills} and sponsor.is_primary = true`
const ocasio = "sponsor.person_id = 'person:congress:o000172'"
const distinctBills = "count(distinct bill.id)::float8 as total"
const peopleGroup = "person.id, person.name"
const peopleSelect = "person.id, person.name"

add(
  "List the first 10 bills Alexandria Ocasio-Cortez primarily sponsored in the 119th Congress, ordered by bill ID. Include bill ID, identifier, title and source URL.",
  'bill.id, bill.identifier, bill.title, bill.source_url as "sourceUrl"',
  sponsorships,
  `${primary} and ${ocasio}`,
  "bill.id",
  "bill.id"
)
add(
  "How many distinct bills did Alexandria Ocasio-Cortez primarily sponsor in the 119th Congress?",
  distinctBills,
  sponsorships,
  `${primary} and ${ocasio}`
)
add(
  "How many distinct bills did Alexandria Ocasio-Cortez cosponsor, excluding primary sponsorship, in the 119th Congress?",
  distinctBills,
  sponsorships,
  `${currentBills} and ${ocasio} and sponsor.is_primary = false`
)
add(
  "Who are the top 10 primary sponsors by distinct bill count in the 119th Congress? Include person ID, name and count; exclude unresolved people.",
  `${peopleSelect}, ${distinctBills}`,
  sponsorships,
  `${primary} and person.id is not null`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Who are the top 10 cosponsors by distinct bill count in the 119th Congress, excluding primary sponsorship? Include person ID, name and count; exclude unresolved people.",
  `${peopleSelect}, ${distinctBills}`,
  sponsorships,
  `${currentBills} and sponsor.is_primary = false and person.id is not null`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Which 10 bills in the 119th Congress have the most distinct resolved cosponsors? Include bill ID, title and count, excluding primary sponsors.",
  "bill.id, bill.title, count(distinct sponsor.person_id)::float8 as total",
  sponsorships,
  `${currentBills} and sponsor.is_primary = false and person.id is not null`,
  "bill.id",
  "total desc, bill.id"
)
add(
  "Which 10 bills in the 119th Congress have the most distinct resolved sponsors, counting primary sponsors and cosponsors together? Include bill ID, title and count.",
  "bill.id, bill.title, count(distinct sponsor.person_id)::float8 as total",
  sponsorships,
  `${currentBills} and person.id is not null`,
  "bill.id",
  "total desc, bill.id"
)
add(
  "Count distinct primarily sponsored bills in the 119th Congress by the sponsor's currently recorded party. Exclude unknown parties and order by count descending.",
  `person.party, ${distinctBills}`,
  sponsorships,
  `${primary} and person.party is not null`,
  "person.party",
  "total desc, person.party"
)
add(
  "Count distinct primarily sponsored bills in the 119th Congress by bill chamber, ordered by count descending.",
  `bill.chamber, ${distinctBills}`,
  sponsorships,
  primary,
  "bill.chamber",
  "total desc, bill.chamber asc nulls last"
)
add(
  "For Alexandria Ocasio-Cortez's primarily sponsored bills in the 119th Congress, count distinct bills by recorded status, ordered by count descending.",
  `bill.status, ${distinctBills}`,
  sponsorships,
  `${primary} and ${ocasio}`,
  "bill.status",
  "total desc, bill.status asc nulls last"
)
add(
  "What are the earliest and latest recorded introduction dates of Alexandria Ocasio-Cortez's primarily sponsored bills in the 119th Congress?",
  "min(bill.introduced_at) as earliest, max(bill.introduced_at) as latest",
  sponsorships,
  `${primary} and ${ocasio}`
)
add(
  "List the first 10 sponsorship records for H.R. 1 of the 119th Congress, ordered by sponsorship ID. Include sponsorship ID, published sponsor name and primary-sponsor flag.",
  'sponsor.id, sponsor.name, sponsor.is_primary as "isPrimary"',
  sponsorships,
  "bill.id = 'bill:us:119:hr:1'",
  "",
  "sponsor.id"
)
add(
  "Who are the top 10 resolved cosponsors of bills primarily sponsored by Alexandria Ocasio-Cortez in the 119th Congress? Include person ID, name and distinct shared-bill count; exclude primary sponsorship on the cosponsor side.",
  `${peopleSelect}, ${distinctBills}`,
  `${sponsorships} join legislation.bill_sponsors principal on principal.bill_id = bill.id`,
  `${currentBills} and principal.person_id = 'person:congress:o000172' and principal.is_primary = true and sponsor.is_primary = false and person.id is not null`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Which top 10 resolved primary sponsors in the 119th Congress have at least 20 distinct bills? Include person ID, name and count.",
  `${peopleSelect}, ${distinctBills}`,
  sponsorships,
  `${primary} and person.id is not null`,
  `${peopleGroup} having count(distinct bill.id) >= 20`,
  "total desc, person.id"
)
add(
  "How many distinct bills in the 119th Congress have a recorded sponsorship row whose person identity is unresolved?",
  distinctBills,
  sponsorships,
  `${currentBills} and sponsor.person_id is null`
)
add(
  "Compare Alexandria Ocasio-Cortez's distinct primary-sponsored bill counts for the 118th and 119th Congresses. Include session ID and count, ordered by session ID.",
  `bill.session_id as "sessionId", ${distinctBills}`,
  sponsorships,
  `${ocasio} and sponsor.is_primary = true and bill.session_id in ('session:us:118','session:us:119')`,
  "bill.session_id",
  "bill.session_id"
)
add(
  "Compare Alexandria Ocasio-Cortez's distinct cosponsored bill counts for the 118th and 119th Congresses, excluding primary sponsorship. Include session ID and count, ordered by session ID.",
  `bill.session_id as "sessionId", ${distinctBills}`,
  sponsorships,
  `${ocasio} and sponsor.is_primary = false and bill.session_id in ('session:us:118','session:us:119')`,
  "bill.session_id",
  "bill.session_id"
)
add(
  "Who are the top 10 resolved primary sponsors of 119th-Congress bills introduced from January 1 through September 17, 2026 inclusive? Include person ID, name and distinct bill count.",
  `${peopleSelect}, ${distinctBills}`,
  sponsorships,
  `${primary} and person.id is not null and bill.introduced_at between '2026-01-01' and '2026-09-17'`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "How many distinct 119th-Congress bills have a primary sponsor whose currently recorded party is Republican?",
  distinctBills,
  sponsorships,
  `${primary} and person.party = 'Republican'`
)
add(
  "Count distinct currently active people who primarily sponsored bills in the 119th Congress, grouped by their currently recorded party. Exclude unknown parties and order by count descending.",
  "person.party, count(distinct person.id)::float8 as total",
  sponsorships,
  `${primary} and person.is_active = true and person.party is not null`,
  "person.party",
  "total desc, person.party"
)

const positions =
  "legislation.vote_positions position join legislation.votes vote on vote.id = position.vote_id left join legislation.people person on person.id = position.person_id"
const currentVotes = "vote.session_id = 'session:us:119'"
const knownVoter = `${currentVotes} and person.id is not null`
const distinctVotes = "count(distinct vote.id)::float8 as total"

add(
  "Who are the top 10 resolved people with the most distinct not-voting positions on lower-chamber votes in the 119th Congress? Include person ID, name and count. Do not include absent or abstain.",
  `${peopleSelect}, count(distinct (position.vote_id, position.source_identity))::float8 as total`,
  positions,
  `${knownVoter} and vote.chamber = 'lower' and position.option = 'not-voting'`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Who are the top 10 resolved people with recorded explicit abstentions in the 119th Congress? Include person ID, name and distinct vote count. Do not treat absence or not-voting as abstention.",
  `${peopleSelect}, ${distinctVotes}`,
  positions,
  `${knownVoter} and position.option = 'abstain'`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Among resolved people with at least 100 recorded votes in the 119th Congress, which 10 have the highest explicit-absence percentage? Include person ID, name, matching absent votes, total recorded votes and percent. Count distinct votes and use recorded positions as the denominator, not eligibility.",
  `${peopleSelect}, (count(distinct vote.id) filter(where position.option = 'absent'))::float8 as matching, ${distinctVotes}, 100.0 * count(distinct vote.id) filter(where position.option = 'absent') / nullif(count(distinct vote.id),0) as percent`,
  positions,
  knownVoter,
  `${peopleGroup} having count(distinct vote.id) >= 100`,
  "percent desc, person.id"
)
add(
  "Who are the top 10 resolved people with the most distinct yes votes in the 119th Congress? Include person ID, name and count.",
  `${peopleSelect}, ${distinctVotes}`,
  positions,
  `${knownVoter} and position.option = 'yes'`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Who are the top 10 resolved people with the most distinct no votes in the 119th Congress? Include person ID, name and count.",
  `${peopleSelect}, ${distinctVotes}`,
  positions,
  `${knownVoter} and position.option = 'no'`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Count recorded individual vote-position identities by vote option for the 119th Congress, ordered by count descending. Count the composite position identity, not distinct people.",
  "position.option, count(*)::float8 as total",
  positions,
  currentVotes,
  "position.option",
  "total desc, position.option"
)
add(
  "Count distinct votes in the 119th Congress by result, ordered by count descending.",
  `vote.result, ${distinctVotes}`,
  "legislation.votes vote",
  currentVotes,
  "vote.result",
  "total desc, vote.result asc nulls last"
)
add(
  "Count distinct votes in the 119th Congress by chamber, ordered by count descending.",
  `vote.chamber, ${distinctVotes}`,
  "legislation.votes vote",
  currentVotes,
  "vote.chamber",
  "total desc, vote.chamber asc nulls last"
)
add(
  "List the first 10 votes recorded directly on H.R. 1 of the 119th Congress by vote ID. Include vote ID, motion and result.",
  "vote.id, vote.motion, vote.result",
  "legislation.votes vote",
  "vote.bill_id = 'bill:us:119:hr:1'",
  "",
  "vote.id"
)
add(
  "Count distinct votes recorded directly on H.R. 1 of the 119th Congress by result, ordered by count descending.",
  `vote.result, ${distinctVotes}`,
  "legislation.votes vote",
  "vote.bill_id = 'bill:us:119:hr:1'",
  "vote.result",
  "total desc, vote.result asc nulls last"
)
add(
  "Count individual recorded position identities by option on votes recorded directly on H.R. 1 of the 119th Congress, ordered by count descending.",
  "position.option, count(distinct (position.vote_id, position.source_identity))::float8 as total",
  positions,
  "vote.bill_id = 'bill:us:119:hr:1'",
  "position.option",
  "total desc, position.option"
)
add(
  "Which 10 votes in the 119th Congress have the highest recorded yes count? Include vote ID, motion and yesCount. Exclude unknown yes counts.",
  'vote.id, vote.motion, vote.yes_count as "yesCount"',
  "legislation.votes vote",
  `${currentVotes} and vote.yes_count is not null`,
  "",
  "vote.yes_count desc, vote.id"
)
add(
  "Which 10 votes in the 119th Congress have the highest recorded no count? Include vote ID, motion and noCount. Exclude unknown no counts.",
  'vote.id, vote.motion, vote.no_count as "noCount"',
  "legislation.votes vote",
  `${currentVotes} and vote.no_count is not null`,
  "",
  "vote.no_count desc, vote.id"
)
add(
  "Which 10 votes in the 119th Congress have the highest recorded not-voting count? Include vote ID, motion and notVotingCount. Exclude unknown tallies.",
  'vote.id, vote.motion, vote.not_voting_count as "notVotingCount"',
  "legislation.votes vote",
  `${currentVotes} and vote.not_voting_count is not null`,
  "",
  "vote.not_voting_count desc, vote.id"
)
add(
  "How many 119th-Congress votes have no individual position rows in the local database? Treat missing data as unknown coverage, not as zero participation.",
  distinctVotes,
  "legislation.votes vote left join legislation.vote_positions position on position.vote_id = vote.id",
  `${currentVotes} and position.vote_id is null`
)
add(
  "How many individual position identities in the 119th Congress have no resolved person ID?",
  "count(distinct (position.vote_id, position.source_identity))::float8 as total",
  positions,
  `${currentVotes} and position.person_id is null`
)
add(
  "Count Alexandria Ocasio-Cortez's distinct recorded votes in the 119th Congress by option, ordered by count descending.",
  `position.option, ${distinctVotes}`,
  positions,
  `${currentVotes} and position.person_id = 'person:congress:o000172'`,
  "position.option",
  "total desc, position.option"
)
add(
  "How many distinct votes have a recorded position for Alexandria Ocasio-Cortez in the 119th Congress?",
  distinctVotes,
  positions,
  `${currentVotes} and position.person_id = 'person:congress:o000172'`
)
add(
  "What percentage of Alexandria Ocasio-Cortez's distinct recorded votes in the 119th Congress are explicitly not-voting? Return matching, total and percent, using recorded positions as the denominator.",
  `(count(distinct vote.id) filter(where position.option = 'not-voting'))::float8 as matching, ${distinctVotes}, 100.0 * count(distinct vote.id) filter(where position.option = 'not-voting') / nullif(count(distinct vote.id),0) as percent`,
  positions,
  `${currentVotes} and position.person_id = 'person:congress:o000172'`
)
add(
  "Which 10 bills in the 119th Congress have the most distinct votes recorded directly against them? Include bill ID, title and vote count, and include only bills with a recorded vote.",
  `bill.id, bill.title, ${distinctVotes}`,
  "legislation.bills bill join legislation.votes vote on vote.bill_id = bill.id",
  currentBills,
  "bill.id",
  "total desc, bill.id"
)

const amendments =
  "legislation.amendments amendment left join legislation.bills bill on bill.id = amendment.bill_id left join legislation.people person on person.id = amendment.sponsor_person_id"
const currentAmendments = "amendment.session_id = 'session:us:119'"
const distinctAmendments = "count(distinct amendment.id)::float8 as total"

add(
  "Which 10 resolved bills have the most structured amendment records from the 119th Congress? Include bill ID, title and amendment count; do not count document renditions.",
  `bill.id, bill.title, ${distinctAmendments}`,
  amendments,
  `${currentAmendments} and bill.id is not null`,
  "bill.id",
  "total desc, bill.id"
)
add(
  "Who are the top 10 resolved sponsors of structured amendment records in the 119th Congress? Include person ID, name and count.",
  `${peopleSelect}, ${distinctAmendments}`,
  amendments,
  `${currentAmendments} and person.id is not null`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Count structured amendments in the 119th Congress by chamber, ordered by count descending.",
  `amendment.chamber, ${distinctAmendments}`,
  amendments,
  currentAmendments,
  "amendment.chamber",
  "total desc, amendment.chamber asc nulls last"
)
add(
  "Count structured amendments in the 119th Congress by recorded status, ordered by count descending, preserving unknown status separately.",
  `amendment.status, ${distinctAmendments}`,
  amendments,
  currentAmendments,
  "amendment.status",
  "total desc, amendment.status asc nulls last"
)
add(
  "How many distinct structured amendments are linked to 119th-Congress bills primarily sponsored by Alexandria Ocasio-Cortez? Scope by the bill's session.",
  distinctAmendments,
  `${amendments} join legislation.bill_sponsors sponsor on sponsor.bill_id = bill.id`,
  `${primary} and ${ocasio}`
)
add(
  "List the first 10 structured amendments linked to H.R. 1 of the 119th Congress by amendment ID. Include ID, printedIdentifier and status.",
  'amendment.id, amendment.printed_identifier as "printedIdentifier", amendment.status',
  amendments,
  "amendment.bill_id = 'bill:us:119:hr:1'",
  "",
  "amendment.id"
)
add(
  "How many distinct resolved bills have a structured amendment whose session is the 119th Congress?",
  "count(distinct amendment.bill_id)::float8 as total",
  amendments,
  currentAmendments
)
add(
  "What are the earliest and latest recorded submission dates of structured amendments in the 119th Congress?",
  "min(amendment.submitted_date) as earliest, max(amendment.submitted_date) as latest",
  amendments,
  currentAmendments
)
add(
  "How many structured amendments in the 119th Congress were submitted from January 1 through September 17, 2026 inclusive?",
  distinctAmendments,
  amendments,
  `${currentAmendments} and amendment.submitted_date between '2026-01-01' and '2026-09-17'`
)
add(
  "How many structured amendments in the 119th Congress have no resolved sponsor person ID?",
  distinctAmendments,
  amendments,
  `${currentAmendments} and amendment.sponsor_person_id is null`
)
add(
  "Which 10 structured amendments in the 119th Congress have the most recorded actions, with at least five actions? Include amendment ID, printedIdentifier and distinct action count.",
  'amendment.id, amendment.printed_identifier as "printedIdentifier", count(distinct action.id)::float8 as total',
  "legislation.amendments amendment join legislation.amendment_actions action on action.amendment_id = amendment.id",
  currentAmendments,
  "amendment.id having count(distinct action.id) >= 5",
  "total desc, amendment.id"
)
add(
  "Count recorded amendment-action identities for 119th-Congress structured amendments by amendment chamber, ordered by count descending.",
  "amendment.chamber, count(distinct action.id)::float8 as total",
  "legislation.amendment_actions action join legislation.amendments amendment on amendment.id = action.amendment_id",
  currentAmendments,
  "amendment.chamber",
  "total desc, amendment.chamber asc nulls last"
)
add(
  "How many structured amendments in the 119th Congress have Alexandria Ocasio-Cortez as their resolved sponsor?",
  distinctAmendments,
  amendments,
  `${currentAmendments} and amendment.sponsor_person_id = 'person:congress:o000172'`
)
add(
  "Which 10 bills in the 119th Congress have both a structured amendment and an amendment-classified document? Include bill ID, title and distinct structured amendment count, without multiplying counts by document renditions.",
  `bill.id, bill.title, ${distinctAmendments}`,
  "legislation.bills bill join legislation.amendments amendment on amendment.bill_id = bill.id join legislation.bill_documents document on document.bill_id = bill.id",
  `${currentBills} and document.classification = 'amendment'`,
  "bill.id",
  "total desc, bill.id"
)
add(
  "Across 119th-Congress bills, count structured amendment IDs as total and amendment-classified document IDs as matching. Keep these separate and deduplicate across joins.",
  "counts.total, records.matching",
  "(select count(*)::float8 as total from legislation.amendments amendment join legislation.bills bill on bill.id = amendment.bill_id where bill.session_id = 'session:us:119') counts cross join (select count(*)::float8 as matching from legislation.bill_documents document join legislation.bills bill on bill.id = document.bill_id where bill.session_id = 'session:us:119' and document.classification = 'amendment') records"
)

add(
  "Count bills in the 119th Congress by recorded status, ordered by count descending, retaining unknown status separately.",
  `bill.status, ${distinctBills}`,
  "legislation.bills bill",
  currentBills,
  "bill.status",
  "total desc, bill.status asc nulls last"
)
add(
  "Count 119th-Congress bills introduced in calendar year 2025 by chamber, ordered by count descending.",
  `bill.chamber, ${distinctBills}`,
  "legislation.bills bill",
  `${currentBills} and bill.introduced_at between '2025-01-01' and '2025-12-31'`,
  "bill.chamber",
  "total desc, bill.chamber asc nulls last"
)
add(
  "How many 119th-Congress records have the exact bill classification 'resolution'? Match an array member, not a title substring.",
  distinctBills,
  "legislation.bills bill",
  `${currentBills} and bill.classification @> array['resolution']::text[]`
)
add(
  "How many 119th-Congress bills have the exact recorded subject 'Health'? Do not infer subject membership from text.",
  distinctBills,
  "legislation.bills bill",
  `${currentBills} and bill.subjects @> array['Health']::text[]`
)
add(
  "List the first 10 bills in the 119th Congress whose titles contain 'education', case-insensitively, by bill ID. Include ID, identifier and title.",
  "bill.id, bill.identifier, bill.title",
  "legislation.bills bill",
  `${currentBills} and bill.title ilike '%education%'`,
  "",
  "bill.id"
)
add(
  "Which 10 bills in the 119th Congress have the most recorded action identities? Include bill ID, title and count; only include bills with actions.",
  "bill.id, bill.title, count(distinct action.id)::float8 as total",
  "legislation.bills bill join legislation.bill_actions action on action.bill_id = bill.id",
  currentBills,
  "bill.id",
  "total desc, bill.id"
)
add(
  "How many distinct 119th-Congress bills have at least one recorded action classified exactly 'passage'?",
  distinctBills,
  "legislation.bills bill join legislation.bill_actions action on action.bill_id = bill.id",
  `${currentBills} and action.classification @> array['passage']::text[]`
)
add(
  "How many distinct 119th-Congress bills have at least one recorded action classified exactly 'executive-signature'?",
  distinctBills,
  "legislation.bills bill join legislation.bill_actions action on action.bill_id = bill.id",
  `${currentBills} and action.classification @> array['executive-signature']::text[]`
)
add(
  "Which 10 bills in the 119th Congress have the most amendment-classified document records? Include bill ID, title and distinct document count; do not call these structured amendment counts.",
  "bill.id, bill.title, count(distinct document.id)::float8 as total",
  "legislation.bills bill left join legislation.bill_documents document on document.bill_id = bill.id and document.classification = 'amendment'",
  currentBills,
  "bill.id",
  "total desc, bill.id"
)
add(
  "How many distinct version-classified document records are attached to bills in the 119th Congress? Count stored document IDs, not logical versions across formats.",
  "count(distinct document.id)::float8 as total",
  "legislation.bill_documents document join legislation.bills bill on bill.id = document.bill_id",
  `${currentBills} and document.classification = 'version'`
)
add(
  "Count distinct document records attached to 119th-Congress bills by document classification, ordered by count descending.",
  "document.classification, count(distinct document.id)::float8 as total",
  "legislation.bill_documents document join legislation.bills bill on bill.id = document.bill_id",
  currentBills,
  "document.classification",
  "total desc, document.classification asc nulls last"
)
add(
  "What are the earliest and latest non-null recorded actionDate values on H.R. 1 of the 119th Congress? Do not substitute timestamps for missing actionDate.",
  "min(action.action_date) as earliest, max(action.action_date) as latest",
  "legislation.bill_actions action",
  "action.bill_id = 'bill:us:119:hr:1'"
)
add(
  "Which 10 bills in the 119th Congress link to the most distinct organizations through recorded bill-organization relationships? Include bill ID, title and organization count.",
  "bill.id, bill.title, count(distinct link.organization_id)::float8 as total",
  "legislation.bill_organizations link join legislation.bills bill on bill.id = link.bill_id",
  currentBills,
  "bill.id",
  "total desc, bill.id"
)
add(
  "Count distinct bill-relationship identities by classification where the source bill is in the 119th Congress. Order by count descending.",
  "link.classification, count(distinct (link.bill_id, link.related_bill_id, link.classification))::float8 as total",
  "legislation.bill_relations link join legislation.bills bill on bill.id = link.bill_id",
  currentBills,
  "link.classification",
  "total desc, link.classification"
)
add(
  "For the 10 most-amended 119th-Congress bills that have resolved sponsorships, include bill ID, title, distinct structured amendment count as total and distinct sponsor-person count as matching. Deduplicate both sides of the join.",
  "bill.id, bill.title, count(distinct amendment.id)::float8 as total, count(distinct sponsor.person_id)::float8 as matching",
  "legislation.bills bill join legislation.amendments amendment on amendment.bill_id = bill.id join legislation.bill_sponsors sponsor on sponsor.bill_id = bill.id",
  `${currentBills} and sponsor.person_id is not null`,
  "bill.id",
  "total desc, bill.id"
)

const memberships =
  "legislation.organization_memberships membership join legislation.organizations organization on organization.id = membership.organization_id join legislation.people person on person.id = membership.person_id"
const federalOrganizations = "organization.jurisdiction_id = 'jurisdiction:us'"
add(
  "Which 10 federal committees have the most distinct people with explicitly active membership records? Include organization ID, name and person count; use organization classification committee.",
  "organization.id, organization.name, count(distinct membership.person_id)::float8 as total",
  memberships,
  `${federalOrganizations} and organization.classification = 'committee' and membership.is_active = true`,
  "organization.id",
  "total desc, organization.id"
)
add(
  "Which 10 people have active memberships in the most distinct federal committees? Include person ID, name and committee count; count organizations classified committee.",
  `${peopleSelect}, count(distinct organization.id)::float8 as total`,
  memberships,
  `${federalOrganizations} and organization.classification = 'committee' and membership.is_active = true`,
  peopleGroup,
  "total desc, person.id"
)
add(
  "Count distinct membership tenure records explicitly linked to the 119th Congress by role, ordered by count descending.",
  "membership.role, count(distinct membership.id)::float8 as total",
  "legislation.organization_memberships membership",
  "membership.legislative_session_id = 'session:us:119'",
  "membership.role",
  "total desc, membership.role asc nulls last"
)
add(
  "Count distinct federal organizations by recorded classification, ordered by count descending and preserving unknown classification separately.",
  "organization.classification, count(distinct organization.id)::float8 as total",
  "legislation.organizations organization",
  federalOrganizations,
  "organization.classification",
  "total desc, organization.classification asc nulls last"
)
add(
  "Which 10 federal parent organizations have the most directly linked child organizations classified subcommittee? Include parent ID, parent name and distinct child count.",
  "parent.id, parent.name, count(distinct organization.id)::float8 as total",
  "legislation.organizations organization join legislation.organizations parent on parent.id = organization.parent_organization_id",
  `${federalOrganizations} and organization.classification = 'subcommittee'`,
  "parent.id",
  "total desc, parent.id"
)
add(
  "Count distinct people with explicitly active federal legislative terms by term chamber, ordered by count descending.",
  "term.chamber, count(distinct term.person_id)::float8 as total",
  "legislation.legislative_terms term",
  "term.jurisdiction_id = 'jurisdiction:us' and term.is_active = true",
  "term.chamber",
  "total desc, term.chamber asc nulls last"
)
add(
  "Count distinct people with explicitly active federal legislative terms grouped by term party then chamber. Return the top 10 groups by count, breaking ties by party then chamber.",
  "term.party, term.chamber, count(distinct term.person_id)::float8 as total",
  "legislation.legislative_terms term",
  "term.jurisdiction_id = 'jurisdiction:us' and term.is_active = true",
  "term.party, term.chamber",
  "total desc, term.party asc nulls last, term.chamber asc nulls last"
)
add(
  "Which 10 resolved people have the earliest recorded federal legislative-term startYear? Include person ID, name and earliest year, ignoring null years; order by earliest year ascending.",
  `${peopleSelect}, min(term.start_year) as earliest`,
  "legislation.legislative_terms term join legislation.people person on person.id = term.person_id",
  "term.jurisdiction_id = 'jurisdiction:us' and term.start_year is not null",
  peopleGroup,
  "earliest, person.id"
)
add(
  "Count distinct federal legislative-term records by term party then chamber, including historical terms. Return the top 10 groups by count, with ties by party then chamber.",
  "term.party, term.chamber, count(distinct term.id)::float8 as total",
  "legislation.legislative_terms term",
  "term.jurisdiction_id = 'jurisdiction:us'",
  "term.party, term.chamber",
  "total desc, term.party asc nulls last, term.chamber asc nulls last"
)
add(
  "Count distinct explicitly inactive federal organization membership tenures by endedReason. Preserve unknown reasons separately and order by count descending.",
  'membership.ended_reason as "endedReason", count(distinct membership.id)::float8 as total',
  memberships,
  `${federalOrganizations} and membership.is_active = false`,
  "membership.ended_reason",
  "total desc, membership.ended_reason asc nulls last"
)

const meetings = "legislation.legislative_events meeting"
const retainedMeetings = "meeting.is_deleted = false"
const alaskaMeetings = `${retainedMeetings} and meeting.jurisdiction_id = 'jurisdiction:ak'`
const federalMeetings = `${retainedMeetings} and meeting.jurisdiction_id = 'jurisdiction:us'`
add(
  "Which 10 jurisdictions have the most non-deleted recorded meetings? Include jurisdictionId and distinct meeting count.",
  'meeting.jurisdiction_id as "jurisdictionId", count(distinct meeting.id)::float8 as total',
  meetings,
  retainedMeetings,
  "meeting.jurisdiction_id",
  "total desc, meeting.jurisdiction_id"
)
add(
  "Count non-deleted Alaska meeting records by status, ordered by count descending.",
  "meeting.status, count(distinct meeting.id)::float8 as total",
  meetings,
  alaskaMeetings,
  "meeting.status",
  "total desc, meeting.status"
)
add(
  "What are the earliest and latest non-null publisherLocalDate values for non-deleted Alaska meetings? Do not derive dates from timestamps.",
  "min(meeting.publisher_local_date) as earliest, max(meeting.publisher_local_date) as latest",
  meetings,
  alaskaMeetings
)
add(
  "Which 10 non-deleted federal meetings have the most recorded participant identities? Include meeting ID, name and distinct participant-record count, not distinct people.",
  "meeting.id, meeting.name, count(distinct participant.id)::float8 as total",
  `${meetings} join legislation.event_participants participant on participant.event_id = meeting.id`,
  federalMeetings,
  "meeting.id",
  "total desc, meeting.id"
)
add(
  "How many distinct non-deleted meetings have an explicit meeting-bill link to a bill in the 119th Congress? Scope by the linked bill's session, not the meeting date.",
  "count(distinct meeting.id)::float8 as total",
  `${meetings} join legislation.event_bills link on link.event_id = meeting.id join legislation.bills bill on bill.id = link.bill_id`,
  `${retainedMeetings} and ${currentBills}`
)
add(
  "Which 10 bills in the 119th Congress link explicitly to the most distinct non-deleted meetings? Include bill ID, title and meeting count.",
  "bill.id, bill.title, count(distinct meeting.id)::float8 as total",
  `${meetings} join legislation.event_bills link on link.event_id = meeting.id join legislation.bills bill on bill.id = link.bill_id`,
  `${retainedMeetings} and ${currentBills}`,
  "bill.id",
  "total desc, bill.id"
)
add(
  "Which 10 non-deleted Alaska meetings have the most meeting-document records? Include meeting ID, name and distinct document count.",
  "meeting.id, meeting.name, count(distinct document.id)::float8 as total",
  `${meetings} left join legislation.event_documents document on document.event_id = meeting.id`,
  alaskaMeetings,
  "meeting.id",
  "total desc, meeting.id"
)
add(
  "Count agenda-item records for non-deleted Alaska meetings by agenda classification, ordered by count descending, preserving unknown classifications separately.",
  "agenda.classification, count(distinct agenda.id)::float8 as total",
  `${meetings} join legislation.event_agenda_items agenda on agenda.event_id = meeting.id`,
  alaskaMeetings,
  "agenda.classification",
  "total desc, agenda.classification asc nulls last"
)
add(
  "Count participant records for non-deleted federal meetings by role, ordered by count descending. Count participant identities rather than resolved people.",
  "participant.role, count(distinct participant.id)::float8 as total",
  `${meetings} join legislation.event_participants participant on participant.event_id = meeting.id`,
  federalMeetings,
  "participant.role",
  "total desc, participant.role asc nulls last"
)
add(
  "Count distinct non-deleted meetings explicitly linked to the 119th Congress by meeting classification, ordered by count descending. Use session relationship records, not inferred dates.",
  "meeting.classification, count(distinct meeting.id)::float8 as total",
  `${meetings} join legislation.event_sessions link on link.event_id = meeting.id`,
  `${retainedMeetings} and link.session_id = 'session:us:119'`,
  "meeting.classification",
  "total desc, meeting.classification asc nulls last"
)

add(
  "Count distinct federal supporting-material publications by classification, ordered by count descending.",
  "material.classification, count(distinct material.id)::float8 as total",
  "legislation.supporting_materials material",
  "material.jurisdiction_id = 'jurisdiction:us'",
  "material.classification",
  "total desc, material.classification"
)
add(
  "How many distinct supporting-material publications have a direct material-bill link to a bill in the 119th Congress?",
  "count(distinct link.material_id)::float8 as total",
  "legislation.supporting_material_links link join legislation.bills bill on bill.id = link.bill_id",
  currentBills
)
add(
  "Which 10 bills in the 119th Congress have the most directly linked distinct supporting-material publications? Include bill ID, title and publication count.",
  "bill.id, bill.title, count(distinct link.material_id)::float8 as total",
  "legislation.supporting_material_links link join legislation.bills bill on bill.id = link.bill_id",
  currentBills,
  "bill.id",
  "total desc, bill.id"
)
add(
  "How many distinct supporting-material publications have direct links to structured amendments in the 119th Congress? Scope by amendment session.",
  "count(distinct link.material_id)::float8 as total",
  "legislation.supporting_material_links link join legislation.amendments amendment on amendment.id = link.amendment_id",
  currentAmendments
)
add(
  "Count document records attached to non-deleted federal meetings by contentType, ordered by count descending, preserving unknown content types separately.",
  'document.content_type as "contentType", count(distinct document.id)::float8 as total',
  `${meetings} join legislation.event_documents document on document.event_id = meeting.id`,
  federalMeetings,
  "document.content_type",
  "total desc, document.content_type asc nulls last"
)
add(
  "Which 10 jurisdictions have the most recorded legislative sessions? Include jurisdictionId and distinct session count.",
  'session.jurisdiction_id as "jurisdictionId", count(distinct session.id)::float8 as total',
  "legislation.legislative_sessions session",
  "",
  "session.jurisdiction_id",
  "total desc, session.jurisdiction_id"
)
add(
  "Which 10 federal sessions have the most recorded bills? Include sessionId and distinct bill count.",
  `bill.session_id as "sessionId", ${distinctBills}`,
  "legislation.bills bill",
  "bill.jurisdiction_id = 'jurisdiction:us'",
  "bill.session_id",
  "total desc, bill.session_id"
)
add(
  "Which jurisdictions have at least 100000 recorded bills? Include jurisdictionId and distinct bill count; return the top 10 by count.",
  `bill.jurisdiction_id as "jurisdictionId", ${distinctBills}`,
  "legislation.bills bill",
  "",
  "bill.jurisdiction_id having count(distinct bill.id) >= 100000",
  "total desc, bill.jurisdiction_id"
)
add(
  "List the first 10 distinct companion bill pairs whose source bill is in the 119th Congress. Include billId and relatedBillId, ordered by those IDs. Use explicit companion relationships only.",
  'distinct link.bill_id as "billId", link.related_bill_id as "relatedBillId"',
  "legislation.bill_relations link join legislation.bills bill on bill.id = link.bill_id",
  `${currentBills} and link.classification = 'companion'`,
  "",
  "link.bill_id, link.related_bill_id"
)
add(
  "Which 10 jurisdictions have the most people explicitly marked active in the people table? Include jurisdictionId and distinct person count, excluding unresolved jurisdictions.",
  'person.jurisdiction_id as "jurisdictionId", count(distinct person.id)::float8 as total',
  "legislation.people person",
  "person.is_active = true and person.jurisdiction_id is not null",
  "person.jurisdiction_id",
  "total desc, person.jurisdiction_id"
)

if (cases.length !== 100 || new Set(cases.map((item) => item.question)).size !== 100) {
  throw new Error("Analytics acceptance requires exactly 100 unique questions")
}
function expectMetrics(numbers: number[], ...metrics: string[]) {
  for (const number of numbers) {
    const item = cases[number - 1]
    if (!item) {
      throw new Error("Missing analytics case")
    }
    item.expectedMetrics = metrics
  }
}

expectMetrics(
  [2, 3, 4, 5, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19, 47, 56, 57, 58, 59, 62, 63, 97, 98],
  "countDistinct:bills.id"
)
expectMetrics([6, 7, 20, 71, 76, 77, 100], "countDistinct:people.id")
expectMetrics([11], "min:bills.introducedAt", "max:bills.introducedAt")
expectMetrics([22, 24, 25, 27, 28, 30, 35, 37, 38, 40], "countDistinct:votes.id")
expectMetrics([23, 39], "countDistinct:votes.id", "countDistinct:votes.id")
expectMetrics([21, 26, 31, 36], "countDistinct:positions._key")
expectMetrics([41, 42, 43, 44, 45, 49, 50, 53, 54], "countDistinct:amendments.id")
expectMetrics([48], "min:amendments.submittedDate", "max:amendments.submittedDate")
expectMetrics([51, 52], "countDistinct:amendmentActions.id")
expectMetrics([55], "countDistinct:amendments.id", "countDistinct:documents.id")
expectMetrics([61], "countDistinct:actions.id")
expectMetrics([64, 65, 66], "countDistinct:documents.id")
expectMetrics([67], "min:actions.actionDate", "max:actions.actionDate")
expectMetrics([68, 72, 74, 75], "countDistinct:organizations.id")
expectMetrics([69], "countDistinct:relatedBills._key")
expectMetrics([70], "countDistinct:amendments.id", "countDistinct:people.id")
expectMetrics([73, 80], "countDistinct:memberships.id")
expectMetrics([78], "min:terms.startYear")
expectMetrics([79], "countDistinct:terms.id")
expectMetrics([81, 82, 85, 86, 90], "countDistinct:meetings.id")
expectMetrics([83], "min:meetings.publisherLocalDate", "max:meetings.publisherLocalDate")
expectMetrics([84, 89], "countDistinct:participants.id")
expectMetrics([87, 95], "countDistinct:meetingDocuments.id")
expectMetrics([88], "countDistinct:agenda.id")
expectMetrics([91, 92, 93, 94], "countDistinct:materials.id")
expectMetrics([96], "countDistinct:sessions.id")

const absenceCase = cases[22]
const intersectionCase = cases[53]
if (!absenceCase || !intersectionCase) {
  throw new Error("Missing semantic analytics cases")
}
absenceCase.metricBindings = [
  { name: "total", grain: "countDistinct:votes.id", filters: [] },
  {
    name: "matching",
    grain: "countDistinct:votes.id",
    filters: [{ field: "positions.option", op: "eq", values: ["absent"] }]
  }
]
intersectionCase.helperMetrics = [
  {
    grain: "countDistinct:documents.id",
    filters: [{ field: "documents.classification", op: "eq", values: ["amendment"] }]
  }
]

export const analyticsCases: readonly AnalyticsCase[] = cases

function requireScope(numbers: number[], scope: string) {
  for (const number of numbers) {
    const item = cases[number - 1]
    if (!item) {
      throw new Error("Missing scope case")
    }
    item.requiredScope = scope
  }
}

requireScope(
  [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 40, 45, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
    64, 65, 66, 68, 69, 70, 85, 86, 92, 93, 99
  ],
  "bills.sessionId"
)
requireScope([21, 22, 23, 24, 25, 26, 27, 28, 32, 33, 34, 35, 36, 37, 38, 39], "votes.sessionId")
requireScope([41, 42, 43, 44, 47, 48, 49, 50, 51, 52, 53, 94], "amendments.sessionId")
requireScope([71, 72, 74, 75, 80], "organizations.jurisdictionId")
requireScope([73], "memberships.legislativeSessionId")
requireScope([76, 77, 78, 79], "terms.jurisdictionId")
requireScope([82, 83, 84, 87, 88, 89, 95], "meetings.jurisdictionId")
requireScope([90], "meetingSessions.sessionId")
requireScope([91], "materials.jurisdictionId")
requireScope([97], "bills.jurisdictionId")
