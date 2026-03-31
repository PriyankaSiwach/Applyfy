"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogoLink } from "@/components/BrandLogo";

const nav = [
  { href: "/", label: "Home" },
  { href: "/my-application", label: "My application" },
  { href: "/tracker", label: "Tracker" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#2E3E65]">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-8">
        <BrandLogoLink variant="nav" />

        <nav
          className="hidden h-14 items-stretch gap-0 md:flex"
          aria-label="Main"
        >
          {nav.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center border-b-2 px-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-[#4F8EF7] text-white"
                    : "border-transparent text-white/75 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md text-white md:hidden"
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

      {menuOpen ? (
        <nav
          id="mobile-nav"
          className="border-t border-white/10 bg-[#2E3E65] px-4 py-3 md:hidden"
          aria-label="Mobile"
        >
          <ul className="flex flex-col gap-1">
            {nav.map(({ href, label }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`block border-l-[3px] py-2.5 pl-3 text-sm font-medium ${
                      active
                        ? "border-[#4F8EF7] text-white"
                        : "border-transparent text-white/75 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
