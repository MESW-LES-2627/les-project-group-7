import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
 * wrong or taken field, nothing saved. Any other failure is 500 { error }.
 *
 * Passwords are hashed and stored by the authentication library (ADR-009), never by this code.
 */
export async function POST(request: Request) {
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
