"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nextMap: Record<string, string | null> = {
  "/analyze": "/match",
  "/match": "/cover",
  "/cover": "/interview",
  "/interview": null,
};

export function FlowNextButton() {
  const pathname = usePathname();
  const next = nextMap[pathname] ?? null;
  if (!next) return null;

  return (
    <div className="mt-10 flex justify-center border-t border-[#E2E8F0] pt-8">
      <Link
        href={next}
        className="inline-flex items-center gap-2 rounded-lg bg-[#2E3E65] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3D5080]"
      >
        Next
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
