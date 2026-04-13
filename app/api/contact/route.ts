import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const CONTACT_INBOX =
  process.env.CONTACT_TO_EMAIL?.trim() || "applyfy0@gmail.com";

const SUBJECTS = new Set([
  "Subscription Question",
  "Bug Report",
  "General",
]);

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const subject = typeof o.subject === "string" ? o.subject.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";

  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (!SUBJECTS.has(subject)) {
    return NextResponse.json({ error: "Invalid subject." }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json(
      { error: "Message must be at least 10 characters." },
      { status: 400 },
    );
  }
  if (message.length > 20000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const fromEmail =
    process.env.RESULTS_FROM_EMAIL?.trim() ??
    "Applyfy <no-reply@applyfy.app>";

  if (!resendKey) {
    return NextResponse.json(
      {
        code: "EMAIL_NOT_CONFIGURED",
        error:
          "Email sending is not configured. Add RESEND_API_KEY and RESULTS_FROM_EMAIL to .env.local (see env.example), then restart the dev server.",
      },
      { status: 503 },
    );
  }

  const mailSubject = `[Applyfy Contact] ${subject}`;
  const text = [
    `From: ${name} <${email}>`,
    `Subject category: ${subject}`,
    "",
    message,
  ].join("\n");

  const html = `
<h2>Applyfy contact form</h2>
<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
<p><strong>Category:</strong> ${escapeHtml(subject)}</p>
<hr />
<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(message)}</pre>
`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [CONTACT_INBOX],
      reply_to: email,
      subject: mailSubject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `Could not send message. ${err}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
