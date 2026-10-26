import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "MaxTrip — Les voyages MAX à portée de main",
  description: "Explore les destinations et itinéraires compatibles avec les disponibilités TGV MAX.",
  robots: { index: false, follow: false },
  applicationName: "MaxTrip"
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
