import { createHash } from "node:crypto"
import type pg from "pg"
import { z } from "zod"

export function selectAmendmentSample(ids: readonly string[], perJurisdiction = 1000) {
  if (!Number.isSafeInteger(perJurisdiction) || perJurisdiction < 1 || perJurisdiction > 1000) {
    throw new Error("Sample size must be from 1 through 1000 documents per jurisdiction")
  }
  const groups = new Map<string, Array<{ id: string; hash: string }>>()
  for (const id of new Set(ids)) {
    const jurisdiction = /^bill:([^:]+):/.exec(id)?.[1]
    if (!jurisdiction) {
      throw new Error(`Unrecognized amendment document identifier: ${id}`)
    }
    const group = groups.get(jurisdiction) ?? []
    group.push({ id, hash: createHash("sha256").update(id).digest("hex") })
    groups.set(jurisdiction, group)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jurisdiction, rows]) => ({
      jurisdiction,
      available: rows.length,
      ids: rows
        .sort((a, b) => a.hash.localeCompare(b.hash))
        .slice(0, perJurisdiction)
        .map(({ id }) => id)
    }))
}

export async function copyBalancedAmendments(source: pg.Client, target: pg.Client, report: (line: string) => void) {
  // The amendment-date index supplies only keys, not the multi-million-row section corpus.
  const keys = z.array(z.object({ id: z.string() })).parse(
    (
      await source.query(`
    select id from legislation.bill_documents where classification='amendment'
    order by (document_date is null),document_date desc nulls first,id limit 150001`)
    ).rows
  )
  if (keys.length > 150000) {
    throw new Error("Amendment key inventory exceeded the diagnostic safety bound")
  }
  let copied = 0
  let copiedBytes = 0
  for (const group of selectAmendmentSample(keys.map(({ id }) => id))) {
    let sections = 0
    for (let offset = 0; offset < group.ids.length; offset += 25) {
      const documentIds = group.ids.slice(offset, offset + 25)
      const size = z.object({ sections: z.number(), bytes: z.number() }).parse(
        (
          await source.query(
            `select count(*)::int sections,coalesce(sum(octet_length(text)+coalesce(octet_length(heading),0)),0)::float8 bytes
         from legislation.document_sections where document_id=any($1::text[])`,
            [documentIds]
          )
        ).rows[0]
      )
      if (
        size.bytes > 32_000_000 ||
        size.sections > 25_000 ||
        copied + size.sections > 250_000 ||
        copiedBytes + size.bytes > 1_000_000_000
      ) {
        throw new Error("Complete-document sample exceeds the section/byte safety budget; no truncation performed")
      }
      const rows = z.array(z.object({ has_correct_vector: z.literal(true) }).passthrough()).parse(
        (
          await source.query(
            `select s.id,s.document_id,s.heading,s.text,s.page_start,s.page_end,
        (s.search_vector is not distinct from (setweight(to_tsvector('english',coalesce(s.heading,'')),'A') ||
          setweight(to_tsvector('english',s.text),'B'))) has_correct_vector,
        coalesce(d.title,'') search_document_title,
        jsonb_build_object('processingStatus',d.processing_status,
          'billIds',jsonb_build_array(b.id),'jurisdictionIds',jsonb_build_array(b.jurisdiction_id),
          'sessionIds',jsonb_build_array(b.session_id),'classifications',b.classification,
          'statuses',jsonb_build_array(b.status),'subjects',b.subjects,
          'sponsorIds',coalesce((select jsonb_agg(sp.person_id) from legislation.bill_sponsors sp where sp.bill_id=b.id),'[]'::jsonb),
          'documentClassifications',jsonb_build_array(d.classification),
          'versionCodes',jsonb_build_array(d.version_code),
          'introducedAt',extract(epoch from b.introduced_at::timestamptz)*1000,
          'updatedAt',extract(epoch from b.updated_at)*1000,
          'submittedAt',extract(epoch from d.document_date::timestamptz)*1000,
          'documentUpdatedAt',extract(epoch from d.updated_at)*1000) search_metadata
        from legislation.bill_documents d join legislation.bills b on b.id=d.bill_id
        cross join lateral (select * from legislation.document_sections where document_id=d.id offset 0) s
        where d.id=any($1::text[]) order by s.id`,
            [documentIds]
          )
        ).rows
      )
      await target.query(
        `insert into legislation.document_sections
        select id,document_id,heading,text,page_start,page_end,search_document_title,search_metadata
        from jsonb_to_recordset($1::jsonb) as r(id text,document_id text,heading text,text text,
          page_start integer,page_end integer,search_document_title text,search_metadata jsonb)`,
        [JSON.stringify(rows)]
      )
      copied += rows.length
      copiedBytes += size.bytes
      sections += rows.length
      report(
        JSON.stringify({
          copiedPublicSections: copied,
          stratum: group.jurisdiction,
          sampledDocuments: Math.min(offset + 25, group.ids.length)
        })
      )
    }
    report(
      JSON.stringify({
        samplingStratum: group.jurisdiction,
        availableDocuments: group.available,
        selectedDocuments: group.ids.length,
        copiedSections: sections,
        method:
          "SHA-256 ordered document keys, at most 1000 per jurisdiction; complete available sections; no synthetic copies"
      })
    )
  }
  return copied
}
