/**
 * Where a place is, as one line: the address, then the city only when the address does not already end
 * with it, then the country (#187). Addresses from OpenStreetMap often end with the city already, and
 * "75007, Paris, Paris" said it twice.
 */
export function placeLocation(
  address: string | null | undefined,
  city: string | null | undefined,
  country?: string | null
): string {
  const parts = [address?.trim(), city?.trim(), country?.trim()];
  const [street, town] = parts;

  if (street && town) {
    const last = street.split(",").pop()!.trim().toLowerCase();
    const name = town.toLowerCase();

    // "…, Paris" or "…, 75011 Paris": the city is the last word(s) of the last part
    if (last === name || last.endsWith(` ${name}`)) parts[1] = undefined;
  }

  return parts.filter(Boolean).join(", ");
}
