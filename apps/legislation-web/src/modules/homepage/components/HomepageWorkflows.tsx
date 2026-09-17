"use client"

import { useClipboard } from "@mantine/hooks"
import { Archive, ArrowUpRight, Check, Copy, FileDiff, FileText, Undo2 } from "lucide-react"
import { useState } from "react"
import { Button } from "../../../components/ui/button"
import { Checkbox } from "../../../components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip"
import * as landing from "./HomepageLanding.css"
import * as styles from "./HomepageWorkflows.css"

const comparisonUrl = "https://leginfo.legislature.ca.gov/faces/billVersionsCompareClient.xhtml?bill_id=202320240AB2652"
const historyUrl = "https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=202320240AB2652"
const updates = [
  {
    id: "committee",
    kind: "Committee action",
    title: "Held under submission",
    date: "May 16, 2024",
    text: "In committee: Held under submission.",
    href: historyUrl
  },
  {
    id: "text",
    kind: "Amended text",
    title: "Assembly amendments published",
    date: "Apr 18, 2024",
    text: "The April 18 amended version is available in the filed record.",
    href: comparisonUrl
  }
]
const findings = [
  "AB 2652 would establish a working group on artificial intelligence in public schools.",
  "The Superintendent would convene the group in consultation with the State Board of Education."
]

export function HomepageWorkflows({
  quote,
  sourceUrl,
  onRead
}: Readonly<{ quote: string; sourceUrl: string; onRead: (target: HTMLElement) => void }>) {
  const [archived, setArchived] = useState<string[]>([])
  const [reviewed, setReviewed] = useState<number[]>([])
  const clipboard = useClipboard({ timeout: 2000 })
  const visibleUpdates = updates.filter((update) => !archived.includes(update.id))

  return (
    <section id="after-the-answer" aria-labelledby="after-title" className={styles.band}>
      <div className={landing.inner}>
        <header className={styles.heading}>
          <p className={landing.eyebrow}>Working with the evidence</p>
          <h2 id="after-title" className={styles.title}>
            Read the text.
            <br />
            Compare the wording.
          </h2>
          <p className={landing.sectionDescription}>
            Check the source version, inspect an amendment, and copy findings with their citations.
          </p>
        </header>
        <div className={styles.acts}>
          <section className={styles.act} aria-labelledby="reader-title">
            <div className={styles.copy}>
              <p className={styles.step}>01 / Reader</p>
              <h3 id="reader-title" className={styles.actTitle}>
                Read the version the answer cites.
              </h3>
              <p className={styles.body}>
                A citation identifies the document, version and passage. Read the retrieved excerpt, then open the filed
                text for the full context.
              </p>
            </div>
            <div className={styles.preview}>
              <div className={styles.chrome}>
                <span>AB 2652 / Bill text</span>
                <a className={styles.textLink} href={comparisonUrl} target="_blank" rel="noopener noreferrer">
                  Compare versions
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
              <div className={styles.readerBody}>
                <div className={styles.version}>
                  <FileText size={16} aria-hidden="true" />
                  <span>Amended in Assembly, Apr 18, 2024</span>
                </div>
                <div>
                  <p className={styles.step}>Legislative counsel&apos;s digest</p>
                  <h4 className={styles.documentTitle}>Artificial intelligence working group</h4>
                </div>
                <div className={styles.highlight}>
                  <p className={styles.step}>Cited passage / Page 1</p>
                  <blockquote className={styles.documentText}>{quote}</blockquote>
                </div>
                <Button variant="ghost" className={styles.readAction} onClick={(event) => onRead(event.currentTarget)}>
                  Read citation
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </section>
          <section className={styles.reverseAct} aria-labelledby="compare-title">
            <div className={styles.copy}>
              <p className={styles.step}>02 / Compare</p>
              <h3 id="compare-title" className={styles.actTitle}>
                See which words changed.
              </h3>
              <p className={styles.body}>
                This amendment replaces a focus on safe and effective uses with an assessment of benefits and risks. The
                removed and added words show the difference.
              </p>
            </div>
            <div className={styles.preview}>
              <div className={styles.chrome}>
                <span>AB 2652 / Compare versions</span>
                <FileDiff size={15} aria-hidden="true" />
              </div>
              <div className={styles.comparison}>
                <div className={styles.diffColumn}>
                  <div className={styles.diffHeader}>
                    <span className={styles.step}>Previous wording</span>
                    <strong>Before amendment</strong>
                  </div>
                  <p className={styles.diffLocator}>Section 2(d)(2)(A)</p>
                  <p className={styles.diffText}>
                    Identify <del className={styles.removal}>safe and effective uses</del> of artificial intelligence in
                    education settings, including all of the following:
                  </p>
                </div>
                <div className={styles.diffColumn}>
                  <div className={styles.diffHeader}>
                    <span className={styles.step}>Amended wording</span>
                    <strong>April 18, 2024</strong>
                  </div>
                  <p className={styles.diffLocator}>Section 2(d)(2)(A)</p>
                  <p className={styles.diffText}>
                    Identify <ins className={styles.addition}>benefits and risks associated with the use</ins> of
                    artificial intelligence in education settings, including all of the following:
                  </p>
                </div>
              </div>
              <div className={styles.previewFooter}>
                <span>Excerpt from the filed amendment</span>
                <a href={comparisonUrl} target="_blank" rel="noopener noreferrer" className={styles.textLink}>
                  Open comparison
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>
          <section className={styles.act} aria-labelledby="updates-title">
            <div className={styles.copy}>
              <p className={styles.step}>03 / Updates</p>
              <h3 id="updates-title" className={styles.actTitle}>
                A dated change, linked to its source.
              </h3>
              <p className={styles.body}>
                An amendment or committee action is easier to assess with its date and underlying record together.
              </p>
            </div>
            <div className={styles.preview}>
              <div className={styles.chrome}>
                <span>Updates / Inbox preview</span>
                <output aria-live="polite">{visibleUpdates.length} updates</output>
              </div>
              <div className={styles.listBody}>
                {visibleUpdates.map((update) => (
                  <article key={update.id} className={styles.listItem}>
                    <div className={styles.itemMeta}>
                      <span className={styles.step}>{update.kind}</span>
                      <span>{update.date}</span>
                    </div>
                    <h4 className={styles.itemTitle}>{update.title}</h4>
                    <p className={styles.body}>{update.text}</p>
                    <div className={styles.itemMeta}>
                      <a className={styles.textLink} href={update.href} target="_blank" rel="noopener noreferrer">
                        CA AB 2652
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={styles.iconButton}
                            aria-label={`Archive ${update.title}`}
                            onClick={() => setArchived([...archived, update.id])}
                          >
                            <Archive size={16} aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archive update</TooltipContent>
                      </Tooltip>
                    </div>
                  </article>
                ))}
                {visibleUpdates.length === 0 && <p className={styles.empty}>No updates in this preview inbox.</p>}
              </div>
              <div className={styles.previewFooter}>
                <span>Historical records / Local preview</span>
                {archived.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setArchived([])}>
                    <Undo2 size={14} aria-hidden="true" />
                    Restore updates
                  </Button>
                )}
              </div>
            </div>
          </section>
          <section className={styles.reverseAct} aria-labelledby="findings-title">
            <div className={styles.copy}>
              <p className={styles.step}>04 / Issues and briefs</p>
              <h3 id="findings-title" className={styles.actTitle}>
                Share the finding and its source.
              </h3>
              <p className={styles.body}>
                Copy a brief with the bill, version, passage and source link included, so a reader can check the
                conclusion.
              </p>
            </div>
            <div className={styles.preview}>
              <div className={styles.chrome}>
                <span>Issue / AI in public schools</span>
                <span>2 findings</span>
              </div>
              <div className={styles.listBody}>
                {findings.map((finding, index) => (
                  <article className={styles.listItem} key={finding}>
                    <div className={styles.itemMeta}>
                      <span>Finding {index + 1} / CA AB 2652</span>
                      <label className={styles.review}>
                        <Checkbox
                          checked={reviewed.includes(index)}
                          onCheckedChange={(checked) =>
                            setReviewed(
                              checked === true ? [...reviewed, index] : reviewed.filter((item) => item !== index)
                            )
                          }
                          aria-label={`Mark finding ${index + 1} reviewed`}
                        />
                        <span>{reviewed.includes(index) ? "Reviewed" : "Needs review"}</span>
                      </label>
                    </div>
                    <p className={styles.finding}>{finding}</p>
                    <p className={styles.small}>Amended Apr 18, 2024 / Legislative counsel&apos;s digest, page 1</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.readAction}
                      onClick={(event) => onRead(event.currentTarget)}
                    >
                      Read source
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Button>
                  </article>
                ))}
              </div>
              <div className={styles.previewFooter}>
                <span>Brief / Includes both source citations</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    clipboard.copy(
                      findings
                        .map(
                          (finding) =>
                            `${finding}\nCalifornia AB 2652, amended April 18, 2024, digest page 1.\n${sourceUrl}`
                        )
                        .join("\n\n")
                    )
                  }
                >
                  {clipboard.copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {clipboard.copied ? "Copied" : "Copy brief"}
                </Button>
              </div>
              {clipboard.error && (
                <p role="alert" className={styles.copyError}>
                  Could not copy the brief. Check clipboard permissions.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
