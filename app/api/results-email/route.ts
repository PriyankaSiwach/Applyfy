import { NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESULTS_FROM_EMAIL =
  process.env.RESULTS_FROM_EMAIL ?? "Applyfy <no-reply@applyfy.app>";

type ResultsPayload = {
  to: string;
  keywords: string[];
  matchScore: number;
  coverLetter: string;
  interviewQuestions: string[];
};

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const o = body as Partial<ResultsPayload>;
  const to = typeof o.to === "string" ? o.to.trim() : "";
  const keywords = Array.isArray(o.keywords)
    ? o.keywords.filter((k): k is string => typeof k === "string")
    : [];
  const interviewQuestions = Array.isArray(o.interviewQuestions)
    ? o.interviewQuestions.filter((q): q is string => typeof q === "string")
    : [];
  const coverLetter = typeof o.coverLetter === "string" ? o.coverLetter.trim() : "";
  const matchScore =
    typeof o.matchScore === "number" && Number.isFinite(o.matchScore)
      ? o.matchScore
      : NaN;

  if (!isEmail(to)) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!Number.isFinite(matchScore)) {
    return NextResponse.json(
      { error: "Match score is required." },
      { status: 400 },
    );
  }
  if (!coverLetter) {
    return NextResponse.json(
      { error: "Cover letter is required." },
      { status: 400 },
    );
  }
  if (keywords.length === 0 || interviewQuestions.length === 0) {
    return NextResponse.json(
      { error: "Incomplete results payload." },
      { status: 400 },
    );
  }
  if (!RESEND_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Email service is not configured. Set RESEND_API_KEY and RESULTS_FROM_EMAIL.",
      },
      { status: 503 },
    );
  }

  const text = [
    "Applyfy Results",
    "",
    "Keywords",
    keywords.map((k) => `- ${k}`).join("\n"),
    "",
    `Match score: ${Math.round(matchScore)}%`,
    "",
    "Cover letter",
    coverLetter,
    "",
    "Interview questions",
    interviewQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
  ].join("\n");

  const html = `
<h2>Applyfy Results</h2>
<h3>Keywords</h3>
<ul>${keywords.map((k) => `<li>${k}</li>`).join("")}</ul>
<h3>Match score</h3>
<p><strong>${Math.round(matchScore)}%</strong></p>
<h3>Cover letter</h3>
<pre style="white-space:pre-wrap;font-family:inherit;">${coverLetter.replace(/</g, "&lt;")}</pre>
<h3>Interview questions</h3>
<ol>${interviewQuestions.map((q) => `<li>${q}</li>`).join("")}</ol>
`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESULTS_FROM_EMAIL,
      to: [to],
      subject: "Your Applyfy results",
      html,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `Email send failed: ${err}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

