import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AnimatedBg } from "@/components/animated-bg";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WorkTrace — KrakHack 2026",
  description: "AI copilot for process mining and automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50">
        <AnimatedBg variant="dashboard" />
        <header className="header-glass border-b border-white/5 px-6 py-4 relative z-10">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm accent-gradient" />
              <h1 className="text-lg font-semibold tracking-tight font-[family-name:var(--font-geist-sans)]">
                WorkTrace
              </h1>
            </div>
            <span className="text-xs text-zinc-500 font-[family-name:var(--font-geist-mono)]">
              KrakHack 2026
            </span>
          </div>
        </header>
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 relative z-10">
          {children}
        </main>
        <footer className="py-4 text-center text-[11px] text-zinc-500 relative z-10">
          WorkTrace — KrakHack 2026 | Powered by pm4py + Gemini
        </footer>
      </body>
    </html>
  );
}
