/**
 * Turns an uploaded resume file into a string for `/api/analyze`:
 * plain text for .txt/.md, data URL for PDF/DOCX (server extracts text).
 */
export async function resumeFileToPayload(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
