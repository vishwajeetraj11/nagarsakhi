import type {
  Alert,
  Escalation,
  Expenditure,
  Issue,
  Municipality,
  Notice,
  Official,
  PrivateCitizenProfile,
  PublicProfile,
  Ward,
} from "@/lib/domain/types";

export type PublicDemoData = {
  municipality: Municipality;
  wards: Ward[];
  publicProfiles: PublicProfile[];
  officials: Official[];
  issues: Issue[];
  notices: Notice[];
  alerts: Alert[];
  expenditures: Expenditure[];
  escalations: Escalation[];
};

export type DemoData = PublicDemoData & {
  privateCitizenProfiles: PrivateCitizenProfile[];
};

const municipalityId = "mun-phusro";
const wardId = (number: number) => `ward-${number}`;

export const demoMunicipality: Municipality = {
  id: municipalityId,
  name: "Phusro Nagar Parishad",
  district: "Bokaro",
  state: "Jharkhand",
  wardCount: 28,
};

const wardNames = [
  "Station Road", "Bania Tola", "Gandhi Nagar", "Kargali", "Fusri Bazaar", "Subhash Nagar",
  "Janta Nagar", "New Colony", "Railway Quarter", "Bermo Road", "Shiv Mandir", "Nehru Nagar",
  "Madhukunda", "Khurpania", "Karo", "Gandhi Chowk", "Singarbera", "Azad Nagar", "Central Market",
  "Bokaro River", "Sahijana", "Milan Nagar", "Lalpania Road", "Sundar Nagar", "Kumarpur", "Pragati Nagar",
  "Rajendra Nagar", "Gandhi Maidan",
];

export const demoWards: Ward[] = wardNames.map((name, index) => {
  const number = index + 1;
  const allocatedBudget = number === 7 ? 1860000 : number === 12 ? 2420000 : number === 18 ? 2110000 : 1200000 + number * 35000;
  const spentBudget = number === 7 ? 1135000 : number === 12 ? 1487500 : number === 18 ? 1320000 : 420000 + number * 12000;
  return { id: wardId(number), municipalityId, number, name, allocatedBudget, spentBudget };
});

const nameSeeds = ["Asha", "Bharat", "Chandni", "Devika", "Ehsan", "Farah", "Gopal", "Hina", "Imran", "Jaya", "Kiran", "Leela", "Mohan", "Nisha", "Om", "Pooja"];
const wardCitizenRecords = [7, 12, 18].flatMap((ward) => Array.from({ length: 16 }, (_, index) => {
  const sequence = [7, 12, 18].indexOf(ward) * 16 + index + 1;
  return { id: `citizen-${sequence}`, name: `${nameSeeds[index]} ${ward === 7 ? "Janta" : ward === 12 ? "Nehru" : "Azad"} Demo`, ward };
}));
const citizenById = new Map(wardCitizenRecords.map((citizen) => [citizen.id, citizen]));
const citizenIdForWard = (ward: number, sequence: number) => `citizen-${([7, 12, 18].indexOf(ward) * 16) + sequence}`;
export const demoPublicProfiles: PublicProfile[] = wardCitizenRecords.map(({ id, name, ward }) => ({ id, name, role: "citizen", wardId: wardId(ward) }));
export const demoPrivateCitizenProfiles: PrivateCitizenProfile[] = wardCitizenRecords.map(({ id }, index) => ({ profileId: id, phone: `00000000${String(index + 1).padStart(2, "0")}`, houseNumber: `D-${String(index + 1).padStart(2, "0")}` }));

export const demoOfficials: Official[] = [
  { id: "official-chairperson-current", municipalityId, wardId: null, name: "Sushila Demo", roleLabel: "Chairperson", current: true },
  { id: "official-executive-current", municipalityId, wardId: null, name: "Arvind Sample", roleLabel: "Executive Officer", department: "Municipal Administration", current: true },
  { id: "official-ward7-current", municipalityId, wardId: wardId(7), name: "Meena Placeholder", roleLabel: "Ward Parshad", wonByVotes: 1240, current: true },
  { id: "official-ward7-previous", municipalityId, wardId: wardId(7), name: "Rakesh Demo", roleLabel: "Ward Parshad", wonByVotes: 980, current: false },
  { id: "official-ward12-current", municipalityId, wardId: wardId(12), name: "Nandita Sample", roleLabel: "Ward Parshad", wonByVotes: 1586, current: true },
  { id: "official-ward12-previous", municipalityId, wardId: wardId(12), name: "Salim Placeholder", roleLabel: "Ward Parshad", wonByVotes: 1104, current: false },
  { id: "official-ward18-current", municipalityId, wardId: wardId(18), name: "Kavita Demo", roleLabel: "Ward Parshad", wonByVotes: 1391, current: true },
  { id: "official-ward18-previous", municipalityId, wardId: wardId(18), name: "Madan Sample", roleLabel: "Ward Parshad", wonByVotes: 1210, current: false },
];

const issue = (id: string, ward: number, reporter: number, title: string, description: string, language: "en" | "hi", status: Issue["status"], date: string, escalated = false, media: Issue["media"] = []): Issue => ({
  id, municipalityId, wardId: wardId(ward), reporterId: citizenIdForWard(ward, reporter), reporterName: citizenById.get(citizenIdForWard(ward, reporter))?.name ?? "Community Reporter", title, description, originalLanguage: language, status, upvotes: 3 + reporter, downvotes: reporter % 3, viewerVote: 0, media, createdAt: `${date}T09:00:00Z`, updatedAt: `${date}T15:00:00Z`, escalated,
});

export const demoIssues: Issue[] = [
  issue("issue-01", 12, 1, "Streetlight near Nehru Park is off", "Three lamps are dark after sunset on the park lane.", "en", "requested", "2026-08-02", false, [{ id: "media-01", kind: "photo", url: "/demo/issues/streetlight.svg", alt: "Synthetic illustration of a dark streetlight" }]),
  issue("issue-02", 12, 2, "नाली की सफाई की जरूरत", "बारिश के बाद स्कूल के पास नाली भर गई है।", "hi", "in_progress", "2026-08-03", false),
  issue("issue-03", 7, 3, "Water tanker schedule", "Please publish the weekly tanker route for Janta Nagar.", "en", "completed", "2026-08-04"),
  issue("issue-04", 18, 4, "कूड़ा उठाने वाली गाड़ी नहीं आई", "दो दिनों से गली में कचरा जमा है।", "hi", "requested", "2026-08-05", true),
  issue("issue-05", 12, 5, "Pothole at Ward 12 crossing", "A deep pothole is unsafe for two-wheelers near the bus stop.", "en", "in_progress", "2026-08-06", true, [{ id: "media-02", kind: "photo", url: "/demo/issues/pothole.svg", alt: "Synthetic illustration of a road pothole" }, { id: "media-03", kind: "photo", url: "/demo/issues/pothole-wide.svg", alt: "Synthetic illustration of the Ward 12 crossing" }]),
  issue("issue-06", 18, 6, "पार्क में पानी का नल खराब", "सामुदायिक पार्क का नल पिछले सप्ताह से बंद है।", "hi", "completed", "2026-08-07"),
  issue("issue-07", 7, 7, "Mosquito fogging request", "Residents request fogging before the weekend market.", "en", "requested", "2026-08-08"),
  issue("issue-08", 12, 8, "सड़क पर जलभराव", "मंदिर वाली गली में बारिश का पानी निकल नहीं रहा।", "hi", "in_progress", "2026-08-09"),
  issue("issue-09", 18, 9, "Broken bench in community park", "One bench has a loose plank and should be repaired.", "en", "completed", "2026-08-10"),
  issue("issue-10", 7, 10, "बाजार में स्ट्रीट लाइट", "मुख्य बाजार की दो लाइटें रात में बंद रहती हैं।", "hi", "requested", "2026-08-11", true),
  issue("issue-11", 12, 11, "Need a pedestrian crossing", "Add visible markings outside the primary health centre.", "en", "in_progress", "2026-08-12"),
  issue("issue-12", 18, 12, "सार्वजनिक शौचालय की सफाई", "साप्ताहिक सफाई और पानी की उपलब्धता सुनिश्चित करें।", "hi", "requested", "2026-08-13"),
];

export const demoNotices: Notice[] = [
  { id: "notice-01", municipalityId, wardId: null, authorName: "Phusro Nagar Parishad", body: "Ward sabha meetings will be held on the second Sunday of every month.", createdAt: "2026-08-01T08:00:00Z" },
  { id: "notice-02", municipalityId, wardId: wardId(12), authorName: "Nandita Sample", body: "वार्ड 12 में सड़क मरम्मत का कार्य 20 अगस्त से शुरू होगा।", createdAt: "2026-08-10T08:00:00Z" },
  { id: "notice-03", municipalityId, wardId: wardId(7), authorName: "Meena Placeholder", body: "Community health camp at Janta Nagar school on 24 August.", createdAt: "2026-08-11T08:00:00Z" },
];

export const demoAlerts: Alert[] = [
  { id: "alert-01", title: "Ward sabha reminder", description: "Share priorities before the monthly ward meeting.", dueAt: "2026-08-23T10:00:00Z", wardIds: [wardId(7), wardId(12), wardId(18)], completed: false },
  { id: "alert-02", title: "Monsoon drain inspection", description: "Inspection checklist due for all low-lying lanes.", dueAt: "2026-08-19T10:00:00Z", wardIds: [wardId(12), wardId(18)], completed: true },
];

export const demoExpenditures: Expenditure[] = [
  { id: "expense-01", wardId: wardId(7), amount: 540000, description: "LED streetlight replacement", spentAt: "2026-07-28" },
  { id: "expense-02", wardId: wardId(12), amount: 825000, description: "Drain desilting and covers", spentAt: "2026-08-04" },
  { id: "expense-03", wardId: wardId(18), amount: 410000, description: "Community park repairs", spentAt: "2026-07-30" },
  { id: "expense-04", wardId: wardId(12), amount: 662500, description: "Crossing and footpath works", spentAt: "2026-08-12" },
];

export const demoEscalations: Escalation[] = [
  { id: "escalation-01", issueId: "issue-05", issueTitle: "Pothole at Ward 12 crossing", wardId: wardId(12), wardNumber: 12, parshadName: "Nandita Sample", reason: "No site update after the response window.", status: "acknowledged", createdAt: "2026-08-10T09:00:00Z" },
  { id: "escalation-02", issueId: "issue-04", issueTitle: "कूड़ा उठाने वाली गाड़ी नहीं आई", wardId: wardId(18), wardNumber: 18, parshadName: "Kavita Demo", reason: "Repeated collection miss reported by residents.", status: "open", createdAt: "2026-08-12T09:00:00Z" },
];

export const demoData: DemoData = { municipality: demoMunicipality, wards: demoWards, publicProfiles: demoPublicProfiles, privateCitizenProfiles: demoPrivateCitizenProfiles, officials: demoOfficials, issues: demoIssues, notices: demoNotices, alerts: demoAlerts, expenditures: demoExpenditures, escalations: demoEscalations };

export const getPublicDemoData = (): PublicDemoData => ({ municipality: demoMunicipality, wards: demoWards, publicProfiles: demoPublicProfiles, officials: demoOfficials, issues: demoIssues, notices: demoNotices, alerts: demoAlerts, expenditures: demoExpenditures, escalations: demoEscalations });
export const getWard = (number: number) => demoWards.find((ward) => ward.number === number);
export const getWardIssues = (number: number) => demoIssues.filter((item) => item.wardId === wardId(number));
export const getWardOfficials = (number: number) => demoOfficials.filter((official) => official.wardId === wardId(number));
export const getWardBudget = (number: number) => { const ward = getWard(number); return ward ? { allocated: ward.allocatedBudget, spent: ward.spentBudget, remaining: ward.allocatedBudget - ward.spentBudget } : null; };
export const getPrivateCitizenProfile = (profileId: string) => demoPrivateCitizenProfiles.find((profile) => profile.profileId === profileId);
