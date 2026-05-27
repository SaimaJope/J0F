import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: "JobFuture Oy. Tekniset palvelut, konsultointi ja tarvikemyynti.",
  description:
    "JobFuture Oy tarjoaa sähkö-, tele-, LVI- ja kylmätekniikkaan liittyviä palveluita, konsultointia ja tarvikemyyntiä tarjousten perusteella.",
  metadataBase: new URL("https://jobfuture.fi"),
  openGraph: {
    title: "JobFuture Oy",
    description:
      "Teknisiä palveluita, konsultointia ja tarvikemyyntiä. Oravikoski, Pohjois-Savo.",
    type: "website",
    locale: "fi_FI"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fi" className={`${sans.variable} ${display.variable}`}>
      <body className="bg-canvas text-ink">{children}</body>
    </html>
  );
}
