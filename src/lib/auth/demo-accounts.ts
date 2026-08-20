import type { DemoSession, UserRole } from "@/lib/domain/types";

export type DemoAccount = {
  phone: string;
  label: string;
  session: DemoSession;
};

export const demoAccounts: DemoAccount[] = [
  {
    phone: "+910000000012",
    label: "Citizen · Ward 12",
    session: {
      profileId: "citizen-17",
      name: "Asha Nehru Demo",
      role: "citizen",
      wardId: "ward-12",
      municipalityId: "mun-phusro",
    },
  },
  {
    phone: "+910000001012",
    label: "Parshad · Ward 12",
    session: {
      profileId: "demo-parshad-12",
      name: "Nandita Sample",
      role: "parshad",
      wardId: "ward-12",
      municipalityId: "mun-phusro",
    },
  },
  {
    phone: "+910000002000",
    label: "Corporation official",
    session: {
      profileId: "demo-corporation-admin",
      name: "Arvind Sample",
      role: "corporation_admin",
      wardId: null,
      municipalityId: "mun-phusro",
    },
  },
];

export function getDemoAccountByPhone(phone: string) {
  return demoAccounts.find((account) => account.phone === phone);
}

export function getDemoAccountByRole(role: UserRole) {
  return demoAccounts.find((account) => account.session.role === role);
}
