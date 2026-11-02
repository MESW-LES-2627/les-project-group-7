/**
 * Answers for a failed registration. Pure functions, no library and no database in here.
 *
 * `registrationFailureFromCode` turns an error code of the authentication library (Better Auth,
 * ADR-009) into our answer: a status and one message per field, the same shape the form gets
 * for invalid input. `findTakenFields` looks at the users that already exist, so a person whose
 * username and e-mail are both taken is told about both (the library stops at the first one).
 */

import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  type RegistrationErrors,
} from "./registration";

export interface RegistrationFailure {
  status: 400 | 409;
  errors: RegistrationErrors;
}

const USERNAME_TAKEN = "This username is already taken";
const EMAIL_TAKEN = "This e-mail is already registered";

const FAILURES: Record<string, RegistrationFailure> = {
  USERNAME_IS_ALREADY_TAKEN: {
    status: 409,
    errors: { username: USERNAME_TAKEN },
  },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
    status: 409,
    errors: { email: EMAIL_TAKEN },
  },
  USER_ALREADY_EXISTS: { status: 409, errors: { email: EMAIL_TAKEN } },
  PASSWORD_TOO_SHORT: {
    status: 400,
    errors: {
      password: `Password must have ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`,
    },
  },
  PASSWORD_TOO_LONG: {
    status: 400,
    errors: {
      password: `Password must have ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`,
    },
  },
  INVALID_USERNAME: {
    status: 400,
    errors: {
      username: "Username can only have letters, numbers, underscores and dots",
    },
  },
  USERNAME_TOO_SHORT: {
    status: 400,
    errors: {
      username: `Username must have ${USERNAME_MIN} to ${USERNAME_MAX} characters`,
    },
  },
  USERNAME_TOO_LONG: {
    status: 400,
    errors: {
      username: `Username must have ${USERNAME_MIN} to ${USERNAME_MAX} characters`,
    },
  },
  INVALID_EMAIL: { status: 400, errors: { email: "Enter a valid e-mail" } },
};

/** Returns null for a code we do not know: the caller answers 500 instead of guessing a field. */
export function registrationFailureFromCode(
  code: unknown
): RegistrationFailure | null {
  if (typeof code !== "string") return null;
  return FAILURES[code] ?? null;
}

/**
 * The message above the form when a registration fails with no message for a field (a field error
 * is shown under its field). A refused request (403) gets a text that is true on every address;
 * otherwise the server's own message, or a generic one when there is none.
 */
export function registrationFormMessage(
  status: number,
  serverMessage: unknown
): string {
  if (status === 403) {
    return "Request blocked: open the site at its official address and try again";
  }
  if (typeof serverMessage === "string" && serverMessage !== "") {
    return serverMessage;
  }
  return "Registration failed, try again";
}

export function findTakenFields(
  existing: ReadonlyArray<{ username: string; email: string }>,
  wanted: { username: string; email: string }
): RegistrationErrors {
  const username = wanted.username.toLowerCase();
  const email = wanted.email.toLowerCase();
  const errors: RegistrationErrors = {};

  for (const user of existing) {
    if (user.username.toLowerCase() === username)
      errors.username = USERNAME_TAKEN;
    if (user.email.toLowerCase() === email) errors.email = EMAIL_TAKEN;
  }
  return errors;
}
