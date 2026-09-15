/** Comparison only: retain source text unchanged. GPO uses TeX quotes and wraps hyphenated titles. */
export function frSubjectKey(value: string) {
  return value
    .normalize("NFKC")
    .replaceAll(/``|''|[\u201c\u201d]/g, '"')
    .replaceAll(/[\u2018\u2019]/g, "'")
    .replaceAll(/[\u2013\u2014]/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/\s*-\s*/g, "-")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase()
}
