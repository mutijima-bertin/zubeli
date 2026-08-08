import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

export const metadata = {
  title: "Admin | Zubeli",
};

/**
 * Admin shell — step 1 of the dashboard milestone. Purely presentational:
 * sidebar navigation (desktop rail + mobile drawer) and the top bar render
 * on EVERY /admin route automatically.
 *
 * Auth is defense-in-depth: `src/middleware.ts` already bounces guests to
 * /login and non-OWNERs to /; this server layout re-verifies the session
 * (a non-owner can never render the shell even if middleware is bypassed).
 * Real enforcement still lives in every admin action (`requireAdminOrThrow`).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user || user.role !== "OWNER") {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh bg-stone-50 text-ink">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar user={user} />
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}