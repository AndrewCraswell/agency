# LegiScan reference SQL schema

LegiScan distributes MySQL and PostgreSQL reference schemas with its API client. This is an implementation model, not the
wire contract: names are normalized, arrays become child tables, documents are stored on disk, operational timestamps are
added, and reference data is pre-seeded. Use [wire schema](wire-schema.md) for integration contracts.

Baseline: official client archive 1.4.1, PostgreSQL `schema-pgsql.sql`, schema variable `9`, application version seed
`1.4.0`. The 1.4.1 changelog says it fixes bill reconstruction without changing the schema version.

## Conventions

- `smallint`, `integer`, `bigint`, `decimal`, `date`, `time`, and `timestamp` are PostgreSQL types.
- `varchar(n)`, `char(n)`, and `text` retain the official widths/types. These widths are reference-client choices, not
  guaranteed upstream maxima.
- `created`/`updated`, `local_copy`, `local_fragment`, `import_date`, `import_hash`, signal state, monitor state, and ignore
  state are client-maintained rather than API payload fields.
- The reference schema uses `smallint` for some LegiScan IDs, including `people_id`, `session_id`, and `committee_id`.
  Reassess widths in a new implementation rather than copying them blindly.

## Bill and child tables

### `ls_bill`

Primary bill snapshot.

| Column | Type | Source |
| --- | --- | --- |
| `bill_id` | integer | `bill.bill_id` |
| `state_id` | smallint | `bill.state_id` |
| `session_id` | smallint | `bill.session_id` |
| `body_id` | smallint | `bill.body_id` |
| `current_body_id` | smallint | `bill.current_body_id` |
| `bill_type_id` | smallint | `bill.bill_type_id` |
| `bill_number` | varchar(10) | `bill.bill_number` |
| `status_id` | smallint | `bill.status` |
| `status_date` | date nullable | `bill.status_date` |
| `title` | text | `bill.title` |
| `description` | text | `bill.description` |
| `pending_committee_id` | smallint | `bill.pending_committee_id` |
| `legiscan_url` | varchar(255) | `bill.url` |
| `state_url` | varchar(255) | `bill.state_link` |
| `change_hash` | char(32) | `bill.change_hash` |
| `updated` | timestamp | Client-maintained |
| `created` | timestamp | Client-maintained |

### Ordered and many-to-many bill children

| Table | Columns with types | Wire source |
| --- | --- | --- |
| `ls_bill_history` | `bill_id integer`, `history_step smallint`, `history_major smallint`, `history_body_id smallint`, `history_date date?`, `history_action text` | `bill.history[]` plus array order |
| `ls_bill_progress` | `bill_id integer`, `progress_step smallint`, `progress_date date?`, `progress_event_id smallint` | `bill.progress[]` plus array order |
| `ls_bill_reason` | `bill_id integer`, `reason_id smallint`, `created timestamp` | Push `bill.reasons`, plus receipt time |
| `ls_bill_referral` | `bill_id integer`, `referral_step smallint`, `referral_date date?`, `committee_id smallint` | `bill.referrals[]` plus array order |
| `ls_bill_sast` | `bill_id integer`, `sast_type_id smallint`, `sast_bill_id integer`, `sast_bill_number varchar(10)?` | `bill.sasts[]` |
| `ls_bill_sponsor` | `bill_id integer`, `people_id smallint`, `sponsor_order smallint`, `sponsor_type_id smallint` | `bill.sponsors[]` |
| `ls_bill_subject` | `bill_id integer`, `subject_id integer` | `bill.subjects[]` |

### `ls_bill_calendar`

| Column | Type | Source |
| --- | --- | --- |
| `bill_id` | integer | Parent bill |
| `event_hash` | char(8) | Client-derived event identity/hash |
| `event_type_id` | smallint | `calendar[].type_id` |
| `event_date` | date nullable | `calendar[].date` |
| `event_time` | time nullable | `calendar[].time` |
| `event_location` | varchar(64) | `calendar[].location` |
| `event_desc` | varchar(128) | `calendar[].description` |
| `updated` | timestamp | Client-maintained |
| `created` | timestamp nullable | Client-maintained |

### Document metadata

| Table | Columns with types |
| --- | --- |
| `ls_bill_text` | `text_id integer`, `bill_id integer`, `bill_text_type_id smallint`, `bill_text_mime_id smallint`, `bill_text_date date?`, `bill_text_size integer`, `bill_text_hash char(32)?`, `local_copy smallint`, `local_fragment varchar(255)?`, `legiscan_url varchar(255)`, `state_url varchar(255)`, `updated timestamp`, `created timestamp` |
| `ls_bill_amendment` | `amendment_id integer`, `bill_id integer`, `adopted smallint`, `amendment_body_id smallint`, `amendment_mime_id smallint`, `amendment_date date?`, `amendment_title varchar(255)`, `amendment_desc text`, `amendment_size integer`, `amendment_hash char(32)?`, `local_copy smallint`, `local_fragment varchar(255)?`, `legiscan_url varchar(255)`, `state_url varchar(255)`, `updated timestamp`, `created timestamp` |
| `ls_bill_supplement` | `supplement_id integer`, `bill_id integer`, `supplement_type_id smallint`, `supplement_mime_id smallint`, `supplement_date date?`, `supplement_title varchar(255)`, `supplement_desc text`, `supplement_size integer`, `supplement_hash char(32)?`, `local_copy smallint`, `local_fragment varchar(255)?`, `legiscan_url varchar(255)`, `state_url varchar(255)`, `updated timestamp`, `created timestamp` |

`local_copy` and `local_fragment` point to decoded files managed by the client; base64 `doc` content is not stored in a
database column.

### Roll calls

| Table | Columns with types | Wire source |
| --- | --- | --- |
| `ls_bill_vote` | `roll_call_id integer`, `bill_id integer`, `roll_call_body_id smallint`, `roll_call_date date?`, `roll_call_desc varchar(255)`, `yea smallint`, `nay smallint`, `nv smallint`, `absent smallint`, `total smallint`, `passed smallint`, `legiscan_url varchar(255)`, `state_url varchar(255)`, `updated timestamp`, `created timestamp` | Bill vote index plus `roll_call` summary |
| `ls_bill_vote_detail` | `roll_call_id integer`, `people_id smallint`, `vote_id smallint` | `roll_call.votes[]` |

The standalone `roll_call` payload does not document URL fields; the client retains URLs from the bill's vote index.

## Entity tables

### `ls_people`

| Column | Type | Wire source |
| --- | --- | --- |
| `people_id` | smallint | `person.people_id` |
| `state_id` | smallint | `person.state_id` |
| `role_id` | smallint | `person.role_id` |
| `party_id` | smallint | `person.party_id` |
| `name` | varchar(128) | `person.name` |
| `first_name` | varchar(32) | `person.first_name` |
| `middle_name` | varchar(32) | `person.middle_name` |
| `last_name` | varchar(32) | `person.last_name` |
| `suffix` | varchar(32) | `person.suffix` |
| `nickname` | varchar(32) | Example/client `person.nickname` |
| `district` | varchar(9) nullable | `person.district` |
| `committee_sponsor_id` | smallint | `committee_id` when committee-sponsored, otherwise zero |
| `ballotpedia` | varchar(64) nullable | `person.ballotpedia` |
| `followthemoney_eid` | bigint | `person.ftm_eid` |
| `votesmart_id` | integer | `person.votesmart_id` |
| `knowwho_pid` | integer | `person.knowwho_pid` |
| `opensecrets_id` | char(9) nullable | `person.opensecrets_id` |
| `person_hash` | char(8) | `person.person_hash` |
| `updated` | timestamp | Client-maintained |
| `created` | timestamp | Client-maintained |

### Sessions, jurisdictions, bodies, committees, and subjects

| Table | Columns with types | Notes |
| --- | --- | --- |
| `ls_session` | `session_id smallint`, `state_id smallint`, `year_start smallint`, `year_end smallint`, `prefile smallint`, `sine_die smallint`, `prior smallint`, `special smallint`, `session_name varchar(64)`, `session_title varchar(64)`, `session_tag varchar(32)`, `import_date date?`, `import_hash char(32)?` | Last two fields track Bulk import; `session_tag` is example/client-only. |
| `ls_state` | `state_id smallint`, `state_abbr char(2)`, `state_name varchar(64)`, `biennium smallint`, `carry_over char(2)?`, `capitol varchar(16)`, `latitude decimal(9,6)?`, `longitude decimal(9,6)?` | Seeded client reference data, not a Pull payload. Includes 50 states, DC, and US Congress. |
| `ls_body` | `body_id smallint`, `state_id smallint`, `role_id smallint`, `body_abbr char(1)`, `body_short varchar(16)?`, `body_name varchar(128)`, `body_role_abbr varchar(3)?`, `body_role_name varchar(15)?` | Seeded client reference data. |
| `ls_committee` | `committee_id smallint`, `committee_body_id smallint`, `committee_name varchar(128)` | Learned from bill committee/referral data. |
| `ls_subject` | `subject_id integer`, `state_id smallint`, `subject_name varchar(128)` | Learned from bill subjects. |

`ls_state.carry_over` uses client codes such as `NO`, `OE`, and `EO`; these are not documented API enums.

## Lookup tables

| Table | Columns with types | Published values |
| --- | --- | --- |
| `ls_event_type` | `event_type_id smallint`, `event_type_desc varchar(32)` | [Event types](reference-values.md#event-types) |
| `ls_mime_type` | `mime_id smallint`, `mime_type varchar(80)`, `mime_ext varchar(4)`, `is_binary smallint` | [MIME types](reference-values.md#mime-types), including client additions |
| `ls_party` | `party_id smallint`, `party_abbr char(1)`, `party_short char(3)`, `party_name varchar(32)` | [Political parties](reference-values.md#political-parties) |
| `ls_progress` | `progress_event_id smallint`, `progress_desc varchar(24)` | [Status and progress](reference-values.md#status-and-progress) |
| `ls_reason` | `reason_id smallint`, `reason_desc varchar(32)` | [Push reasons](push.md#bill-push-reasons), including client-only values |
| `ls_role` | `role_id smallint`, `role_name varchar(64)`, `role_abbr char(3)` | [Roles](reference-values.md#roles) |
| `ls_sast_type` | `sast_id smallint`, `sast_description varchar(32)` | [SAST types](reference-values.md#sast-relationship-types) |
| `ls_sponsor_type` | `sponsor_type_id smallint`, `sponsor_type_desc varchar(24)` | [Sponsor types](reference-values.md#sponsor-types) |
| `ls_stance` | `stance smallint`, `stance_desc varchar(24)` | [GAITS stance](reference-values.md#gaits-stance) |
| `ls_supplement_type` | `supplement_type_id smallint`, `supplement_type_desc varchar(64)` | [Supplement types](reference-values.md#supplement-types) |
| `ls_text_type` | `bill_text_type_id smallint`, `bill_text_name varchar(64)`, `bill_text_sort smallint`, `bill_text_supplement smallint` | [Text types](reference-values.md#text-types); sort/supplement are client metadata |
| `ls_type` | `bill_type_id smallint`, `bill_type_name varchar(64)`, `bill_type_abbr varchar(4)` | [Bill types](reference-values.md#bill-types) |
| `ls_vote` | `vote_id smallint`, `vote_desc varchar(24)` | [Vote types](reference-values.md#vote-types) |

## Client operational tables

These tables are not LegiScan legislative payload data but are part of the distributed schema.

| Table | Columns with types | Purpose |
| --- | --- | --- |
| `ls_ignore` | `bill_id integer`, `created timestamp` | Locally ignored bills. |
| `ls_monitor` | `bill_id integer`, `stance smallint`, `created timestamp` | Local/GAITS monitor selection. |
| `ls_signal` | `object_type varchar(10)`, `object_id integer`, `processed smallint`, `updated timestamp`, `created timestamp` | Middleware change notifications. |
| `ls_variable` | `name varchar(64)`, `value text` | Client schema/application version values. |

## Derived views

The official schema supplies these denormalized views. They expose joined labels and parent-bill context from the tables
above; they do not add upstream data fields.

| View | Purpose |
| --- | --- |
| `lsv_bill` | Bill with state, status, type, body, current body, and pending committee labels. |
| `lsv_bill_amendment` | Amendment with MIME, state, and parent bill context. |
| `lsv_bill_calendar` | Event with type, pending committee, state, and bill context. |
| `lsv_bill_history` | History action with acting body, state, and bill context. |
| `lsv_bill_reason` | Push reason with reason label, change time, state, and bill context. |
| `lsv_bill_referral` | Referral and pending committee labels with bill context. |
| `lsv_bill_sast` | Related-bill edge with source and target bill context. |
| `lsv_bill_sponsor` | Sponsor link with person, party, role, and bill context. |
| `lsv_bill_subject` | Subject link with state and bill context. |
| `lsv_bill_supplement` | Supplement with type/MIME and bill context. |
| `lsv_bill_text` | Text version with type/MIME and bill context. |
| `lsv_bill_vote` | Roll-call summary with body and bill context. |
| `lsv_bill_vote_detail` | Individual vote with person, party, role, roll call, and bill context. |

## What the reference schema does not preserve

- Raw JSON payloads and unknown fields.
- Push delivery IDs, HTTP metadata, retry count, or original acknowledgement.
- Historical versions of bill/person snapshots beyond ordered actions and reason timestamps.
- The raw `last_push` value.
- Calendar timezone or source event identity; `event_hash` is client-derived.
- Base64 document bodies inside the database.
- Search results, search queries, dataset access keys, or `setMonitor` per-item response strings.

Our canonical model should not treat this sample SQL as complete event sourcing or schema-drift protection.
