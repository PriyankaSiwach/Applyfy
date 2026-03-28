import { NextResponse } from "next/server";
import { parseResumeJobBody } from "@/lib/parseResumeJobBody";

function mockCoverLetter(jobLink: string) {
  const snippets = [
    "I am excited to apply for this opportunity and believe my experience aligns strongly with your needs.",
    "In recent roles I have shipped user-facing features end-to-end, collaborating closely with design and backend teams.",
    "I thrive in environments that value clear communication, fast iteration, and measurable outcomes.",
  ];
  const pick = [...snippets].sort(() => Math.random() - 0.5).slice(0, 2);

  return [
    "Dear Hiring Manager,",
    "",
    `I am writing regarding the role (reference: ${jobLink}).`,
    "",
    pick.join(" "),
    "",
    "I would welcome the chance to discuss how I can contribute to your team.",
    "",
    "Sincerely,",
    "[Your Name]",
  ].join("\n");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseResumeJobBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }

  return NextResponse.json({ letter: mockCoverLetter(parsed.jobLink) });
}
