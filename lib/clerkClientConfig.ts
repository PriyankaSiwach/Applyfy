import { getSiteUrl } from "@/lib/siteUrl";
import {
  clerkFrontendApiHostFromPublishableKey,
  publishableKeyUsesAmplifyHost,
} from "@/lib/clerkPublishableKey";

/** Never load clerk-js from a proxy path — always use the public CDN. */
const CLERK_JS_CDN =
  "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js";

export type ClerkProviderConfig = {
  publishableKey: string;
  __internal_clerkJSUrl: string;
  signInUrl: string;
  signUpUrl: string;
  signInFallbackRedirectUrl: string;
  signUpFallbackRedirectUrl: string;
};

/**
 * Central Clerk `<ClerkProvider />` config for applyfy.net.
 *
 * Auth will not work until `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` decodes to a live
 * Clerk Frontend API host (not `*.amplifyapp.com`). Regenerate keys in Clerk
 * Dashboard after setting Production URL to https://applyfy.net.
 */
export function getClerkProviderProps(): ClerkProviderConfig {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required. Add it in Vercel → Settings → Environment Variables.",
    );
  }

  const embeddedHost = clerkFrontendApiHostFromPublishableKey(publishableKey);
  if (publishableKeyUsesAmplifyHost(publishableKey) && embeddedHost) {
    console.error(
      `[Applyfy] Clerk publishable key points at "${embeddedHost}" (old Amplify). ` +
        `Regenerate keys in Clerk Dashboard with Production URL ${getSiteUrl()} — ` +
        "then update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in Vercel.",
    );
  }

  return {
    publishableKey,
    __internal_clerkJSUrl: CLERK_JS_CDN,
    signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL?.trim() || "/sign-in",
    signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL?.trim() || "/sign-up",
    signInFallbackRedirectUrl:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL?.trim() || "/dashboard",
    signUpFallbackRedirectUrl:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL?.trim() || "/dashboard",
  };
}
