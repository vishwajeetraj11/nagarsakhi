import type { ReactNode } from "react";
import Link from "next/link";

import type { DemoSession } from "@/lib/domain/types";

import { SignOutButton } from "./SignOutButton";

const roleLabel = {
  citizen: "Citizen",
  parshad: "Ward Parshad",
  corporation_admin: "Corporation official",
} as const;

type AppShellProps = {
  children: ReactNode;
  session: DemoSession;
  dataMode?: "demo" | "supabase";
};

function AppFooter({ dataMode }: { dataMode: "demo" | "supabase" }) {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <span>{dataMode === "demo" ? "This is a working prototype. All resident data, budget figures, and ward records are synthetic." : "NagarSakhi keeps resident phone and household details outside the public record."}</span>
        <span>© {new Date().getFullYear()} NagarSakhi</span>
      </div>
    </footer>
  );
}

export function AppShell({ children, session, dataMode = "supabase" }: AppShellProps) {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="brand-lockup brand-lockup--compact" href="/municipality/phusro" aria-label="Open Phusro Nagar Parishad home">
            <span className="brand-mark" aria-hidden="true">न</span>
            <span>NagarSakhi</span>
          </Link>
          <div className="session-context">
            <span className="role-chip">{roleLabel[session.role]}</span>
            <span className="session-name">{session.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div id="main-content">{children}</div>
      <AppFooter dataMode={dataMode} />
    </div>
  );
}
