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

/**
 * 20 users, enough for the most-reviewed place of the seed (US-B2-01: nobody reviews a place
 * twice). The first two keep their ids because the reviews already in the dev and prod databases
 * point at them. The e-mail is `<username>@tripbook.pt`, except for those two.
 */
const NAMES = [
  "viajante_porto",
  "ana_exploradora",
  "rui_gastronomo",
  "marta_lisboa",
  "pedro_andarilho",
  "ines_fotografa",
  "tiago_mochila",
  "carla_viajante",
  "bruno_cultura",
  "sofia_cafes",
  "miguel_trilhos",
  "helena_museus",
  "joana_miradouros",
  "andre_petiscos",
  "beatriz_arte",
  "diogo_rotas",
  "filipa_jardins",
  "goncalo_mapas",
  "teresa_bairros",
  "nuno_noites",
];

const FIRST_TWO_EMAILS = ["demo@tripbook.pt", "ana@tripbook.pt"];

export const DEMO_USERS: readonly DemoUser[] = NAMES.map((username, i) => ({
  id: `demo-user-${i + 1}`,
  username,
  email: FIRST_TWO_EMAILS[i] ?? `${username}@tripbook.pt`,
}));

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
