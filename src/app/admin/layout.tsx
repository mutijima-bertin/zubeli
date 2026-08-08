import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { ToastProvider } from "@/components/ui";

export const metadata = {
  title: "Admin | Zubeli",
};

// Auth-guarded dashboard reads cookies via getSession() — declare the whole
// /admin subtree dynamic up front so Next never attempts static generation
// (silences build-time DYNAMIC_SERVER_USAGE noise; all admin routes are ƒ).
export const dynamic = "force-dynamic";

/**
 * Admin shell — step 1 of the dashboard milestone. Purely presentational:
 * sidebar navigation (desktop rail + mobile drawer) and the top bar render
 * on EVERY /admin route automatically.
 *
 * Auth is defense-in-depth: `src/middleware.ts` already bounces guests to
 * /login and non-OWNERs to /; this server layout re-verifies the session
 * (a non-owner can never render the shell even if middleware is bypassed).
 * Real enforcement still lives in every admin action (`requireAdminOrThrow`).
 *
 * Toast parity (ui-ux-pro-max audit #15b): the storefront ToastProvider is
 * mounted here so any admin client component can use `useToast()` — the
 * storefront widget itself is owned by frontend-agent and is not edited.
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
    <ToastProvider>
      <div className="flex min-h-dvh bg-stone-50 text-ink">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar user={user} />
          <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}