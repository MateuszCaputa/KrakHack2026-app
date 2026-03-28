import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Process Copilot — KrakHack 2026",
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
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <h1 className="text-lg font-semibold tracking-tight font-[family-name:var(--font-geist-sans)]">
              Process Copilot
            </h1>
            <span className="text-xs text-zinc-500 font-[family-name:var(--font-geist-mono)]">
              KrakHack 2026
            </span>
          </div>
        </header>
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600">
          Process-to-Automation Copilot — KrakHack 2026 | Powered by pm4py + Gemini
        </footer>
      </body>
    </html>
  );
}
