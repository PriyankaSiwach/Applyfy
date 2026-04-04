import Link from "next/link";

type BrandLogoProps = {
  variant?: "nav" | "inline" | "dark";
  className?: string;
};

export function BrandLogo({ variant = "inline", className = "" }: BrandLogoProps) {
  const wordmark =
    variant === "dark" ? (
      <>
        <span className="font-bold text-white">Apply</span>
        <span className="font-bold text-[#3b7eff]">fy</span>
      </>
    ) : variant === "nav" ? (
      <>
        <span className="font-bold text-[#0f172a]">Apply</span>
        <span className="font-bold text-[#1a56db]">fy</span>
      </>
    ) : (
      <>
        <span className="font-bold text-[#0f172a]">Apply</span>
        <span className="font-bold text-[#1a56db]">fy</span>
      </>
    );

  return (
    <span className={`inline-flex items-baseline gap-0 text-lg ${className}`}>
      {wordmark}
    </span>
  );
}

export function BrandLogoLink({
  variant = "inline",
}: {
  variant?: BrandLogoProps["variant"];
}) {
  return (
    <Link
      href="/"
      className={`flex shrink-0 items-center rounded-lg focus:outline-none focus-visible:ring-2 ${
        variant === "dark"
          ? "focus-visible:ring-[#3b7eff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f14]"
          : "focus-visible:ring-[#1a56db] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      }`}
    >
      <BrandLogo variant={variant} />
    </Link>
  );
}
