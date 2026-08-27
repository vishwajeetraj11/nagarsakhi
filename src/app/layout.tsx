import type { Metadata, Viewport } from "next";
import { Mukta, Tiro_Devanagari_Hindi } from "next/font/google";
import { Toaster } from "sonner";

import { LiveApp } from "@/components/shell/LiveApp";
import "./globals.css";

const mukta = Mukta({
  display: "swap",
  subsets: ["devanagari", "latin"],
  variable: "--font-mukta",
  weight: ["400", "600"],
});

const editorial = Tiro_Devanagari_Hindi({
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  subsets: ["devanagari", "latin"],
  variable: "--font-editorial",
});

export const metadata: Metadata = {
  title: "NagarSakhi",
  description: "A transparent, ward-first civic participation demo for Indian municipalities.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f0e7",
};

export default function RootLayout() {
  return (
    <html lang="en" className={`${mukta.variable} ${editorial.variable}`}>
      <body>
        <LiveApp />
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
            "--success-text": "var(--green)",
            "--info-bg": "var(--indigo-soft)",
            "--info-border": "var(--indigo)",
            "--info-text": "var(--indigo-strong)",
            "--error-bg": "var(--danger-soft)",
            "--error-border": "var(--danger)",
            "--error-text": "var(--danger)",
          } as React.CSSProperties}
        />
      </body>
    </html>
  );
}
