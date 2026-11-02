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
import {
  PASSWORD_MAX,
  USERNAME_MAX,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationField,
} from "@/domain/identity/registration";
import { registrationFormMessage } from "@/domain/identity/registration-errors";

const FIELDS: {
  name: RegistrationField;
  label: string;
  type: string;
  autoComplete: string;
  maxLength: number;
}[] = [
  {
    name: "username",
    label: "Username",
    type: "text",
    autoComplete: "username",
    maxLength: USERNAME_MAX,
  },
  {
    name: "email",
    label: "E-mail",
    type: "email",
    autoComplete: "email",
    maxLength: 254,
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
    maxLength: PASSWORD_MAX,
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const checked = validateRegistration(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.value),
      });
      if (res.status === 201) {
        // The button stays disabled: a second click would post the same account and get a 409.
        router.replace("/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.errors) setErrors(data.errors);
      else setFormError(registrationFormMessage(res.status, data.error));
    } catch {
      setFormError("Could not reach the server, try again");
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Register to review places and plan trips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {FIELDS.map(({ name, label, ...input }) => (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  name={name}
                  {...input}
                  value={values[name]}
                  onChange={(e) =>
                    setValues({ ...values, [name]: e.target.value })
                  }
                  aria-invalid={!!errors[name]}
                  aria-describedby={errors[name] ? `${name}-error` : undefined}
                />
                {errors[name] && (
                  <p id={`${name}-error`} className="text-xs text-red-600">
                    {errors[name]}
                  </p>
                )}
              </div>
            ))}
            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            <Link href="/" className="text-indigo-600 hover:underline">
              Back to places
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
