import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinote — AI Clinical Scribe",
  description:
    "A consent-first ambient clinical documentation workspace for clinician-reviewed notes.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Clinote — AI Clinical Scribe",
    description: "From conversation to clinician-reviewed note, with consent and safety built in.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinote — AI Clinical Scribe",
    description: "Consent-first clinical documentation for focused care.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
