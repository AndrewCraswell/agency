# Bill progress from recorded actions

The bill-progress card uses the selected bill's bounded `progressActions` projection. The query includes each
action's classification, description, chamber, date and source URL.

Recorded classifications take precedence. When classification is empty, explicit descriptions beginning with
`Introduced in House`, `Introduced in the Senate` (including the equivalent House/Senate forms), or
`Referred to ... Committee` identify introduction or committee referral. Matching is case-insensitive.
Other descriptions leave the stages unknown; the projection does not infer passage from a referral.

Dates and source URLs come from the action, not a bill-level summary. Missing dates remain absent. A bounded,
truncated action history can establish recorded stages but does not establish a current stage. Actions and the
selected record must belong to the same canonical bill.

`compositionRecords.test.ts` covers classified and description-only actions, unknown descriptions,
classification precedence, missing dates, truncation and bill ownership. These fixtures validate projection behavior,
not source completeness or the accuracy of an upstream action description.
