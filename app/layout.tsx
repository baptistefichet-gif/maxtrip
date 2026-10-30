import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://maxtrip.fr"),
  title: "MaxTrip — Les voyages MAX à portée de main",
  description: "Trouve où partir avec TGV MAX : découvre les destinations accessibles depuis ta gare et cherche un aller-retour pour le week-end.",
  robots: { index: true, follow: true },
  applicationName: "MaxTrip",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "fr_FR", siteName: "MaxTrip",
    title: "MaxTrip — Les voyages MAX à portée de main",
    description: "Découvre les destinations accessibles avec TGV MAX.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MaxTrip" }]
  },
  twitter: { card: "summary_large_image" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#142d4e"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
