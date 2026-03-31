import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
