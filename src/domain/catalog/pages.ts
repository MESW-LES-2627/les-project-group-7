/**
 * The page of a list whose page number is in the address (`?page=2`): History and the reviews of a
 * place (#187). A page that is too big, too small or not a number is the nearest real page, so an old
 * link or the last review deleted on the last page never shows an empty page.
 */
export interface PageView {
  page: number;
  totalPages: number;
  total: number;
  skip: number;
  take: number;
  /** "Showing 11 to 20 of 25": 0 and 0 when the list is empty. */
  firstShown: number;
  lastShown: number;
}

export function pageView(
  total: number,
  param: string | string[] | undefined | null,
  size: number
): PageView {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const raw = Array.isArray(param) ? param[0] : param;
  const asked = raw != null && /^\d+$/.test(raw) ? Number(raw) : 1;
  const page = Math.min(Math.max(asked, 1), totalPages);
  const skip = (page - 1) * size;

  return {
    page,
    totalPages,
    total,
    skip,
    take: size,
    firstShown: total === 0 ? 0 : skip + 1,
    lastShown: Math.min(skip + size, total),
  };
}
