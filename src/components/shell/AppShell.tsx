import type { ReactNode } from "react";
import Link from "next/link";

import type { DemoSession } from "@/lib/domain/types";

import { BrandLockup } from "./BrandLockup";
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
  readOnly?: boolean;
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

export function AppShell({ children, session, dataMode = "supabase", readOnly = false }: AppShellProps) {
  const homeHref = readOnly && dataMode === "demo" ? "/overview?demo=ward-7" : "/municipality/phusro";
  const publicDemo = readOnly && dataMode === "demo";

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="app-header">
        <div className="app-header__inner">
          <Link href={homeHref} aria-label="Open Phusro Nagar Parishad home">
            <BrandLockup compact />
          </Link>
          <div className="session-context">
            {!publicDemo && <span className="role-chip">{roleLabel[session.role]}</span>}
            <span className="session-name">{publicDemo ? "Ward 7" : session.name}</span>
            {readOnly ? <span className="role-chip">{publicDemo ? "Read-only" : "Read-only demo"}</span> : <SignOutButton />}
          </div>
        </div>
      </header>
      <div id="main-content">{children}</div>
      <AppFooter dataMode={dataMode} />
    </div>
  );
}
