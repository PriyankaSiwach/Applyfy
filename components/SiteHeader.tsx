"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useAuth,
  useUser,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const homeNav = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

const appNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/my-application", label: "My application" },
  { href: "/tracker", label: "Tracker" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const showThemeToggle = pathname === "/" || pathname === "/dashboard";
  const [menuOpen, setMenuOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const isHome = pathname === "/";
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const stripeCustomerId =
    typeof user?.publicMetadata?.stripeCustomerId === "string"
      ? user.publicMetadata.stripeCustomerId
      : undefined;

  async function openCustomerPortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        console.error(data.error ?? "Portal error");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      /* ignore */
    } finally {
      setPortalBusy(false);
    }
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const links = isHome ? homeNav : appNav;

  return (
    <header
      className="sticky top-0 z-[100] h-16 border-b border-[var(--border)] backdrop-blur-[16px] transition-[background-color,border-color] duration-300 ease-out"
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg-base) 92%, transparent)",
      }}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-4 px-5">
        <Link
          href="/"
          className="flex shrink-0 items-center font-[family-name:var(--font-plus-jakarta)] leading-none"
        >
          <img
            src="/logo.png"
            alt="Applyfy"
            height={28}
            width={30}
            className="h-28 w-30 shrink-0 object-contain"
            decoding="async"
          />
          <span className="text-[25px] leading-none">
            <span className="font-bold text-[var(--text-primary)]">Apply</span>
            <span
              className="font-bold text-[#7c3aed]"
            >
              fy
            </span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-10 md:flex"
          aria-label="Main"
        >
          {links.map(({ href, label }) => {
            const sessionDot =
              !isHome &&
              href === "/my-application" &&
              (pathname === "/my-application" ||
                pathname.startsWith("/my-application/"));
            const active =
              href.startsWith("#")
                ? false
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={`${href}-${label}`}
                href={href}
                className={`relative rounded-[99px] px-[14px] py-1 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-[var(--brand-tint)] text-[#7c3aed]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {sessionDot ? (
                  <span
                    className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#7c3aed]"
                    aria-hidden
                  />
                ) : null}
                <span className={sessionDot ? "pl-4" : undefined}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {showThemeToggle ? <ThemeToggle /> : null}

          {isSignedIn ? (
            <>
              {stripeCustomerId ? (
                <button
                  type="button"
                  disabled={portalBusy}
                  onClick={() => void openCustomerPortal()}
                  className="hidden rounded-[10px] border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] sm:inline-flex"
                >
                  {portalBusy ? "Opening…" : "Manage subscription"}
                </button>
              ) : null}
              <UserButton />
            </>
          ) : (
            /* Signed-out: Sign In + Get Started */
            <>
              <SignInButton mode="redirect">
                <button
                  type="button"
                  className="hidden text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] sm:inline"
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="redirect">
                <button
                  type="button"
                  className="hidden rounded-[10px] px-5 py-[9px] text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 sm:inline-flex"
                  style={{
                    background: "var(--gradient-hero)",
                    boxShadow: "0 2px 12px var(--brand-glow)",
                  }}
                >
                  Get Started
                </button>
              </SignUpButton>
            </>
          )}

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)] md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          className="border-t border-[var(--border)] bg-[var(--bg-base)] px-4 py-4 md:hidden"
          aria-label="Mobile"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg-base) 98%, transparent)",
          }}
        >
          <ul className="flex flex-col gap-1">
            {links.map(({ href, label }) => {
              const mActive =
                href.startsWith("#")
                  ? false
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={`m-${href}-${label}`}>
                  <Link
                    href={href}
                    className={`block rounded-[99px] py-2.5 pl-3 pr-3 text-sm font-medium ${
                      mActive
                        ? "bg-[var(--brand-tint)] text-[#7c3aed]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            {showThemeToggle ? (
              <div className="flex justify-center py-1">
                <ThemeToggle />
              </div>
            ) : null}
            {isSignedIn ? (
              <div className="flex flex-col items-center gap-3 py-2">
                {stripeCustomerId ? (
                  <button
                    type="button"
                    disabled={portalBusy}
                    onClick={() => void openCustomerPortal()}
                    className="w-full max-w-xs rounded-[10px] border border-[var(--border)] py-2 text-sm font-semibold text-[var(--text-secondary)]"
                  >
                    {portalBusy ? "Opening…" : "Manage subscription"}
                  </button>
                ) : null}
                <UserButton />
              </div>
            ) : (
              <>
                <SignInButton mode="redirect">
                  <button
                    type="button"
                    className="py-2 text-center text-sm font-medium text-[var(--text-secondary)]"
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="redirect">
                  <button
                    type="button"
                    className="rounded-[10px] py-2.5 text-center text-sm font-semibold text-white"
                    style={{ background: "var(--gradient-hero)" }}
                  >
                    Get Started
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
