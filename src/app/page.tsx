import { AppShell } from "@/components/shell/AppShell";
import { DemoLogin } from "@/components/shell/DemoLogin";
import { LiveApp } from "@/components/shell/LiveApp";
import { getPublicDemoData } from "@/data/demo";
import { CorporationExperience, ParshadExperience } from "@/features/admin";
import { CitizenExperience } from "@/features/citizen/CitizenExperience";
import { getDemoSession } from "@/lib/auth/session";
import { getRuntimeEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const env = getRuntimeEnv();
  const data = getPublicDemoData();
  let session;

  if (env.dataMode === "supabase") {
    return <LiveApp />;
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
