import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
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

const themeInitScript = `(function(){try{var k='applyfy-theme';if(localStorage.getItem(k)==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export const metadata: Metadata = {
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
      <body
        className={`${inter.className} flex min-h-full flex-col font-sans antialiased [-webkit-font-smoothing:antialiased] transition-[background-color,color,border-color] duration-300 ease-out`}
      >
        <Script id="applyfy-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
