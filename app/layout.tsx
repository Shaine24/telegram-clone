import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Telegram Web — Fast, secure messaging",
  description:
    "A real-time Telegram-style messenger built with Next.js and Supabase. Sign in, start a chat, and send messages instantly.",
  applicationName: "Telegram Web",
  openGraph: {
    title: "Telegram Web",
    description:
      "A real-time Telegram-style messenger built with Next.js and Supabase.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0c0e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
