import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { ProfileForm } from "./_components/ProfileForm";

export const metadata: Metadata = {
  title: "My account | Zubeli",
  description:
    "Manage your Zubeli account details — name, phone and email. View your orders and payment status.",
};

/**
 * Profile screen (Phase C-5 — account-agent). Server shell: the (store)
 * layout's Header already holds the session, but this page re-reads it so
 * the form can be prefilled (defense in depth — middleware + getSession).
 * Updates go through updateProfileAction from the client ProfileForm.
 */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">My account</h1>
      <p className="mt-1 text-sm text-stone-600 sm:text-base">
        Your details are used for deliveries and order updates.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Profile details</h2>
            </CardHeader>
            <CardBody>
              <ProfileForm
                initialEmail={session.email}
                initialName={session.name}
                initialPhone={session.phone ?? ""}
              />
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-ink">Orders</h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-stone-600">
                Track your orders, payments and delivery status.
              </p>
              <Button href="/account/orders" variant="outline" className="mt-3">
                View order history
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
