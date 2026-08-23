import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Mukta } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import "./globals.css";

const mukta = Mukta({
  display: "swap",
  subsets: ["devanagari", "latin"],
  variable: "--font-mukta",
  weight: ["400", "600", "700"],
});

const anekDevanagari = Anek_Devanagari({
  display: "swap",
  subsets: ["devanagari", "latin"],
  variable: "--font-anek-devanagari",
});

export const metadata: Metadata = {
  title: "NagarSakhi · Your ward, in the open",
  description: "A transparent, ward-first civic participation demo for Indian municipalities.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#edf3ea",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${mukta.variable} ${anekDevanagari.variable}`}>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          theme="light"
          closeButton
          duration={5200}
          visibleToasts={3}
          offset={{ bottom: "max(1rem, env(safe-area-inset-bottom))", right: "max(1rem, env(safe-area-inset-right))" }}
          mobileOffset={{ bottom: "max(1rem, env(safe-area-inset-bottom))", left: "1rem", right: "1rem" }}
          style={{
            "--normal-bg": "var(--surface)",
            "--normal-border": "var(--line)",
            "--normal-text": "var(--ink)",
            "--success-bg": "var(--green-soft)",
            "--success-border": "var(--green)",
            "--success-text": "oklch(28% .07 175)",
            "--info-bg": "var(--indigo-soft)",
            "--info-border": "var(--indigo)",
            "--info-text": "var(--indigo-strong)",
            "--error-bg": "var(--danger-soft)",
            "--error-border": "var(--danger)",
            "--error-text": "oklch(33% .1 27)",
          } as React.CSSProperties}
        />
      </body>
    </html>
  );
}
