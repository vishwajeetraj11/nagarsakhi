export type UserRole = "citizen" | "parshad" | "corporation_admin";

export type IssueStatus = "requested" | "in_progress" | "completed" | "rejected";

export type EscalationStatus = "open" | "acknowledged" | "resolved";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type Municipality = {
  id: string;
  name: string;
  district: string;
  state: string;
  wardCount: number;
};

export type Ward = {
  id: string;
  municipalityId: string;
  number: number;
  name: string;
  allocatedBudget: number;
  spentBudget: number;
};

export type PublicProfile = {
  id: string;
  name: string;
  role: UserRole;
  wardId: string | null;
};

export type PrivateCitizenProfile = {
  profileId: string;
  phone: string;
  houseNumber: string;
};

export type Official = {
  id: string;
  municipalityId: string;
  wardId: string | null;
  name: string;
  roleLabel: string;
  department?: string;
  wonByVotes?: number;
  current: boolean;
};

export type IssueMedia = {
  id: string;
  kind: "photo" | "video" | "audio";
  url: string;
  alt?: string;
};

export type Issue = {
  id: string;
  municipalityId: string;
  wardId: string;
  reporterId: string;
  reporterName: string;
  title: string;
  description: string;
  originalLanguage: "en" | "hi";
  status: IssueStatus;
  rejectionReason?: string;
  rejectionActorName?: string;
  rejectionAt?: string;
  upvotes: number;
  downvotes: number;
  viewerVote: -1 | 0 | 1;
  media: IssueMedia[];
  createdAt: string;
  updatedAt: string;
  escalated: boolean;
  escalationStatus?: EscalationStatus;
};

export type Notice = {
  id: string;
  municipalityId: string;
  wardId: string | null;
  authorName: string;
  title?: string;
  body: string;
  createdAt: string;
};

export type Alert = {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  wardIds: string[];
  completed: boolean;
};

export type Expenditure = {
  id: string;
  wardId: string;
  amount: number;
  description: string;
  spentAt: string;
};

export type Escalation = {
  id: string;
  issueId: string;
  issueTitle: string;
  wardId: string;
  wardNumber: number;
  parshadName: string;
  reason: string;
  status: EscalationStatus;
  createdAt: string;
};

export type DemoSession = {
  profileId: string;
  name: string;
  role: UserRole;
  wardId: string | null;
  municipalityId: string;
};
