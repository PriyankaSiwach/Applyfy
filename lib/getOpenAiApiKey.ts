/**
 * Read OpenAI API key at call time (not module load) so `.env.local` changes
 * after dev-server start are less likely to require a full restart.
 * Trims whitespace; supports optional `OPENAI_KEY` alias if `OPENAI_API_KEY` is unset.
 * Rejects empty strings and common template placeholders so a bad `.env.local`
 * line does not override a valid key in `.env`.
 */

const PLACEHOLDER_NORMALIZED = new Set(
  [
    "your_openai_key_here",
    "sk_your_openai_api_key_here",
    "replace_me_with_your_openai_key",
    "sk_replace_with_your_openai_key",
  ].map((s) => s.toLowerCase()),
);

function normalizeKeyForPlaceholderCheck(raw: string): string {
  return raw.trim().toLowerCase().replace(/-/g, "_");
}

function isKnownPlaceholderValue(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  return PLACEHOLDER_NORMALIZED.has(normalizeKeyForPlaceholderCheck(t));
}

/** True when env has non-empty text that matches a known example / placeholder key. */
export function openAiEnvLooksLikePlaceholder(): boolean {
  const p = process.env.OPENAI_API_KEY?.trim() ?? "";
  const a = process.env.OPENAI_KEY?.trim() ?? "";
  return (
    (p.length > 0 && isKnownPlaceholderValue(p)) ||
    (a.length > 0 && isKnownPlaceholderValue(a))
  );
}

export function getOpenAiApiKey(): string | undefined {
  const primary = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (primary && !isKnownPlaceholderValue(primary)) return primary;
  const alias = process.env.OPENAI_KEY?.trim() ?? "";
  if (alias && !isKnownPlaceholderValue(alias)) return alias;
  return undefined;
}
