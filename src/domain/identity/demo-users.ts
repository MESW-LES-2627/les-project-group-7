/**
 * The demo users that the seed creates (US-B2-01), and the password they log in with. Pure: the
 * seed does the hashing and the database work, so the rules can be tested without either.
 *
 * A demo user is an ordinary user. Its username, e-mail and password must pass the same rules as
 * the registration form, so the account looks exactly like one made on /register.
 */

import { PASSWORD_MAX, PASSWORD_MIN } from "./registration";

export interface DemoUser {
  id: string;
  username: string;
  email: string;
}

/** The ids stay `demo-user-N`: the reviews already in the dev and prod databases point at them. */
export const DEMO_USERS: readonly DemoUser[] = [
  { id: "demo-user-1", username: "viajante_porto", email: "demo@tripbook.pt" },
  { id: "demo-user-2", username: "ana_exploradora", email: "ana@tripbook.pt" },
];

/** Documented in the README. Set DEMO_PASSWORD to use another one (for example on prod). */
export const DEFAULT_DEMO_PASSWORD = "tripbook-demo";

/**
 * The password of the demo users: DEMO_PASSWORD when it is set, otherwise the documented default.
 * A value that breaks the password rules is refused instead of creating accounts nobody could
 * log in to.
 */
export function demoPassword(fromEnv: string | undefined): string {
  if (fromEnv === undefined || fromEnv === "") return DEFAULT_DEMO_PASSWORD;

  if (fromEnv.length < PASSWORD_MIN || fromEnv.length > PASSWORD_MAX) {
    throw new Error(
      `DEMO_PASSWORD must have ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`
    );
  }
  return fromEnv;
}
