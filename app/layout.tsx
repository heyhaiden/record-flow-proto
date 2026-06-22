import type { Metadata } from "next";
import { Caveat, Inter, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { VisitStoreProvider } from "@/lib/store/visit-store";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const splineSansMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Record Flow",
  description:
    "Voice-driven BNG/PEA field capture — record on site, finish the report before you leave.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.className} ${caveat.className} ${splineSansMono.className}`}
      >
        <VisitStoreProvider>
          <AppShell>{children}</AppShell>
        </VisitStoreProvider>
      </body>
    </html>
  );
}
