/**
 * Login form rules (US-A1-02). Pure functions: the form uses them to pick the library call and to
 * choose the message, so the rules can be tested without a browser.
 */

export interface LoginRequest {
  path: string;
  body:
    | { email: string; password: string }
    | { username: string; password: string };
}

/**
 * The library call for what was typed: an "@" can only be an e-mail, anything else is a username.
 * The password is never trimmed. Null when either field is empty.
 */
export function buildLoginRequest(
  identifier: string,
  password: string
): LoginRequest | null {
  const text = identifier.trim();
  if (text === "" || password === "") return null;

  return text.includes("@")
    ? { path: "/api/auth/sign-in/email", body: { email: text, password } }
    : {
        path: "/api/auth/sign-in/username",
        body: { username: text, password },
      };
}

/**
 * The message for a failed login. Wrong password and unknown user (401) share one text: the
 * library words them differently per endpoint, and a different text would tell which one it was.
 */
export function loginErrorMessage(status: number): string {
  if (status === 401) return "Wrong username/e-mail or password";
  if (status === 429)
    return "Too many attempts, wait a few seconds and try again";
  return "Login failed, try again";
}
