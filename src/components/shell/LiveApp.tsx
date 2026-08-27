"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { BrandLockup } from "@/components/shell/BrandLockup";
import { LiveLogin } from "@/components/shell/LiveLogin";
import { LiveOnboarding } from "@/components/shell/LiveOnboarding";
import type { PublicDemoData } from "@/data/demo";
import { CorporationExperience, ParshadExperience } from "@/features/admin";
import { CitizenExperience } from "@/features/citizen/CitizenExperience";
import { MunicipalityPage } from "@/features/municipality/MunicipalityPage";
import { getFirebaseAuth } from "@/lib/firebase";
import { loadLiveData, loadWardIssues, type LiveDataFailure, type WardIssuesResult } from "@/lib/data/live";
import type { DemoSession } from "@/lib/domain/types";
import { createFirebaseSupabaseClient } from "@/lib/supabase";

type LiveState =
  | { status: "checking" }
  | { status: "signed_out" }
  | { status: "onboarding"; user: User; registrationRequired?: boolean }
  | { status: "ready"; data: PublicDemoData; session: DemoSession }
  | { status: "error"; error: LiveDataFailure["error"] };

const SESSION_LOAD_TIMEOUT_MS = 15000;

async function provisionFirebaseProfile(user: User) {
  const supabase = createFirebaseSupabaseClient(() => user.getIdToken(false));
  if (!supabase) {
    return { ok: false as const, message: "Supabase is not configured in this browser." };
  }

  const { data, error } = await supabase.rpc("provision_firebase_profile", {
    display_name: user.displayName || null,
  });

  return error
    ? { ok: false as const, message: error.message }
    : { ok: true as const, registered: Boolean(data), supabase };
}

export function LiveApp() {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const pathname = usePathname();
  const router = useRouter();
  const redirectedAfterLogin = useRef(false);
  const refreshTokenOnLoad = useRef(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [state, setState] = useState<LiveState>(() => (
    auth
      ? { status: "checking" }
      : {
        status: "error",
        error: { code: "UNAUTHENTICATED", message: "Firebase sign-in is not configured." },
      }
  ));

  useEffect(() => {
    if (!auth) {
      return;
    }

    let cancelled = false;
    let request = 0;
    let timeout: number | undefined;
    const startDeadline = () => {
      window.clearTimeout(timeout);
      const current = ++request;
      timeout = window.setTimeout(() => {
        if (cancelled || current !== request) return;
        ++request; // A late response must not overwrite the recovery screen.
        setState({
          status: "error",
          error: {
            code: "QUERY_FAILED",
            message: "Your sign-in session is taking too long to open.",
            detail: "Check your connection, then try again. No ward data has been opened.",
          },
        });
      }, SESSION_LOAD_TIMEOUT_MS);
      return current;
    };
    startDeadline();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      const current = startDeadline();
      const isCurrent = () => !cancelled && current === request;
      if (!user) {
        redirectedAfterLogin.current = false;
        window.clearTimeout(timeout);
        setState({ status: "signed_out" });
        return;
      }

      setState({ status: "checking" });
      try {
        if (refreshTokenOnLoad.current) {
          refreshTokenOnLoad.current = false;
          await user.getIdToken(true);
          if (!isCurrent()) return;
        }
        const provisioned = await provisionFirebaseProfile(user);
        if (!isCurrent()) return;
        if (!provisioned.ok) {
          setState({
            status: "error",
            error: { code: "QUERY_FAILED", message: "Unable to prepare your NagarSakhi profile.", detail: provisioned.message },
          });
          return;
        }

        if (!provisioned.registered) {
          setState({ status: "onboarding", user, registrationRequired: true });
          return;
        }

        const result = await loadLiveData(provisioned.supabase, { firebaseUid: user.uid });
        if (!isCurrent()) return;
        if (!result.ok) {
          setState({ status: "error", error: result.error });
        } else if (result.needsOnboarding) {
          setState({ status: "onboarding", user });
        } else {
          setState({ status: "ready", data: result.data, session: result.session });
        }
      } catch (error) {
        if (!isCurrent()) return;
        setState({
          status: "error",
          error: {
            code: "QUERY_FAILED",
            message: "Your civic workspace could not be loaded.",
            detail: error instanceof Error ? error.message : "Check your connection and try again.",
          },
        });
      } finally {
        if (isCurrent()) window.clearTimeout(timeout);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [auth, sessionAttempt]);

  useEffect(() => {
    if (state.status !== "ready" || redirectedAfterLogin.current) {
      return;
    }

    redirectedAfterLogin.current = true;
    if (pathname === "/" || pathname === "/municipality") {
      router.replace("/municipality/phusro");
    }
  }, [pathname, router, state.status]);

  if (state.status === "signed_out") return <LiveLogin />;

  if (state.status === "onboarding") {
    return (
      <LiveOnboarding
        user={state.user}
        registrationRequired={state.registrationRequired}
        onComplete={() => {
          refreshTokenOnLoad.current = true;
          setState({ status: "checking" });
          setSessionAttempt((attempt) => attempt + 1);
        }}
      />
    );
  }

  if (state.status === "checking") {
    return (
      <main className="login-page live-loading" id="main-content" aria-busy="true">
        <section className="login-intro" aria-labelledby="live-loading-title">
          <BrandLockup />
          <p className="eyebrow">Live municipality record</p>
          <h1 id="live-loading-title">Opening your civic workspace.</h1>
          <p className="login-lede">We are checking your verified mobile number and loading the ward record.</p>
          <div className="loading-register" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
        <section className="login-panel loading-panel" aria-labelledby="loading-status-title">
          <div className="loading-card" role="status" aria-live="polite">
            <div className="loading-seal" aria-hidden="true">
              <span />
            </div>
            <div>
              <p className="section-kicker">Loading / रिकॉर्ड खुल रहा है</p>
              <h2 id="loading-status-title">Preparing your ward record</h2>
              <p className="loading-copy">This can take a few seconds on slower mobile networks.</p>
            </div>
            <ol className="loading-steps">
              <li><span aria-hidden="true" />Verifying mobile session</li>
              <li><span aria-hidden="true" />Opening profile record</li>
              <li><span aria-hidden="true" />Loading ward issues and notices</li>
            </ol>
          </div>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="login-page" id="main-content">
        <section className="login-intro">
          <BrandLockup />
          <p className="eyebrow">Live municipality record</p>
          <h1>We could not open your civic workspace.</h1>
          <p className="login-lede">{state.error.message}</p>
          {state.error.detail ? <p className="demo-note">{state.error.detail}</p> : null}
          {auth ? (
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                setState({ status: "checking" });
                setSessionAttempt((attempt) => attempt + 1);
              }}
            >
              Try again
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  const handleWardIssuesLoad = async (wardId: string): Promise<WardIssuesResult> => {
    const user = auth?.currentUser;
    if (!user) {
      return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in to view this ward." } };
    }
    const supabase = createFirebaseSupabaseClient(() => user.getIdToken(false));
    if (!supabase) {
      return { ok: false, error: { code: "QUERY_FAILED", message: "Supabase is not configured in this browser." } };
    }
    return loadWardIssues(supabase, {
      municipalityId: state.session.municipalityId,
      wardId,
      viewerId: state.session.profileId,
    });
  };

  const publicOfficialProfile = pathname?.startsWith("/officials/") === true;
  const municipalityHome = pathname === "/municipality" || pathname === "/municipality/phusro";
  const experience = municipalityHome
    ? <MunicipalityPage data={state.data} session={state.session} />
    : publicOfficialProfile
    ? <CitizenExperience data={state.data} dataMode="supabase" session={state.session} readOnly onWardIssuesLoad={handleWardIssuesLoad} />
    : {
      citizen: <CitizenExperience data={state.data} dataMode="supabase" session={state.session} onWardIssuesLoad={handleWardIssuesLoad} />,
      parshad: <ParshadExperience data={state.data} dataMode="supabase" session={state.session} onWardIssuesLoad={handleWardIssuesLoad} />,
      corporation_admin: <CorporationExperience data={state.data} dataMode="supabase" session={state.session} />,
    }[state.session.role];

  return <AppShell session={state.session} dataMode="supabase">{experience}</AppShell>;
}
