/**
 * Registration input rules (US-A1-01). Pure function: it checks the three fields and returns
 * one message per wrong field, so the form can show an error under each of them. The library
 * that creates the account (Better Auth, ADR-009) reports one problem at a time, so this runs first.
 *
 * The username rules match the library's defaults (3 to 30 characters, letters, numbers,
 * underscores and dots), and the password length matches its limits (8 to 128).
 */

export interface RegistrationInput {
  username: string;
  email: string;
  password: string;
}

export type RegistrationField = keyof RegistrationInput;

export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

export type RegistrationValidation =
  | { ok: true; value: RegistrationInput }
  | { ok: false; errors: RegistrationErrors };

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const EMAIL_MAX = 254;

const USERNAME_PATTERN = /^[A-Za-z0-9_.]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function validateRegistration(body: unknown): RegistrationValidation {
  const input =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const username = asText(input.username).trim();
  const email = asText(input.email).trim().toLowerCase();
  const password = asText(input.password); // never trimmed: spaces may be part of it

  const errors: RegistrationErrors = {};

  if (username === "") {
    errors.username = "Username is required";
  } else if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    errors.username = `Username must have ${USERNAME_MIN} to ${USERNAME_MAX} characters`;
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username =
      "Username can only have letters, numbers, underscores and dots";
  }

  if (email === "") {
    errors.email = "E-mail is required";
  } else if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid e-mail";
  }

  if (password === "") {
    errors.password = "Password is required";
  } else if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    errors.password = `Password must have ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { username, email, password } };
}
