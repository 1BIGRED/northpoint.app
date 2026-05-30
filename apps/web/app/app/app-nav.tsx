"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Minimal top nav for the dashboard pages (sites list + settings). The editor
// route has its own full-screen chrome and intentionally does not render this.
const LINKS = [
  { href: "/app/sites", label: "Sites" },
  { href: "/app/settings", label: "Settings" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link href="/app/sites" className="text-sm font-semibold tracking-tight">
          Northpoint
        </Link>
        <div className="flex items-center gap-4">
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "text-sm font-medium text-foreground"
                    : "text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {link.label}
              </Link>
            );
          })}
          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
