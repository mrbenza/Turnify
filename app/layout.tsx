import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { Analytics } from '@vercel/analytics/react'; // Nota: usa /react o /next è indifferente nelle versioni recenti

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Turnify",
  description: "Gestione turni di reperibilità",
  manifest: "/manifest.webmanifest",
  applicationName: "Turnify",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Turnify",
  },
};

export const viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} antialiased`}
      >
        <AuthGuard />
        <ServiceWorkerRegistrar />
        {children}
        <PwaInstallPrompt />
        <PushNotificationPrompt />
        <Analytics />
      </body>
    </html>
  );
}
