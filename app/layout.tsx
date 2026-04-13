import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Only `/` and `/dashboard` may use dark — matches ThemeProvider + ThemeDocumentSync. */
const themeInitScript = `(function(){try{var k='applyfy-theme';var p=(typeof location!=='undefined'?location.pathname:'')||'';var allow=p==='/'||p==='/dashboard';if(localStorage.getItem(k)==='dark'&&allow)document.documentElement.classList.add('dark');}catch(e){}})();`;

const metadataBaseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: {
    default: "Applyfy — AI-powered job application suite",
    template: "%s · Applyfy",
  },
  description:
    "Upload your resume and a job listing URL. Get a match score, gap analysis, tailored cover letter, and interview prep.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Theme init in <head> before paint. Dark class only when path is `/` or `/dashboard` (matches ThemeProvider). */}
        <script id="applyfy-theme-init" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Plus Jakarta Sans 400/700: next/font/google below + Google Fonts (navbar wordmark) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <meta property="og:image" content="/logo.png" />
        <meta property="og:title" content="Applyfy" />
        <link rel="icon" href="/logo.png" />
      </head>
      <body
        className={`${inter.className} flex min-h-full flex-col font-sans antialiased [-webkit-font-smoothing:antialiased] transition-[background-color,color,border-color] duration-300 ease-out`}
      >
        <ClerkProvider>
          <AppProviders>{children}</AppProviders>
        </ClerkProvider>
      </body>
    </html>
  );
}
