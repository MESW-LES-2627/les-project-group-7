/**
 * The text form that every search compares: without case or accents, and reading ß as ss.
 * Pure function, so the rule can be tested without the UI.
 */

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .trim();
}
