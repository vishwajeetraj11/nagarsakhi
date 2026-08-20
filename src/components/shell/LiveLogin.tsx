"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase";

type LoginStage = "phone" | "code";
type LoginState = "idle" | "sending" | "verifying" | "error";

export function LiveLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<LoginStage>("phone");
  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("");

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = createBrowserSupabaseClient();
    if (!client) {
      setState("error");
      setMessage("Live sign-in is not configured in this browser.");
      return;
    }
    if (!phone.trim()) {
      setState("error");
      setMessage("Enter the mobile number linked to your NagarSakhi account.");
      return;
    }

    setState("sending");
    setMessage("");
    const { error } = await client.auth.signInWithOtp({
      phone: phone.trim(),
      options: { shouldCreateUser: false },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }
    setOtp("");
    setStage("code");
    setState("idle");
    setMessage("We sent a six-digit verification code to your mobile number.");
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = createBrowserSupabaseClient();
    if (!client) {
      setState("error");
      setMessage("Live sign-in is not configured in this browser.");
      return;
    }
    if (otp.length !== 6) {
      setState("error");
      setMessage("Enter the six-digit verification code.");
      return;
    }

    setState("verifying");
    setMessage("");
    const { error } = await client.auth.verifyOtp({ phone: phone.trim(), token: otp, type: "sms" });
    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }
    router.refresh();
  }

  const busy = state === "sending" || state === "verifying";

  return (
    <main className="login-page" id="main-content">
      <section className="login-intro" aria-labelledby="live-welcome-title">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">न</span><span>NagarSakhi</span></div>
        <p className="eyebrow">Your ward, in the open</p>
        <h1 id="live-welcome-title">Sign in to see your municipality’s public record.</h1>
        <p className="login-lede">Use the mobile number registered with NagarSakhi. We will send a one-time verification code.</p>
        <div className="civic-rule" aria-hidden="true"><span>वार्ड</span><span>Ward</span><span>नगर</span><span>City</span></div>
        <p className="demo-note">Your phone number is used only for sign-in. Public records show names and civic updates, not residents’ contact details.</p>
      </section>

      <section className="login-panel" aria-labelledby="live-signin-title">
        <div><p className="section-kicker">Secure sign-in</p><h2 id="live-signin-title">{stage === "phone" ? "Enter your mobile number" : "Enter your verification code"}</h2></div>
        {stage === "phone" ? (
          <form className="login-form" onSubmit={sendOtp} noValidate>
            <label htmlFor="live-phone">Mobile number</label>
            <input aria-describedby={state === "error" ? "live-login-message" : "live-phone-help"} autoComplete="tel" id="live-phone" inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" required value={phone} />
            <p id="live-phone-help">Include your country code, for example +91.</p>
            <button className="primary-action" disabled={busy} type="submit">{state === "sending" ? "Sending code…" : "Send verification code"}</button>
          </form>
        ) : (
          <form className="login-form" onSubmit={verifyOtp} noValidate>
            <div className="field-heading"><label htmlFor="live-otp">Six-digit verification code</label><button disabled={busy} onClick={() => { setStage("phone"); setState("idle"); setMessage(""); }} type="button">Change number</button></div>
            <input aria-describedby={state === "error" ? "live-login-message" : "live-code-help"} autoComplete="one-time-code" id="live-otp" inputMode="numeric" maxLength={6} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} pattern="[0-9]{6}" required value={otp} />
            <p id="live-code-help">Sent to {phone}.</p>
            <button className="primary-action" disabled={busy} type="submit">{state === "verifying" ? "Verifying…" : "Open NagarSakhi"}</button>
          </form>
        )}
        {message ? <p aria-live="polite" className={state === "error" ? "form-error" : undefined} id="live-login-message" role={state === "error" ? "alert" : undefined}>{message}</p> : null}
      </section>
    </main>
  );
}
