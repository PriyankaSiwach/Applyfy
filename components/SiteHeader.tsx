"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const homeNav = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

const appNav = [
  { href: "/", label: "Home" },
  { href: "/my-application", label: "My application" },
  { href: "/tracker", label: "Tracker" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHome = pathname === "/";

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
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="shrink-0 font-[family-name:var(--font-plus-jakarta)] text-[22px] font-extrabold leading-none tracking-tight"
        >
          <span className="text-[var(--text-primary)]">Apply</span>
          <span className="text-[var(--brand-2)]">fy</span>
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
                : href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={`${href}-${label}`}
                href={href}
                className={`relative text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {sessionDot ? (
                  <span
                    className="absolute -left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--brand)]"
                    aria-hidden
                  />
                ) : null}
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <a
            href="#"
            className="hidden text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] sm:inline"
          >
            Sign In
          </a>
          <Link
            href="/my-application"
            className="hidden rounded-[10px] px-5 py-[9px] text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 sm:inline-flex"
            style={{
              background: "var(--gradient-hero)",
              boxShadow: "0 2px 12px var(--brand-glow)",
            }}
          >
            Get Started
          </Link>
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
            {links.map(({ href, label }) => (
              <li key={`m-${href}-${label}`}>
                <Link
                  href={href}
                  className="block rounded-lg py-2.5 pl-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <a
              href="#"
              className="py-2 text-center text-sm font-medium text-[var(--text-secondary)]"
            >
              Sign In
            </a>
            <Link
              href="/my-application"
              className="rounded-[10px] py-2.5 text-center text-sm font-semibold text-white"
              style={{ background: "var(--gradient-hero)" }}
            >
              Get Started
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
