"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nextMap: Record<string, string | null> = {
  "/analyze": "/match",
  "/match": "/resume-editor",
  "/resume-editor": "/cover",
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
        className="applyfy-btn-primary inline-flex items-center gap-2 rounded-[10px] bg-[#7c3aed] px-6 py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)] transition-all duration-200 hover:bg-[#6d28d9]"
      >
        Next
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
