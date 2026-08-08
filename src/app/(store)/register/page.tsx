import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Card, CardBody } from "@/components/ui";
import { RegisterForm } from "./_components/RegisterForm";

export const metadata: Metadata = {
  title: "Create account | Zubeli",
  description:
    "Create a Zubeli account to track your orders, save your details and check out faster. Pay on delivery across Rwanda.",
};

/**
 * Registration screen (Phase C-5 — account-agent). registerAction creates
 * the user AND a session, so the client navigates straight to /account.
 * Signed-in visitors skip the form.
 */
export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/account");

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <Card>
        <CardBody>
          <div className="pt-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Create account</h1>
            <p className="mt-1 text-sm text-stone-600">
              Track orders, save your details and check out faster.
            </p>
          </div>

          <div className="mt-6">
            <RegisterForm />
          </div>

          <p className="mt-6 border-t border-stone-100 pb-2 pt-5 text-center text-sm text-stone-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
