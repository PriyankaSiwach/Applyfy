/**
 * Clerk publishable keys embed the Frontend API host (base64 after `pk_live_` / `pk_test_`).
 * e.g. `pk_live_...` → `clerk.d2xau1h8z2np71.amplifyapp.com`
 */
export function clerkFrontendApiHostFromPublishableKey(
  publishableKey: string,
): string | null {
  const prefix = publishableKey.startsWith("pk_live_")
    ? "pk_live_"
    : publishableKey.startsWith("pk_test_")
      ? "pk_test_"
      : null;
  if (!prefix) return null;
  try {
    const b64 = publishableKey.slice(prefix.length);
    const decoded = Buffer.from(b64, "base64").toString("utf8").trim();
    return decoded.replace(/\$$/, "") || null;
  } catch {
    return null;
  }
}

export function publishableKeyUsesAmplifyHost(publishableKey: string): boolean {
  const host = clerkFrontendApiHostFromPublishableKey(publishableKey);
  return Boolean(host?.includes("amplifyapp.com"));
}
