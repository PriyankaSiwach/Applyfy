import Link from "next/link";

type BrandLogoProps = {
  /** On dark navbar: white “Apply”, accent “fy”. */
  variant?: "nav" | "inline";
  className?: string;
};

export function BrandLogo({ variant = "inline", className = "" }: BrandLogoProps) {
  const wordmark =
    variant === "nav" ? (
      <>
        <span className="font-bold text-white">Apply</span>
        <span className="font-bold text-[#4F8EF7]">fy</span>
      </>
    ) : (
      <>
        <span className="font-bold text-[#2E3E65]">Apply</span>
        <span className="font-bold text-[#4F8EF7]">fy</span>
      </>
    );

  return (
    <span className={`inline-flex items-baseline gap-0 ${className}`}>
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
      className="flex shrink-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F8EF7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E3E65]"
    >
      <BrandLogo variant={variant} />
    </Link>
  );
}
