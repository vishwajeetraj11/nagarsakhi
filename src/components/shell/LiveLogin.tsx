"use client";

import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { FormEvent, useRef, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { getFirebaseAuth } from "@/lib/firebase";

type LoginStage = "phone" | "code";
type MessageTone = "error" | "success";

const friendlyAuthError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("auth/invalid-app-credential")) {
    return "Firebase rejected the app verification. Check Authorized domains and complete the reCAPTCHA before trying again.";
  }

  if (message.includes("auth/billing-not-enabled")) {
    return "Firebase billing is not enabled for real SMS. Use a Firebase test number or enable billing.";
  }

  return message || "Could not send the verification code.";
};

export function LiveLogin() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<LoginStage>("phone");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("error");
  const confirmation = useRef<ConfirmationResult | null>(null);
  const recaptcha = useRef<RecaptchaVerifier | null>(null);

  const resetRecaptcha = () => {
    recaptcha.current?.clear();
    recaptcha.current = null;
  };

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const auth = getFirebaseAuth();

    if (!auth) {
      setMessageTone("error");
      setMessage("Firebase sign-in is not configured.");
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      setMessageTone("error");
      setMessage("Enter a 10-digit Indian mobile number.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      resetRecaptcha();
      recaptcha.current = new RecaptchaVerifier(auth, "firebase-recaptcha", {
        "expired-callback": resetRecaptcha,
        size: "normal",
      });
      await recaptcha.current.render();
      confirmation.current = await signInWithPhoneNumber(auth, `+91${phone}`, recaptcha.current);
      setOtp("");
      setStage("code");
      setMessageTone("success");
      setMessage("Code sent. Enter the six digits from the SMS.");
    } catch (error) {
      resetRecaptcha();
      setMessageTone("error");
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!confirmation.current) {
      setMessageTone("error");
      setMessage("Your verification session expired. Request a new code.");
      return;
    }

    if (otp.length !== 6) {
      setMessageTone("error");
      setMessage("Enter the six-digit verification code.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await confirmation.current.confirm(otp);
      setMessageTone("success");
      setMessage("Mobile verified. Opening NagarSakhi...");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "That code was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page live-login" id="main-content">
      <section className="login-intro" aria-labelledby="live-welcome-title">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">न</span>
          <span>NagarSakhi</span>
        </div>
        <p className="eyebrow">Your ward, in the open</p>
        <h1 id="live-welcome-title">Sign in to see your municipality&apos;s public record.</h1>
        <p className="login-lede">Firebase verifies your mobile number; Supabase protects the civic data.</p>
        <div className="civic-rule" aria-hidden="true">
          <span>वार्ड</span>
          <span>Ward</span>
          <span>नगर</span>
          <span>City</span>
        </div>
        <p className="demo-note">Your phone number is used only for sign-in. Public records never expose residents&apos; contact details.</p>
      </section>

      <section className="login-panel" aria-labelledby="live-signin-title">
        <div>
          <p className="section-kicker">Secure sign-in</p>
          <h2 id="live-signin-title">{stage === "phone" ? "Enter your mobile number" : "Enter your verification code"}</h2>
        </div>
        <div className="auth-stepper" aria-label="Sign-in progress">
          <span data-active="true">Mobile</span>
          <span data-active={stage === "code"}>OTP</span>
        </div>
        {stage === "phone" ? (
          <form className="login-form" onSubmit={sendOtp}>
            <label htmlFor="live-phone">Mobile number</label>
            <div className="phone-field">
              <span aria-hidden="true">+91</span>
              <input
                autoComplete="tel-national"
                id="live-phone"
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                pattern="[0-9]{10}"
                placeholder="98765 43210"
                required
                value={phone}
              />
            </div>
            <p>Use the mobile number registered with your municipality.</p>
            <div className="recaptcha-wrap" id="firebase-recaptcha" />
            <button className="primary-action" disabled={busy} type="submit">
              <ShieldCheck aria-hidden="true" size={18} />
              {busy ? "Sending code..." : "Send verification code"}
            </button>
          </form>
        ) : (
          <form className="login-form otp-form" onSubmit={verifyOtp}>
            <div className="otp-heading">
              <div>
                <label htmlFor="live-otp">Six-digit verification code</label>
                <p>Sent to <span>+91 {phone}</span></p>
              </div>
            </div>
            <input
              autoComplete="one-time-code"
              className="otp-input"
              id="live-otp"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              required
              value={otp}
            />
            <button className="primary-action" disabled={busy} type="submit">
              <CheckCircle2 aria-hidden="true" size={18} />
              {busy ? "Verifying..." : "Enter NagarSakhi"}
            </button>
          </form>
        )}
        {message ? (
          <p aria-live="polite" className={`form-message form-message--${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
