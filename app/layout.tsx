import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Turnify",
  description: "Gestione turni di reperibilità",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} antialiased`}
      >
        {children}
        <AuthGuard />
      </body>
    </html>
  );
}
