import type { ReactNode } from "react";

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
};

export function AppShell({ children, session }: AppShellProps) {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="brand-lockup brand-lockup--compact">
            <span className="brand-mark" aria-hidden="true">न</span>
            <span>NagarSakhi</span>
          </div>
          <div className="session-context">
            <span className="role-chip">{roleLabel[session.role]}</span>
            <span className="session-name">{session.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div id="main-content">{children}</div>
    </div>
  );
}
