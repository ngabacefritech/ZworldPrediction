import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import ServiceWorkerRegister from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pronos Foot — Prédictions football du jour",
    template: "%s · Pronos Foot",
  },
  description:
    "PWA ultra-rapide et hors-ligne : pronostics de matchs de football (1X2, over/under, BTTS, scores exacts) scrapés et structurés depuis betwizad.com/predictions.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pronos Foot",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#020617" }, { color: "#020617" }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
