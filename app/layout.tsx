import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import AnalyticsBeacon from "@/components/analytics-beacon";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "600", "700"],
  display: "swap",
  variable: "--font-cormorant",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "AIM Studio",
    template: "%s | AIM Studio",
  },
  description:
    "Cinema about sacrifice, regret, and the people we'd do anything for.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.vercel.app"
  ),
  openGraph: {
    type: "website",
    siteName: "AIM Studio",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
