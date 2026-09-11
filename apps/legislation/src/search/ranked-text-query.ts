type SearchAtom = { value: string; isExcluded: boolean }

function readAtom(input: string, start: number) {
  let position = start
  const isExcluded = input[position] === "-"
  if (isExcluded) {
    position += 1
  }
  const isQuoted = input[position] === '"'
  let value = ""
  if (isQuoted) {
    position += 1
    let isClosed = false
    while (position < input.length) {
      const character = input[position]
      if (character === '"') {
        position += 1
        isClosed = true
        break
      }
      if (character === "\\" && (input[position + 1] === '"' || input[position + 1] === "\\")) {
        position += 1
      }
      value += input[position]
      position += 1
    }
    if (!isClosed || (position < input.length && !/\s/u.test(input[position] ?? ""))) {
      throw new Error("Search phrases must have matching quotes and be separated by whitespace")
    }
  } else {
    while (position < input.length && !/\s/u.test(input[position] ?? "")) {
      if (input[position] === '"') {
        throw new Error("Search phrases must be separated by whitespace")
      }
      value += input[position]
      position += 1
    }
  }
  if (!/[\p{L}\p{N}]/u.test(value)) {
    throw new Error("Search terms must contain a letter or number")
  }
  return { position, value, isExcluded, isQuoted }
}

function quoteAtom(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

/**
 * Compile our bounded web-search grammar, not arbitrary Tantivy syntax. Pass the
 * result as a SQL parameter to strict pdb.parse with conjunction_mode enabled.
 * The field is application-owned; values, field selectors, boosts and wildcards
 * supplied by the caller are always quoted text. Tokenization/stemming remains
 * the responsibility of the indexed field's configured analyzer.
 */
export function compileRankedTextQuery(input: string, field = "body"): string {
  if (!/^[a-z][a-z0-9_]*$/u.test(field)) {
    throw new Error("Search field must be a trusted simple identifier")
  }
  const query = input.trim()
  const hasControlCharacter = Array.from(query).some((character) => {
    const code = character.charCodeAt(0)
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127
  })
  if (query.length === 0 || query.length > 500 || hasControlCharacter) {
    throw new Error("Search query must contain 1 to 500 characters without control characters")
  }
  const groups: SearchAtom[][] = []
  let group: SearchAtom[] = []
  let position = 0
  while (position < query.length) {
    if (/\s/u.test(query[position] ?? "")) {
      position += 1
      continue
    }
    const atom = readAtom(query, position)
    position = atom.position
    if (!atom.isQuoted && !atom.isExcluded && atom.value.toUpperCase() === "OR") {
      if (group.length === 0) {
        throw new Error("OR requires a search expression on both sides")
      }
      groups.push(group)
      group = []
    } else {
      group.push({ value: atom.value, isExcluded: atom.isExcluded })
    }
  }
  if (group.length === 0) {
    throw new Error("OR requires a search expression on both sides")
  }
  groups.push(group)
  return groups
    .map((atoms) => {
      const required = atoms.filter((atom) => !atom.isExcluded)
      if (required.length === 0) {
        throw new Error("Each OR branch must contain a positive search term")
      }
      const excluded = atoms.filter((atom) => atom.isExcluded)
      const positive = required.map((atom) => `${field}:${quoteAtom(atom.value)}`).join(" AND ")
      const negative = excluded.map((atom) => ` AND -${field}:${quoteAtom(atom.value)}`).join("")
      return `(${positive}${negative})`
    })
    .join(" OR ")
}
