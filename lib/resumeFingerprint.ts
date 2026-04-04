import { createHash } from "node:crypto";

/** Non-PII fingerprint for logs: length + first 16 hex chars of SHA-256. */
export function resumeTextFingerprint(resumeText: string): {
  length: number;
  sha256Prefix: string;
} {
  return {
    length: resumeText.length,
    sha256Prefix: createHash("sha256")
      .update(resumeText, "utf8")
      .digest("hex")
      .slice(0, 16),
  };
}
