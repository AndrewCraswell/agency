# Record collection continuation

`POST /api/records/collection` and the shared `read_record_collection` research/MCP tool use the same
`recordCollectionSchema`. Send `{ collection, recordId, limit?, cursor? }`; the HTTP response wraps
`{ collection, recordId, items, nextCursor?, truncated }` in a resource envelope. Non-section collections default
to 25 rows and accept limits from 1 to 100. Queries fetch one extra row to establish continuation.
Keep the collection, record ID, limit and other selectors unchanged when following a cursor.

## Supporting material links

Use `collection: "material-links"` with a canonical `material:` ID. Each item preserves the link's `materialId`,
`billId`, `amendmentId`, `eventId`, `organizationId`, `classification` and `createdAt`, plus joined `billIdentifier`,
`amendmentIdentifier`, `meetingName` and `organizationName`. `sourceUrl` identifies the supporting material's publisher
source. Missing joined labels remain null. Ordering is ascending bill ID, amendment ID, event ID, organization ID,
classification and creation time, with PostgreSQL's default nulls-last ordering.

`getSupportingMaterial` previews at most 25 links, reading only 26 to detect truncation. `linksTruncated` explicitly
marks an incomplete preview, and overall `truncated` includes both links and sections. The material's relationship-ID
arrays derive from this preview; HTTP detail and batch projections preserve `linksTruncated` beside those arrays.
MCP preserves that flag even when all sections fit. Read `material-links` from its first page for the complete links,
not by treating the preview as the first collection page.

The detail `cursor`/`nextCursor` remains exclusively a section cursor; truncated links alone never produce it.
`material-sections` has its own collection cursor and optional `sectionId`/`textOffset` selection. Those text selectors
are invalid for `material-links`, and a collection cursor cannot be reused for another collection, material or limit.

## Other collection names

Available collections are `bill-actions`, `bill-sponsors`, `bill-documents`, `person-terms`,
`organization-children`, `meeting-agenda`, `meeting-documents`, `meeting-participants`, `meeting-bills`,
`meeting-outcomes`, `vote-positions`, `amendment-actions`, `amendment-votes`, `amendment-materials`,
`document-sections` and `material-sections`, in addition to `material-links`.
Organization membership continuation uses `get_memberships` with `organizationId`; there is no
`organization-memberships` collection.
