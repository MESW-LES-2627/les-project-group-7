import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Sign in, sign out, get-session and the other endpoints of the authentication library.
export const { POST, GET } = toNextJsHandler(auth);
