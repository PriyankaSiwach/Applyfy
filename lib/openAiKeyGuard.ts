import { getOpenAiApiKey, openAiEnvLooksLikePlaceholder } from "@/lib/getOpenAiApiKey";
import {
  OPENAI_API_KEY_PLACEHOLDER_MESSAGE,
  OPENAI_API_KEY_SETUP_MESSAGE,
} from "@/lib/missingOpenAiKeyMessage";

export function requireOpenAiApiKey():
  | { ok: true; key: string }
  | { ok: false; error: string } {
  const key = getOpenAiApiKey();
  if (key) return { ok: true, key };
  return {
    ok: false,
    error: openAiEnvLooksLikePlaceholder()
      ? OPENAI_API_KEY_PLACEHOLDER_MESSAGE
      : OPENAI_API_KEY_SETUP_MESSAGE,
  };
}
