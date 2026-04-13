/** Shown when no OpenAI key is available in server env (local or deployment). */
export const OPENAI_API_KEY_SETUP_MESSAGE =
  "The OpenAI API key is missing or empty. Add OPENAI_API_KEY=sk-... to .env or .env.local (optional alias: OPENAI_KEY). If you have a line like OPENAI_API_KEY= with nothing after =, delete that line entirely so a key in `.env` can load, or paste your full key after =. Restart npm run dev after saving. For production, set OPENAI_API_KEY in your host (Vercel, Railway, etc.).";

/** Shown when env contains example/placeholder text instead of a real key. */
export const OPENAI_API_KEY_PLACEHOLDER_MESSAGE =
  "Your OpenAI API key looks like a template value (for example sk-your-openai-api-key-here). Replace OPENAI_API_KEY in .env.local with your real sk-... key from https://platform.openai.com/api-keys — no quotes, no spaces around =. Restart npm run dev after saving.";
