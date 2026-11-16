"use server";

import { revalidatePath } from "next/cache";

/**
 * Marks "My trips" as out of date. The router keeps a copy of every page it showed, and gives it back
 * when the person presses Back. Called after a trip is created (or deleted), so that Back does not show
 * the list as it was before. A Server Action is the way to clear that copy: a refresh of the router
 * before leaving the page is cancelled by the navigation, and an API route cannot clear it.
 */
export async function revalidateMyTrips(): Promise<void> {
  revalidatePath("/trips");
}
