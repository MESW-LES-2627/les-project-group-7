"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleLogout() {
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`sign-out answered ${res.status}`);
      router.refresh();
    } catch {
      setFailed(true);
    }
    setPending(false);
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleLogout}
      disabled={pending}
    >
      {failed ? "Log out failed, retry" : "Log out"}
    </Button>
  );
}
