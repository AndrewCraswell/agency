export function formatIdentifierLabel(value: string): string {
  const words = value
    .trim()
    .replaceAll(/[._-]+/gu, " ")
    .toLocaleLowerCase()
  return words.replace(/^./u, (character) => character.toLocaleUpperCase())
}
