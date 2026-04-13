import { isSectionHeader } from "@/lib/resumeEditorBlocks";

/**
 * Generate and download a clean single-page-style resume PDF from plain text.
 * Uses jsPDF (already in dependencies). Dynamic import avoids SSR issues.
 */
export async function downloadResumePdf(
  resumePlainText: string,
  filename = "resume.pdf",
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const pageW = 210; // A4 mm
  const pageH = 297;
  const marginL = 16;
  const marginR = 16;
  const marginT = 18;
  const marginB = 16;
  const contentW = pageW - marginL - marginR;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = marginT;

  const checkNewPage = (neededMm: number) => {
    if (y + neededMm > pageH - marginB) {
      doc.addPage();
      y = marginT;
    }
  };

  const lines = resumePlainText.replace(/\r\n/g, "\n").split("\n");
  let lineIdx = 0;

  // ── Name (first non-empty line, large bold centered) ──────────────────────
  while (lineIdx < lines.length && !lines[lineIdx]!.trim()) lineIdx++;
  if (lineIdx < lines.length) {
    const name = lines[lineIdx]!.trim();
    if (name && !isSectionHeader(name)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text(name, pageW / 2, y, { align: "center" });
      y += 8;
      lineIdx++;
    }
  }

  // ── Contact lines (next 1-5 short non-section lines) ─────────────────────
  let contactCount = 0;
  while (lineIdx < lines.length && contactCount < 5) {
    const l = lines[lineIdx]!.trim();
    if (!l) { lineIdx++; contactCount++; continue; }
    if (isSectionHeader(l)) break;
    // Stop at what looks like a long narrative line (summary body)
    if (l.length > 90) break;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(l, pageW / 2, y, { align: "center" });
    y += 4.2;
    lineIdx++;
    contactCount++;
  }

  y += 2; // gap after header block

  // ── Body ──────────────────────────────────────────────────────────────────
  for (let i = lineIdx; i < lines.length; i++) {
    const raw = lines[i]!;
    const t = raw.trim();

    if (!t) {
      y += 2;
      continue;
    }

    // Section header — bold, small underline rule
    if (isSectionHeader(t)) {
      y += 3;
      checkNewPage(11);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(t, marginL, y);
      y += 1.5;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.line(marginL, y, pageW - marginR, y);
      y += 3.5;
      continue;
    }

    // Bullet point
    if (t.startsWith("•")) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const wrapped = doc.splitTextToSize(t, contentW - 3);
      for (const wl of wrapped as string[]) {
        checkNewPage(4.5);
        doc.text(wl, marginL + 2, y);
        y += 4.3;
      }
      continue;
    }

    // Check if the line looks like a bold sub-header (short, no lowercase starter,
    // followed by a date or company pattern) — treat as semi-bold
    const looksLikeBold =
      t.length < 80 &&
      (
        /[A-Z]{2,}/.test(t.slice(0, 6)) || // starts with ALL-CAPS word
        /^[A-Z][^a-z]{0,15}[A-Z]/.test(t)  // title-like
      );

    doc.setFont("helvetica", looksLikeBold ? "bold" : "normal");
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(t, contentW);
    for (const wl of wrapped as string[]) {
      checkNewPage(4.5);
      doc.text(wl, marginL, y);
      y += 4.3;
    }
  }

  doc.save(filename);
}
