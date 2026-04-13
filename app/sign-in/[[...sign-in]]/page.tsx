import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

const bullets = [
  "ATS score in under 60 seconds",
  "AI cover letter tailored to every role",
  "Interview prep built from your resume gaps",
];

export default function SignInPage() {
  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] w-full overflow-hidden"
      aria-label="Sign in"
    >
      {/* ── Left branded panel (hidden on mobile) ── */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          background:
            "linear-gradient(160deg, #1a0533 0%, #2e0a60 45%, #160429 100%)",
        }}
      >
        {/* ── Animated blurred orbs ── */}
        <div
          className="pointer-events-none absolute left-[-80px] top-[-80px] h-[480px] w-[480px] rounded-full opacity-40 blur-[120px]"
          style={{
            background: "radial-gradient(circle, #7c3aed 0%, #4c1d95 60%, transparent 100%)",
            animation: "auth-orb-drift-1 18s ease-in-out infinite",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-[-60px] right-[-60px] h-[400px] w-[400px] rounded-full opacity-30 blur-[100px]"
          style={{
            background: "radial-gradient(circle, #a78bfa 0%, #5b21b6 55%, transparent 100%)",
            animation: "auth-orb-drift-2 22s ease-in-out infinite",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-1/3 left-1/3 h-[280px] w-[280px] rounded-full opacity-20 blur-[80px]"
          style={{
            background: "radial-gradient(circle, #c4b5fd 0%, #7c3aed 50%, transparent 100%)",
            animation: "auth-orb-drift-3 26s ease-in-out infinite",
          }}
          aria-hidden
        />

        {/* ── Logo ── */}
        <div
          className="relative z-10"
          style={{
            animation: "auth-panel-in 0.7s cubic-bezier(0.16,1,0.3,1) 0ms forwards",
            opacity: 0,
          }}
        >
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" aria-hidden width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-[family-name:var(--font-plus-jakarta)] text-[22px] font-extrabold leading-none">
              <span className="text-white">Apply</span>
              <span className="text-[#a78bfa]">fy</span>
            </span>
          </Link>
        </div>

        {/* ── Headline + bullets ── */}
        <div className="relative z-10 max-w-[360px]">
          {/* Headline staggered line by line */}
          <h2
            className="font-[family-name:var(--font-plus-jakarta)] text-[40px] font-extrabold leading-[1.1] tracking-tight text-white"
            style={{
              animation: "auth-word-in 0.65s cubic-bezier(0.16,1,0.3,1) 120ms forwards",
              opacity: 0,
            }}
          >
            Your next offer
          </h2>
          <h2
            className="font-[family-name:var(--font-plus-jakarta)] text-[40px] font-extrabold leading-[1.1] tracking-tight"
            style={{
              backgroundImage: "linear-gradient(90deg, #c4b5fd 0%, #a78bfa 60%, #7c3aed 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              animation: "auth-word-in 0.65s cubic-bezier(0.16,1,0.3,1) 220ms forwards",
              opacity: 0,
            }}
          >
            starts here.
          </h2>

          <p
            className="mt-4 text-[15px] leading-relaxed text-[rgba(255,255,255,0.6)]"
            style={{
              animation: "auth-word-in 0.65s cubic-bezier(0.16,1,0.3,1) 320ms forwards",
              opacity: 0,
            }}
          >
            Stop sending the same resume everywhere. Start applying with precision.
          </p>

          {/* Bullet points */}
          <ul className="mt-8 space-y-3.5">
            {bullets.map((b, i) => (
              <li
                key={b}
                className="flex items-center gap-3 text-[14px] font-medium text-[rgba(255,255,255,0.85)]"
                style={{
                  animation: `auth-word-in 0.6s cubic-bezier(0.16,1,0.3,1) ${420 + i * 90}ms forwards`,
                  opacity: 0,
                }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-[#1a0533]"
                  style={{
                    background: "linear-gradient(135deg, #c4b5fd, #a78bfa)",
                  }}
                  aria-hidden
                >
                  ✦
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Footer ── */}
        <div
          className="relative z-10 text-[12px] text-[rgba(255,255,255,0.35)]"
          style={{
            animation: "auth-panel-in 0.7s cubic-bezier(0.16,1,0.3,1) 700ms forwards",
            opacity: 0,
          }}
        >
          © {new Date().getFullYear()} Applyfy · Built for job seekers, by a job seeker.
        </div>
      </div>

      {/* ── Right panel — Clerk form ── */}
      <div className="flex w-full flex-col items-center justify-center bg-[#f5f3ff] px-4 py-10 lg:w-1/2">
        {/* Mobile-only logo */}
        <div
          className="mb-6 lg:hidden"
          style={{
            animation: "auth-card-in 0.45s cubic-bezier(0.16,1,0.3,1) 0ms forwards",
            opacity: 0,
          }}
        >
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" aria-hidden width={26} height={26} className="h-[26px] w-[26px] object-contain" />
            <span className="font-[family-name:var(--font-plus-jakarta)] text-[20px] font-extrabold leading-none">
              <span className="text-[#0f172a]">Apply</span>
              <span className="text-[#7c3aed]">fy</span>
            </span>
          </Link>
        </div>

        {/* Clerk component wrapper */}
        <div
          style={{
            animation: "auth-card-in 0.45s cubic-bezier(0.16,1,0.3,1) 80ms forwards",
            opacity: 0,
          }}
        >
          <SignIn />
        </div>
      </div>
    </main>
  );
}
