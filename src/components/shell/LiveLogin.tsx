"use client";

import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { getFirebaseAuth } from "@/lib/firebase";
import { BrandLockup } from "./BrandLockup";
import styles from "./LiveLogin.module.css";

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
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  const [stage, setStage] = useState<LoginStage>("phone");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("error");
  const [resendSeconds, setResendSeconds] = useState(0);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const recaptcha = useRef<RecaptchaVerifier | null>(null);
  const recaptchaRender = useRef<Promise<number> | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const otp = otpDigits.join("");

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const resetRecaptcha = () => {
    const verifier = recaptcha.current;
    recaptcha.current = null;
    recaptchaRender.current = null;
    try {
      verifier?.clear();
    } catch {
      // The verifier may already have been detached by the reCAPTCHA iframe.
    }

    // Ensure the next verifier starts with the empty container Firebase requires.
    document.getElementById("firebase-recaptcha")?.replaceChildren();
  };

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    // Defer one frame so React's development-only effect replay cannot leave
    // two verifiers rendering into the same container.
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled || recaptcha.current) return;

      document.getElementById("firebase-recaptcha")?.replaceChildren();
      const verifier = new RecaptchaVerifier(auth, "firebase-recaptcha", {
        "expired-callback": () => {
          resetRecaptcha();
          setStage("phone");
          setMessageTone("error");
          setMessage("The app verification expired. Complete the check again to request a new code.");
        },
        size: "normal",
      });
      recaptcha.current = verifier;
      recaptchaRender.current = verifier.render();
      recaptchaRender.current.catch(() => {
        if (recaptcha.current === verifier) {
          resetRecaptcha();
          setMessageTone("error");
          setMessage("The app verification could not load. Refresh and try again.");
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      const verifier = recaptcha.current;
      recaptcha.current = null;
      recaptchaRender.current = null;
      try {
        verifier?.clear();
      } catch {
        // Firebase can race React's DOM cleanup after a solved challenge.
      }
      document.getElementById("firebase-recaptcha")?.replaceChildren();
    };
  }, []);

  async function requestOtp() {
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
      if (!recaptcha.current) {
        recaptcha.current = new RecaptchaVerifier(auth, "firebase-recaptcha", {
          "expired-callback": () => {
            resetRecaptcha();
            setStage("phone");
            setMessageTone("error");
            setMessage("The app verification expired. Complete the check again to request a new code.");
          },
          size: "normal",
        });
        recaptchaRender.current = recaptcha.current.render();
      }
      if (recaptchaRender.current) await recaptchaRender.current;
      confirmation.current = await signInWithPhoneNumber(auth, `+91${phone}`, recaptcha.current);
      // The verifier is only needed to request the SMS. Clear it before moving
      // to OTP so a Google iframe cannot outlive this login step.
      resetRecaptcha();
      setOtpDigits(Array.from({ length: 6 }, () => ""));
      setStage("code");
      setResendSeconds(30);
      setMessageTone("success");
      setMessage("Code sent. Enter the six digits from the SMS.");
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (error) {
      resetRecaptcha();
      setStage("phone");
      setMessageTone("error");
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestOtp();
  }

  async function resendOtp() {
    if (resendSeconds > 0 || busy) return;
    await requestOtp();
  }

  const updateOtp = (index: number, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 6);
    if (!digits) {
      setOtpDigits((current) => current.map((digit, digitIndex) => digitIndex === index ? "" : digit));
      return;
    }
    setOtpDigits((current) => {
      const next = [...current];
      digits.split("").forEach((digit, offset) => {
        if (index + offset < 6) next[index + offset] = digit;
      });
      return next;
    });
    otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    updateOtp(0, event.clipboardData.getData("text"));
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

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
    <main className={styles.page} id="main-content">
      <section className={styles.intro} aria-labelledby="live-welcome-title">
        <BrandLockup className={styles.brand} />
        <div className={styles.introContent}>
          <p className={styles.lede}>Only residents verified by their Nagar Parishad can sign in.</p>
          <h1 id="live-welcome-title" className={styles.headline}>
            <span>Your ward,</span>
            <em>in the open.</em>
          </h1>
          <ul className={styles.capabilities} aria-label="Inside NagarSakhi">
            <li><span aria-hidden="true">01</span> Report issues</li>
            <li><span aria-hidden="true">02</span> Follow progress</li>
            <li><span aria-hidden="true">03</span> See public spending</li>
          </ul>
        </div>
        <footer className={styles.footer}>
          <ShieldCheck aria-hidden="true" size={17} />
          Private sign-in. Public accountability.
        </footer>
      </section>

      <section className={styles.panel} aria-labelledby="live-signin-title">
        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <p className={styles.eyebrow}>Resident sign-in</p>
            <h2 id="live-signin-title">{stage === "phone" ? "A closer connection to your ward." : "Check your messages."}</h2>
            {stage === "code" ? <p>Enter the six-digit code sent to your mobile number to continue.</p> : null}
          </div>
          <ol className={styles.steps} aria-label="Sign-in progress">
            <li aria-current={stage === "phone" ? "step" : undefined} data-complete={stage === "code"}>
              <span aria-hidden="true">{stage === "code" ? "✓" : "1"}</span>
              Mobile number
            </li>
            <li aria-current={stage === "code" ? "step" : undefined}>
              <span aria-hidden="true">2</span>
              Verify OTP
            </li>
          </ol>
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
                placeholder="10-digit mobile number"
                required
                value={phone}
              />
            </div>
            <div className="recaptcha-wrap" id="firebase-recaptcha" />
            <button className="primary-action" disabled={busy} type="submit">
              <ShieldCheck aria-hidden="true" size={18} />
              {busy ? "Sending code..." : "Get OTP"}
            </button>
          </form>
          ) : (
          <form className="login-form otp-form" onSubmit={verifyOtp}>
            <div className="otp-heading">
              <div>
                <label htmlFor="live-otp">Six-digit verification code</label>
                <p>Sent to <span>+91 •••••• {phone.slice(-4)}</span></p>
              </div>
            </div>
            <fieldset className="otp-fieldset">
              <legend className="sr-only">Six-digit verification code</legend>
              <div className="otp-inputs">
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    key={index}
                    ref={(element) => { otpRefs.current[index] = element; }}
                    id={index === 0 ? "live-otp" : undefined}
                    aria-label={`Verification digit ${index + 1} of 6`}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    className="otp-digit"
                    inputMode="numeric"
                    maxLength={1}
                    onChange={(event) => updateOtp(index, event.target.value)}
                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    onPaste={handleOtpPaste}
                    required
                    value={otp[index] ?? ""}
                  />
                ))}
              </div>
            </fieldset>
            <button className="primary-action" disabled={busy || otp.length !== 6} type="submit">
              <CheckCircle2 aria-hidden="true" size={18} />
              {busy ? "Verifying..." : "Enter NagarSakhi"}
            </button>
            <button className="quiet-action resend-action" disabled={busy || resendSeconds > 0} onClick={() => void resendOtp()} type="button">
              {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
            </button>
          </form>
          )}
          {message ? (
            <p aria-live="polite" className={`form-message form-message--${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
