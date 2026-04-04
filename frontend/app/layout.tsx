import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-editorial",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl || "https://example.com"),
  title: "Roster Riddle",
  description: "A daily pro football player guessing game with saved streaks and spoiler-free sharing.",
  openGraph: {
    title: "Roster Riddle",
    description: "Solve the daily pro football roster puzzle, keep your streak alive, and share spoiler-free results.",
    images: [
      {
        url: "/social-card.svg",
        width: 1200,
        height: 630,
        alt: "Roster Riddle social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Roster Riddle",
    description: "Solve the daily pro football roster puzzle and share the result without spoilers.",
    images: ["/social-card.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
