import { cookies } from "next/headers";

import { AppShell } from "@/components/shell/AppShell";
import { DemoLogin } from "@/components/shell/DemoLogin";
import { LiveLogin } from "@/components/shell/LiveLogin";
import { getPublicDemoData } from "@/data/demo";
import { CorporationExperience, ParshadExperience } from "@/features/admin";
import { CitizenExperience } from "@/features/citizen/CitizenExperience";
import { getDemoSession } from "@/lib/auth/session";
import { loadLiveData } from "@/lib/data/live";
import { createServerSupabaseClient, getRuntimeEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const env = getRuntimeEnv();
  let data = getPublicDemoData();
  let session;

  if (env.dataMode === "supabase") {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient({
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
    }, env);

    if (!supabase) {
      return <LiveLogin />;
    }

    const result = await loadLiveData(supabase);
    if (!result.ok) {
      if (result.error.code === "UNAUTHENTICATED") return <LiveLogin />;
      return (
        <main className="login-page" id="main-content">
          <section className="login-intro">
            <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">न</span><span>NagarSakhi</span></div>
            <p className="eyebrow">Live municipality record</p>
            <h1>We could not open your civic workspace.</h1>
            <p className="login-lede">{result.error.message}</p>
          </section>
        </main>
      );
    }

    data = result.data;
    session = result.session;
  } else {
    session = await getDemoSession();
    if (!session) return <DemoLogin />;
  }

  const dataMode = env.dataMode;

  const experience = {
    citizen: <CitizenExperience data={data} dataMode={dataMode} session={session} />,
    parshad: <ParshadExperience data={data} dataMode={dataMode} session={session} />,
    corporation_admin: <CorporationExperience data={data} dataMode={dataMode} session={session} />,
  }[session.role];

  return <AppShell dataMode={dataMode} session={session}>{experience}</AppShell>;
}
