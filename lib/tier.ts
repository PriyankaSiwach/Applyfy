/**
 * Subscription tier (Clerk `publicMetadata.subscriptionTier` + Stripe webhook).
 */

export type AppTier = "free" | "pro" | "premium";

export const FREE_ANALYSIS_SCAN_LIMIT = 3;

const LEGACY_PRO_PLUS = "pro_plus";

export function normalizeTierFromMetadata(raw: unknown): AppTier {
  if (raw === "premium" || raw === "pro" || raw === "free") return raw;
  if (raw === LEGACY_PRO_PLUS) return "premium";
  return "free";
}

export function tierFromPublicMetadata(
  meta: Record<string, unknown> | null | undefined,
): AppTier {
  return normalizeTierFromMetadata(meta?.subscriptionTier);
}

/** Pro or Premium — paid features that unlock at Pro tier. */
export function hasProPlan(tier: AppTier): boolean {
  return tier === "pro" || tier === "premium";
}

export function hasPremiumPlan(tier: AppTier): boolean {
  return tier === "premium";
}

export function isFreeTier(tier: AppTier): boolean {
  return tier === "free";
}

/** Hostname only (no port) — localhost-style origins only. */
function hostnameLooksLocal(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().split(":")[0];
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/**
 * True when the app is considered "local" for admin-email bypass:
 * - `NEXT_PUBLIC_APP_URL` is empty / localhost / 127.0.0.1, OR
 * - `runtimeHost` is the browser or request Host (e.g. localhost:3000 while APP_URL is production).
 *
 * The second case fixes local dev when APP_URL is set to your public domain for Stripe/OAuth.
 */
export function isLocalDevForAdminBypass(
  runtimeHost?: string | null | undefined,
): boolean {
  const appUrl: string = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const appUrlIsLocal =
    appUrl === "" ||
    appUrl.includes("localhost") ||
    appUrl.includes("127.0.0.1");
  if (appUrlIsLocal) return true;
  if (runtimeHost == null || runtimeHost === "") return false;
  const hostOnly = runtimeHost.trim().split(":")[0] ?? "";
  return hostnameLooksLocal(hostOnly);
}

/**
 * Returns true when an email matches ADMIN_EMAIL / NEXT_PUBLIC_ADMIN_EMAIL
 * and the app is running in a local-dev context (see `isLocalDevForAdminBypass`).
 */
export function isAdminBypassEmail(
  email: string | null | undefined,
  runtimeHost?: string | null,
): boolean {
  if (!email) return false;
  if (!isLocalDevForAdminBypass(runtimeHost)) return false;
  const adminEmail: string =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim() ||
    "";
  return adminEmail.length > 0 && email.trim().toLowerCase() === adminEmail.toLowerCase();
}

export function tierFromStripePriceId(priceId: string | undefined): AppTier {
  if (!priceId) return "free";
  const pro = process.env.STRIPE_PRO_PRICE_ID?.trim();
  const premium = process.env.STRIPE_PREMIUM_PRICE_ID?.trim();
  if (premium && priceId === premium) return "premium";
  if (pro && priceId === pro) return "pro";
  return "free";
}
