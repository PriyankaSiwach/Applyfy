"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

export const PREMIUM_UPGRADE_TOOLTIP =
  "Upgrade to Premium to unlock this feature";

type BtnProps = {
  className?: string;
  disabled?: boolean;
  type?: string;
  tabIndex?: number;
  "aria-disabled"?: boolean;
};

/**
 * For non-Premium users: keeps the control visible, disables interaction,
 * dims the button, shows a gold ✨ Premium badge, and on hover shows a
 * lock + not-allowed cursor with a native tooltip.
 */
export function PremiumLockedButtonWrap({
  isPremium,
  children,
  className = "",
  fullWidth = false,
  overlayRoundedClassName = "rounded-xl",
}: {
  isPremium: boolean;
  children: ReactNode;
  className?: string;
  /** Use when the inner button is `w-full` so the lock overlay spans the bar. */
  fullWidth?: boolean;
  overlayRoundedClassName?: string;
}) {
  if (isPremium) {
    return <>{children}</>;
  }

  const only = Children.only(children);
  if (!isValidElement(only)) {
    return <>{children}</>;
  }

  const el = only as ReactElement<BtnProps>;
  const prevClass = el.props.className ?? "";
  const merged = cloneElement(el, {
    disabled: true,
    tabIndex: -1,
    "aria-disabled": true,
    className: [prevClass, "pointer-events-none opacity-60"].filter(Boolean).join(" "),
  });

  const outerClass = fullWidth
    ? "group/premiumLock relative block w-full overflow-visible pt-1"
    : "group/premiumLock relative inline-flex max-w-full overflow-visible pt-1";

  const innerClass = fullWidth
    ? "relative inline-block w-full sm:w-auto"
    : "relative inline-flex max-w-full";

  return (
    <span className={`${outerClass} ${className}`.trim()}>
      <span className={innerClass}>
        <span
          className="pointer-events-none absolute -right-0.5 -top-2.5 z-20 whitespace-nowrap rounded-full border border-amber-200/90 bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow-md ring-1 ring-amber-400/45"
          aria-hidden
        >
          ✨ Premium
        </span>
        {merged}
        <span
          title={PREMIUM_UPGRADE_TOOLTIP}
          className={`absolute inset-0 z-10 flex cursor-not-allowed items-center justify-center ${overlayRoundedClassName} border border-transparent transition-all duration-200 ease-out group-hover/premiumLock:border-amber-400/50 group-hover/premiumLock:bg-violet-950/[0.045] group-hover/premiumLock:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.28)]`}
          aria-label={PREMIUM_UPGRADE_TOOLTIP}
        >
          <span
            className="pointer-events-none select-none text-lg opacity-0 transition-opacity duration-200 ease-out group-hover/premiumLock:opacity-100"
            aria-hidden
          >
            🔒
          </span>
        </span>
      </span>
    </span>
  );
}
