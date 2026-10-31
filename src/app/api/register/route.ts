import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRegisterAttempt } from "@/lib/register-rate-limit";
import { isAllowedOrigin } from "@/domain/identity/origin";
import { clientAddress } from "@/domain/identity/register-rate-limit";
import { validateRegistration } from "@/domain/identity/registration";
import {
  findTakenFields,
  registrationFailureFromCode,
} from "@/domain/identity/registration-errors";

function failureAnswer(code: unknown) {
  const failure = registrationFailureFromCode(code);
  if (!failure) {
    console.error("Registration failed with an unexpected code:", code);
    return Response.json({ error: "Registration failed" }, { status: 500 });
  }
  return Response.json({ errors: failure.errors }, { status: failure.status });
}

/**
 * POST /api/register
 * Body: { username, email, password }.
 *
 * 201 { user: { id, username, email } } and the session cookie: the account is created and the
 * person is logged in. 400 or 409 { errors: { username?, email?, password? } } with one message per
 * wrong or taken field, nothing saved. 415 if the body is not JSON, 403 if the request comes from
 * another site, 429 { error } and a Retry-After header after too many attempts from one address.
 * Any other failure is 500 { error }.
 *
 * This is the only way to create an account: the library's own sign-up path is switched off in
 * src/lib/auth.ts (disabledPaths), so the checks and the limit here cannot be skipped.
 *
 * Passwords are hashed and stored by the authentication library (ADR-009), never by this code.
 */
export async function POST(request: Request) {
  // 0. Only our own pages may call this. A form on another site could send a text/plain body
  // without a preflight and register an account in a visitor's browser (login CSRF), so the body
  // must be JSON and the Origin must be this site.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }
  const siteUrl = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;
  if (!isAllowedOrigin(request.headers.get("origin"), siteUrl)) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }

  // 0b. Every attempt counts, also the ones that fail below, so taken names cannot be probed.
  const limit = await consumeRegisterAttempt(clientAddress(request.headers));
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many attempts, try again later" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined; // not JSON: the validation answers with a message for each field
  }

  // 1. Input rules, one message per wrong field.
  const checked = validateRegistration(body);
  if (!checked.ok) {
    return Response.json({ errors: checked.errors }, { status: 400 });
  }
  const { username, email, password } = checked.value;

  // 2. Taken fields. The library stops at the first problem, so ask the database for both.
  const existing = await prisma.user.findMany({
    where: { OR: [{ username: username.toLowerCase() }, { email }] },
    select: { username: true, email: true },
  });
  const taken = findTakenFields(existing, { username, email });
  if (Object.keys(taken).length > 0) {
    return Response.json({ errors: taken }, { status: 409 });
  }

  // 3. Create the account and the session. The library reports some failures by returning an
  // error Response and others by throwing APIError, so both are handled. The database constraints
  // still decide if two people register the same name at the same moment.
  try {
    const res = await auth.api.signUpEmail({
      body: { name: username, username, email, password },
      headers: request.headers,
      asResponse: true,
    });
    if (!res.ok) {
      const { code } = await res.json();
      return failureAnswer(code);
    }

    const { user } = await res.json();
    const headers = new Headers();
    for (const cookie of res.headers.getSetCookie()) {
      headers.append("set-cookie", cookie); // the session cookie, and nothing else
    }
    return Response.json(
      { user: { id: user.id, username, email: user.email } },
      { status: 201, headers }
    );
  } catch (error) {
    if (error instanceof APIError) {
      return failureAnswer(
        (error.body as { code?: unknown } | undefined)?.code
      );
    }
    throw error;
  }
}
