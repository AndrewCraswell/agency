# LegiScan wire schema

This page is the canonical field-level inventory for primary LegiScan data objects. Paths are relative to the named
response root. “Optional” includes fields that are conditionally present, empty, or documented only by official examples.

## Bill

Root: `bill` from `getBill` and the Push `bill` payload.

### Bill core

| Path | Type | Meaning and constraints |
| --- | --- | --- |
| `bill_id` | integer | Global internal bill ID. |
| `change_hash` | string | MD5 fingerprint of bill status metadata for change detection. |
| `last_push` | datetime | Push only. Timestamp of the last successful delivery. |
| `reasons` | object/map | Push only. Change reasons keyed by reason ID; see [Push reasons](push.md#bill-push-reasons). |
| `session_id` | integer | Internal session ID. |
| `session` | object | Embedded session summary. |
| `session.session_id` | integer | Internal session ID. |
| `session.state_id` | integer | Example-only internal jurisdiction ID. |
| `session.year_start` | integer | Starting year. |
| `session.year_end` | integer | Ending year. |
| `session.prefile` | integer | `0`/`1`; session is accepting prefiled bills. |
| `session.sine_die` | integer | `0`/`1`; session adjourned sine die. |
| `session.prior` | integer | `0`/`1`; session archived from production updates. |
| `session.special` | integer | `0`/`1`; special session. |
| `session.session_tag` | string | Example-only short normalized label such as `Regular Session`. |
| `session.session_name` | string | State-specific session name. |
| `session.session_title` | string | Normalized title including year(s) and regular/special designation. |
| `url` | string | LegiScan bill URL. |
| `state_link` | string | Source legislature bill URL. |
| `completed` | integer | **Deprecated. Do not use.** |
| `status` | integer | Current overall status code, normally 0-6. |
| `status_date` | date | Date of the current status action. |
| `state` | string | Two-character jurisdiction abbreviation, including `US` or `DC`. |
| `state_id` | integer | Internal jurisdiction ID. |
| `bill_number` | string | Jurisdiction-assigned bill/instrument number. |
| `bill_type` | string | Bill/instrument type abbreviation. |
| `bill_type_id` | integer or numeric string | Bill type enum ID. |
| `body` | string | Originating body abbreviation/text. |
| `body_id` | integer | Originating internal body ID. |
| `current_body` | string | Current body abbreviation/text. |
| `current_body_id` | integer | Current internal body ID. |
| `title` | string | Short title. |
| `description` | string | Long description or digest. |
| `pending_committee_id` | integer | Current pending committee ID; commonly zero when none. |

### Progress

`progress[]` is an ordered reduction of the action history to significant status events.

| Path | Type | Meaning |
| --- | --- | --- |
| `progress[].date` | date | Event date. |
| `progress[].event` | integer | Status/progress event code corresponding to a history action. |

### Current committee and referrals

| Path | Type | Meaning |
| --- | --- | --- |
| `committee` | object | Current pending committee; conditional. |
| `committee.committee_id` | integer | Internal committee ID. |
| `committee.chamber` | string | Committee chamber abbreviation. |
| `committee.chamber_id` | integer | Internal body ID. |
| `committee.name` | string | Official examples use this field for the committee name. |
| `committee.committee_name` | string | Data-dictionary spelling for the same value. |
| `referrals[]` | array | Ordered history of committee referrals. |
| `referrals[].date` | date | Referral date. |
| `referrals[].committee_id` | integer | Internal committee ID. |
| `referrals[].chamber` | string | Committee chamber abbreviation. |
| `referrals[].chamber_id` | integer | Internal body ID. |
| `referrals[].name` | string | Official examples use this field for the committee name. |
| `referrals[].committee_name` | string | Data-dictionary spelling for the same value. |

Consumers should accept both `name` and `committee_name`; the v1.91 example and dictionary disagree.

### History

| Path | Type | Meaning |
| --- | --- | --- |
| `history[]` | array | Ordered legislative action history. |
| `history[].date` | date | Action date. |
| `history[].action` | string | Jurisdiction-provided action text. |
| `history[].chamber` | string | Acting chamber abbreviation. |
| `history[].chamber_id` | integer | Internal body ID. |
| `history[].importance` | boolean or `0`/`1` | Major-action flag; true when the action matches a progress condition. |

### Sponsors

| Path | Type | Meaning |
| --- | --- | --- |
| `sponsors[]` | array | Ordered sponsors. |
| `sponsors[].people_id` | integer | Internal person ID. |
| `sponsors[].person_hash` | string | Person record change fingerprint. |
| `sponsors[].party_id` | integer or numeric string | Political party ID. |
| `sponsors[].party` | string | Party abbreviation. |
| `sponsors[].role_id` | integer | Legislative role ID. |
| `sponsors[].role` | string | Role abbreviation, for example `Rep` or `Sen`. |
| `sponsors[].name` | string | Full display name. |
| `sponsors[].first_name` | string | First name. |
| `sponsors[].middle_name` | string | Middle name/initial; often empty. |
| `sponsors[].last_name` | string | Last name. |
| `sponsors[].suffix` | string | Name suffix; often empty. |
| `sponsors[].nickname` | string | Example/client field omitted from the dictionary; often empty. |
| `sponsors[].district` | string | Legislative district, commonly prefixed `HD-` or `SD-`. |
| `sponsors[].ftm_eid` | integer or numeric string | FollowTheMoney entity ID. |
| `sponsors[].votesmart_id` | integer | Vote Smart ID. |
| `sponsors[].opensecrets_id` | string | OpenSecrets ID, Congress only. |
| `sponsors[].knowwho_pid` | integer | KnowWho person ID. |
| `sponsors[].ballotpedia` | string | Ballotpedia page/name identifier. |
| `sponsors[].sponsor_type_id` | integer | Sponsor type ID. |
| `sponsors[].sponsor_order` | integer | One-based/ordered sponsorship position. |
| `sponsors[].committee_sponsor` | boolean or `0`/`1` | Committee-sponsor flag. |
| `sponsors[].committee_id` | integer or numeric string | Sponsor committee ID when committee-sponsored, otherwise zero. |

### Same-as/similar-to relationships

| Path | Type | Meaning |
| --- | --- | --- |
| `sasts[]` | array | Related bill edges. |
| `sasts[].type_id` | integer | SAST relationship ID. |
| `sasts[].type` | string | Relationship display text. |
| `sasts[].sast_bill_number` | string | Related bill number. |
| `sasts[].sast_bill_id` | integer | Related internal bill ID. |

### Subjects

| Path | Type | Meaning |
| --- | --- | --- |
| `subjects[]` | array | Jurisdiction-specific subjects. |
| `subjects[].subject_id` | integer | Internal subject ID. |
| `subjects[].subject_name` | string | Subject label. |

### Bill-text index

| Path | Type | Meaning |
| --- | --- | --- |
| `texts[]` | array | Available text versions. |
| `texts[].doc_id` | integer | Internal document ID for `getBillText`. |
| `texts[].date` | date | Version date, when available. |
| `texts[].type` | string | Text/draft type label. |
| `texts[].type_id` | integer | Text type ID. |
| `texts[].mime` | string | MIME type. |
| `texts[].mime_id` | integer | MIME type ID. |
| `texts[].url` | string | LegiScan text URL. |
| `texts[].state_link` | string | Source legislature document URL. |
| `texts[].text_size` | integer | Decoded document byte count. |
| `texts[].text_hash` | string | MD5 of decoded document. |

### Roll-call index

| Path | Type | Meaning |
| --- | --- | --- |
| `votes[]` | array | Roll-call summaries. |
| `votes[].roll_call_id` | integer | Internal roll-call ID for `getRollCall`. |
| `votes[].date` | date | Vote date, when available. |
| `votes[].desc` | string | Vote description. |
| `votes[].yea` | integer | Yea count. |
| `votes[].nay` | integer | Nay count. |
| `votes[].nv` | integer | Not voting/abstain count. |
| `votes[].absent` | integer | Absent/excused count. |
| `votes[].total` | integer | Total recorded membership/votes. |
| `votes[].passed` | boolean or `0`/`1` | Passed flag. |
| `votes[].chamber` | string | Vote chamber abbreviation. |
| `votes[].chamber_id` | integer | Internal body ID. |
| `votes[].url` | string | LegiScan roll-call URL. |
| `votes[].state_link` | string | Source legislature vote URL. |

### Amendment index

| Path | Type | Meaning |
| --- | --- | --- |
| `amendments[]` | array | Amendment metadata. |
| `amendments[].amendment_id` | integer | Internal amendment ID for `getAmendment`. |
| `amendments[].adopted` | boolean or `0`/`1` | Adoption flag. |
| `amendments[].chamber` | string | Origin chamber abbreviation. |
| `amendments[].chamber_id` | integer | Internal body ID. |
| `amendments[].date` | date | Amendment date, when available. |
| `amendments[].title` | string | Amendment title. |
| `amendments[].description` | string | Amendment description. |
| `amendments[].mime` | string | MIME type. |
| `amendments[].mime_id` | integer | MIME type ID. |
| `amendments[].url` | string | LegiScan amendment URL. |
| `amendments[].state_link` | string | Source legislature amendment URL. |
| `amendments[].amendment_size` | integer | Decoded document byte count. |
| `amendments[].amendment_hash` | string | MD5 of decoded document. |

### Supplement index

| Path | Type | Meaning |
| --- | --- | --- |
| `supplements[]` | array | Supporting-document metadata. |
| `supplements[].supplement_id` | integer | Internal supplement ID for `getSupplement`. |
| `supplements[].date` | date | Supplement date, when available. |
| `supplements[].type_id` | integer | Supplement type ID. |
| `supplements[].type` | string | Supplement type label. |
| `supplements[].title` | string | Supplement title. |
| `supplements[].description` | string | Supplement description. |
| `supplements[].mime` | string | MIME type. |
| `supplements[].mime_id` | integer | MIME type ID. |
| `supplements[].url` | string | LegiScan supplement URL. |
| `supplements[].state_link` | string | Source legislature supplement URL. |
| `supplements[].supplement_size` | integer | Decoded document byte count. |
| `supplements[].supplement_hash` | string | MD5 of decoded document. |

### Calendar

| Path | Type | Meaning |
| --- | --- | --- |
| `calendar[]` | array | Hearings and other scheduled legislative events. |
| `calendar[].type_id` | integer | Event type ID. |
| `calendar[].type` | string | Event type label. |
| `calendar[].date` | date | Event date. |
| `calendar[].time` | time string | Event time, when available. No timezone is documented. |
| `calendar[].location` | string | Event location, when available. |
| `calendar[].description` | string | Event description. |

## Roll call

Root: `roll_call` from `getRollCall` and Push `roll_call`.

| Path | Type | Meaning |
| --- | --- | --- |
| `roll_call_id` | integer | Internal roll-call ID. |
| `bill_id` | integer | Parent bill ID. |
| `date` | date/string | Vote date, when available. |
| `desc` | string | Vote description. |
| `yea` | integer | Yea count. |
| `nay` | integer | Nay count. |
| `nv` | integer | Not voting/abstain count. |
| `absent` | integer | Absent/excused count. |
| `total` | integer | Total count. |
| `passed` | boolean or `0`/`1` | Passed flag. |
| `chamber` | string | Origin chamber abbreviation. |
| `chamber_id` | integer | Internal body ID. |
| `votes[]` | array | Individual member votes. |
| `votes[].people_id` | integer | Internal person ID. |
| `votes[].vote_id` | integer | Vote enum ID. |
| `votes[].vote_text` | string | Vote label: Yea, Nay, NV, or Absent. |

The full roll-call payload does not document the `url` and `state_link` fields that appear in the bill's roll-call index.

## Text

Root: `text` from `getBillText` and Push `text`.

| Field | Type | Meaning |
| --- | --- | --- |
| `doc_id` | integer | Internal text document ID. |
| `bill_id` | integer | Parent bill ID. |
| `date` | date | Document date, when available. |
| `type` | string | Text/draft type label. |
| `type_id` | integer or numeric string | Text type ID. |
| `mime` | string | MIME type. |
| `mime_id` | integer | MIME type ID. |
| `text_size` | integer | Decoded byte count. |
| `text_hash` | string | MD5 of decoded content. |
| `doc` | base64 string | Encoded document body. |

## Amendment

Root: `amendment` from `getAmendment` and Push `amendment`.

| Field | Type | Meaning |
| --- | --- | --- |
| `amendment_id` | integer | Internal amendment ID. |
| `chamber` | string | Origin chamber abbreviation. |
| `chamber_id` | integer | Internal body ID. |
| `bill_id` | integer | Parent bill ID. |
| `adopted` | boolean or `0`/`1` | Adoption flag. |
| `date` | date | Amendment date, when available. |
| `title` | string | Amendment title. |
| `description` | string | Amendment description. |
| `mime` | string | MIME type. |
| `mime_id` | integer | MIME type ID. |
| `amendment_size` | integer | Decoded byte count. |
| `amendment_hash` | string | MD5 of decoded content. |
| `doc` | base64 string | Encoded amendment body. |

## Supplement

Root: `supplement` from `getSupplement` and Push `supplement`.

| Field | Type | Meaning |
| --- | --- | --- |
| `supplement_id` | integer | Internal supplement ID. |
| `bill_id` | integer | Parent bill ID. |
| `date` | date | Document date, when available. |
| `type` | string | Supplement type label. |
| `type_id` | integer | Supplement type ID. |
| `title` | string | Supplement title. |
| `description` | string | Supplement description. |
| `mime` | string | MIME type. |
| `mime_id` | integer | MIME type ID. |
| `supplement_size` | integer | Decoded byte count. |
| `supplement_hash` | string | MD5 of decoded content. |
| `doc` | base64 string | Encoded supplement body. |

## Person

Root: `person` from `getPerson` and Push `person`. The same base fields appear in bill sponsors,
`sessionpeople.people[]`, and `sponsoredbills.sponsor`.

| Field | Type | Meaning |
| --- | --- | --- |
| `people_id` | integer | Internal person ID. |
| `person_hash` | string | Person-detail change fingerprint. |
| `state_id` | integer | Internal jurisdiction ID. |
| `party_id` | integer or numeric string | Party ID. |
| `party` | string | Party abbreviation. |
| `role_id` | integer | Role ID. |
| `role` | string | Role abbreviation. |
| `name` | string | Full display name. |
| `first_name` | string | First name. |
| `middle_name` | string | Middle name/initial. |
| `last_name` | string | Last name. |
| `suffix` | string | Name suffix. |
| `nickname` | string | Example/client field omitted from the dictionary. |
| `district` | string | Legislative district. |
| `ftm_eid` | integer or numeric string | FollowTheMoney entity ID. |
| `votesmart_id` | integer | Vote Smart ID. |
| `opensecrets_id` | string | OpenSecrets ID, Congress only. |
| `knowwho_pid` | integer | KnowWho person ID. |
| `ballotpedia` | string | Ballotpedia page/name identifier. |
| `committee_sponsor` | integer or boolean | `0`/`1` committee-sponsor flag. |
| `committee_id` | integer | Internal committee ID when committee-sponsored, otherwise zero. |

This is a current identity record. It is not session-versioned and can reflect a later party, role, or district when used
in historical contexts.

## Session

Root: each `sessions[]` element from `getSessionList` and Push `session`.

| Field | Type | Meaning |
| --- | --- | --- |
| `session_id` | integer | Internal session ID. |
| `state_id` | integer | Internal jurisdiction ID. |
| `year_start` | integer | Starting year. |
| `year_end` | integer | Ending year. |
| `special` | integer | `0`/`1` special-session flag. |
| `prefile` | integer | `0`/`1` prefile flag. |
| `prior` | integer | `0`/`1` archived-session flag. |
| `sine_die` | integer | `0`/`1` sine-die flag. |
| `session_tag` | string | Example/client field: short normalized session label. |
| `session_name` | string | State-specific session name. |
| `session_title` | string | Normalized title including year(s) and regular/special designation. |
| `dataset_hash` | string | Example-only dataset version fingerprint. |

The `getSessionPeople` operation additionally shows `name`, a normalized display name, inside its operation-specific
session object.
