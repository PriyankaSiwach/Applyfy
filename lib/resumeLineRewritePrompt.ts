/** System: keep model output to a single line of bullet text. */
export const RESUME_BULLET_OPTIMIZER_SYSTEM =
  "Reply with only the rewritten bullet as one line. No labels, no quotes, no explanation.";

/** Exact user prompt shape for per-bullet rewrite (bullet text appended at end). */
export function resumeBulletRewriteUserMessage(bulletText: string): string {
  return `Rewrite this resume bullet with a stronger action verb and 
naturally include relevant ATS keywords where they fit. 
Keep all numbers. Return one line only. No explanation.
Bullet: ${bulletText}`;
}
