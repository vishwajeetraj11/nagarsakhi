"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { demoAccounts } from "@/lib/auth/demo-accounts";

type LoginState = "idle" | "submitting" | "error";

const roleDescriptions = {
  citizen: "Report an issue, support neighbours, and follow Ward 12 work.",
  parshad: "Triage ward requests, publish updates, and record progress.",
  corporation_admin: "Review wards, escalations, spending, and civic compliance.",
} as const;

export function DemoLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState(demoAccounts[0]?.phone ?? "");
  const [otp, setOtp] = useState("123456");
  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/demo-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setState("error");
        setMessage(result.error ?? "We could not open this demo account. Please try again.");
        return;
      }

      router.refresh();
    } catch {
      setState("error");
      setMessage("We could not reach the demo. Check your connection and try again.");
    }
  }

  return (
    <main className="login-page" id="main-content">
      <section className="login-intro" aria-labelledby="welcome-title">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">न</span>
          <span>NagarSakhi</span>
        </div>
        <p className="eyebrow">Your ward, in the open</p>
        <h1 id="welcome-title">Local issues deserve a clear public trail.</h1>
        <p className="login-lede">
          Report what needs attention, see who is acting, and follow every update from
          request to completion.
        </p>
        <div className="civic-rule" aria-hidden="true">
          <span>वार्ड</span><span>Ward</span><span>नगर</span><span>City</span>
        </div>
        <p className="demo-note">
          <strong>Demonstration only.</strong> Phusro, every person, and every civic record
          shown here are synthetic examples. This is not an official government service.
        </p>
      </section>

      <section className="login-panel" aria-labelledby="signin-title">
        <div>
          <p className="section-kicker">Choose a viewpoint</p>
          <h2 id="signin-title">Enter the civic demo</h2>
        </div>

        <div className="role-options" role="radiogroup" aria-label="Demo role">
          {demoAccounts.map((account) => {
            const selected = account.phone === phone;
            return (
              <button
                aria-checked={selected}
                className="role-option"
                data-selected={selected}
                key={account.phone}
                onClick={() => setPhone(account.phone)}
                role="radio"
                type="button"
              >
                <span>{account.label}</span>
                <small>{roleDescriptions[account.session.role]}</small>
              </button>
            );
          })}
        </div>

        <form className="login-form" onSubmit={signIn}>
          <label htmlFor="demo-phone">Demo phone number</label>
          <input
            autoComplete="tel"
            id="demo-phone"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            value={phone}
          />

          <div className="field-heading">
            <label htmlFor="demo-otp">Six-digit demo OTP</label>
            <span>Use 123456</span>
          </div>
          <input
            aria-describedby={state === "error" ? "login-error" : undefined}
            autoComplete="one-time-code"
            id="demo-otp"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            value={otp}
          />

          {state === "error" ? (
            <p className="form-error" id="login-error" role="alert">{message}</p>
          ) : null}

          <button className="primary-action" disabled={state === "submitting"} type="submit">
            {state === "submitting" ? "Opening the ward…" : "Open NagarSakhi"}
          </button>
        </form>
      </section>
    </main>
  );
}
