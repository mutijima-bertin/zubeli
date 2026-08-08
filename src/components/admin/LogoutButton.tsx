"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui";

/**
 * Sign-out for the admin top bar. Calls the existing `logoutAction` (auth
 * session logic owned by backend-agent — never reimplemented here) and
 * bounces to the storefront.
 */
export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function signOut() {
    setPending(true);
    try {
      await logoutAction();
    } finally {
      setPending(false);
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} loading={pending}>
      Sign out
    </Button>
  );
}