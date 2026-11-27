"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildLoginRequest, loginErrorMessage } from "@/domain/identity/login";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const request = buildLoginRequest(identifier, password);
    if (!request) {
      setError("Enter your username or e-mail and your password");
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch(request.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      if (res.ok) {
        // The button stays disabled while the home page loads.
        router.replace("/");
        router.refresh();
        return;
      }
      setError(loginErrorMessage(res.status));
    } catch {
      setError("Could not reach the server, try again");
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Use your username or your e-mail.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Username or e-mail</Label>
              <Input
                id="identifier"
                name="identifier"
                autoComplete="username"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p id="login-error" role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            No account?{" "}
            <Link href="/register" className="text-indigo-600 hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
