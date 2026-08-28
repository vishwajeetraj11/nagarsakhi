"use client";

/* Native image elements are intentional here: evidence URLs can be signed R2 or local blob URLs. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  ChevronRight,
  FileQuestion,
  FileText,
  MapPin,
  Play,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  X,
} from "lucide-react";
import { AiJobStatus } from "@/components/ai";
import type { PublicDemoData } from "@/data/demo";
import type { WardIssuesResult } from "@/lib/data/live";
import { createLiveIssue, deleteIssueVote, setIssueVote, uploadLiveIssueMedia } from "@/lib/data/live-mutations";
import type { DemoSession, EscalationStatus, Issue, IssueMedia, IssueStatus } from "@/lib/domain/types";
import { sortIssuesBySupport } from "@/lib/domain/issue-sort";
import { formatWardLabel, wardLocalityName } from "@/lib/domain/ward-label";
import { getFirebaseAuthorizationHeader } from "@/lib/firebase";
import styles from "./citizenStyles";

type View = "home" | "issues" | "report" | "wards" | "profile";
type ReportStage = "form" | "success";
type ToastTone = "error" | "success" | "info";

const viewRoutes: Record<View, string> = {
  home: "/overview",
  issues: "/issues",
  report: "/report",
  wards: "/wards",
  // Kept as a compatibility path for older bookmarks. New links use /officials/:id.
  profile: "/parshad",
};

const officialPath = (officialId: string) => `/officials/${encodeURIComponent(officialId)}`;

const profileReturnLabels: Record<DemoSession["role"], string> = {
  citizen: "Return to citizen view",
  parshad: "Return to Parshad dashboard",
  corporation_admin: "Return to corporation dashboard",
};

const officialIdFromPath = (pathname: string | null) => {
  const match = pathname?.match(/^\/officials\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const viewForPath = (pathname: string | null): View => {
  if (pathname === "/issues") return "issues";
  if (pathname === "/report") return "report";
  if (pathname === "/wards") return "wards";
  if (pathname === "/parshad" || pathname?.startsWith("/officials/")) return "profile";
  return "home";
};

const statusCopy: Record<IssueStatus, string> = {
  requested: "Reported",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  completed: "Fixed",
  rejected: "Rejected",
};

const statusHindi: Record<IssueStatus, string> = {
  requested: "दर्ज किया गया",
  acknowledged: "संज्ञान में",
  in_progress: "काम जारी है",
  completed: "ठीक हुआ",
  rejected: "अस्वीकृत",
};

const escalationCopy: Record<EscalationStatus, string> = {
  open: "Escalated to Nagar Parishad",
  acknowledged: "Acknowledged by Nagar Parishad",
  resolved: "Resolved by Nagar Parishad",
};

const escalationStateCopy: Record<EscalationStatus, string> = {
  open: "Escalated to Nagar Parishad",
  acknowledged: "Escalated · Acknowledged by Nagar Parishad",
  resolved: "Escalated · Resolved by Nagar Parishad",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

const formatRupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const formatTermLabel = (termNumber?: number) => {
  if (!termNumber) return "Current term";
  const suffix = termNumber % 100 >= 11 && termNumber % 100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[termNumber % 10] ?? "th";
  return `${termNumber}${suffix} term`;
};

type SimilarIssueMatch = {
  id: string;
  title: string;
  similarity: number;
};

function StatusMark({ status }: { status: IssueStatus }) {
  return (
    <span className={`${styles.status} ${styles[`status_${status}`]}`}>
      <span aria-hidden="true" className={styles.statusDot} />
      {statusCopy[status]}
      <span className={styles.hindiHint}> · {statusHindi[status]}</span>
    </span>
  );
}

function IssueStateMark({ issue }: { issue: Issue }) {
  if (!issue.escalated) return <StatusMark status={issue.status} />;
  return <span className={`${styles.status} ${styles.escalationStatus}`}>
    <span aria-hidden="true" className={`${styles.statusDot} ${styles.escalationStatusDot}`} />
    {issue.escalationStatus ? escalationStateCopy[issue.escalationStatus] : "Escalated to Nagar Parishad"}
  </span>;
}

function StatusTrail({ issue }: { issue: Issue }) {
  const events = issue.statusHistory ?? [];

  return <section className={styles.statusTrail} aria-label="Status trail">
    <div className={styles.statusTrailHeader}><p className={styles.kicker}>Status trail</p><span>{events.length ? `${events.length} update${events.length === 1 ? "" : "s"}` : "Legacy record"}</span></div>
    {events.length ? <ol className={styles.statusTrailList}>
      {events.map((event, index) => <li key={`${event.status}-${event.createdAt}-${index}`} className={styles.statusTrailItem}>
        <span className={styles.statusTrailRail} aria-hidden="true"><span className={`${styles.statusTrailMarker} ${styles[`statusTrailMarker_${event.status}`]}`} /></span>
        <div className={styles.statusTrailBody}>
          <div className={styles.statusTrailMeta}><strong>{statusCopy[event.status]} <span className={styles.hindiHint}>· {statusHindi[event.status]}</span></strong><time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time></div>
          <p>{event.note ?? (event.status === "requested" ? issue.description : "This update was recorded in the public issue history.")}</p>
          <small>By {event.actorName}{event.actorRole ? ` · ${event.actorRole === "parshad" ? "Parshad" : event.actorRole === "citizen" ? "Citizen" : "Municipality officer"}` : ""}{event.supportCountAtChange == null ? "" : ` · ${event.supportCountAtChange} community supports`}</small>
        </div>
      </li>)}
    </ol> : <p className={styles.statusTrailEmpty}>This is a legacy record. Its earlier status changes were not recorded.</p>}
  </section>;
}

function IssueRecord({ issue, onOpen, onVote, canVote, viewerId }: {
  issue: Issue;
  onOpen: () => void;
  onVote: (direction: -1 | 1) => void;
  canVote: boolean;
  viewerId?: string;
}) {
  const mediaCount = issue.media.length;
  const isOwnReport = Boolean(viewerId && issue.reporterId === viewerId);

  return (
    <article className={styles.issueRecord}>
      <button type="button" className={styles.issueOpen} onClick={onOpen} aria-label={`Open issue: ${issue.title}`}>
        <div className={styles.issueEyebrow}>
          <IssueStateMark issue={issue} />
        </div>
        <h3>{issue.title}</h3>
        <p>{issue.description}</p>
        <div className={styles.issueMeta}>
          <span>By {issue.reporterName}</span>
          <span>{formatDate(issue.createdAt)}</span>
          {mediaCount > 0 && <span>{mediaCount} attachment{mediaCount > 1 ? "s" : ""}</span>}
        </div>
        {issue.status === "rejected" && <div className={styles.rejectionSummary}><strong>Rejected: </strong>{issue.rejectionReason ?? "The ward office did not accept this report."}<small>Decision by {issue.rejectionActorName ?? "Ward representative"} · {issue.rejectionAt ? formatTimestamp(issue.rejectionAt) : formatDate(issue.updatedAt)}</small></div>}
      </button>
      {issue.status === "completed" ? <div className={styles.voteSummary} aria-label={`Community response: ${issue.upvotes} support, ${issue.downvotes} downvotes`}><span>{issue.upvotes} support{issue.upvotes === 1 ? "" : "s"}</span><span>{issue.downvotes} downvote{issue.downvotes === 1 ? "" : "s"}</span></div> : null}
      {issue.status !== "rejected" && issue.status !== "completed" && !issue.escalated && (isOwnReport ? <div className={styles.voteRow}><span className={styles.voteNotice}>You filed this report.</span></div> : canVote ? (
        <div className={styles.voteRow} aria-label={`Community support for ${issue.title}`}>
          <button
            type="button"
            className={`${styles.voteButton} ${issue.viewerVote === 1 ? styles.votedUp : ""}`}
            onClick={() => onVote(1)}
            aria-pressed={issue.viewerVote === 1}
          >
            <ThumbsUp aria-hidden="true" size={17} />
            <span>Support</span>
            <strong>{issue.upvotes}</strong>
          </button>
          <button
            type="button"
            className={`${styles.voteButton} ${issue.viewerVote === -1 ? styles.votedDown : ""}`}
            onClick={() => onVote(-1)}
            aria-pressed={issue.viewerVote === -1}
          >
            <ThumbsDown aria-hidden="true" size={17} />
            <span className={styles.srOnly}>Do not support</span>
            <strong>{issue.downvotes}</strong>
          </button>
        </div>
      ) : null)}
    </article>
  );
}

type CitizenExperienceProps = {
  data: PublicDemoData;
  dataMode: "demo" | "supabase";
  session?: DemoSession;
  readOnly?: boolean;
  routing?: boolean;
  onWardIssuesLoad?: (wardId: string) => Promise<WardIssuesResult>;
};

export function CitizenExperience({ data, dataMode, session, readOnly = false, routing = true, onWardIssuesLoad }: CitizenExperienceProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedWard = searchParams.get("ward");
  const [localView, setLocalView] = useState<View>("home");
  const initialWard = data.wards.find((item) => item.id === requestedWard || String(item.number) === requestedWard)
    ?? data.wards.find((item) => item.id === session?.wardId)
    ?? data.wards.find((item) => item.number === 12)
    ?? data.wards[0];
  const residentWard = data.wards.find((item) => item.id === session?.wardId) ?? initialWard;
  const [selectedWardNumber, setSelectedWardNumber] = useState(initialWard?.number ?? 1);
  const [issues, setIssues] = useState<Issue[]>(() => data.issues.map((issue) => {
    const escalation = data.escalations.find((item) => item.issueId === issue.id);
    return escalation ? { ...issue, escalated: true, escalationStatus: escalation.status } : issue;
  }));
  const [filter, setFilter] = useState<"all" | IssueStatus>("all");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [reportStage, setReportStage] = useState<ReportStage>("form");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [submittedTitle, setSubmittedTitle] = useState("");
  const [submittedDescription, setSubmittedDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [duplicateDraft, setDuplicateDraft] = useState<{ title: string; description: string; matches: SimilarIssueMatch[] } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingWardId, setLoadingWardId] = useState<string | null>(null);
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const loadedWardIds = useRef(new Set([
    ...data.issues.map((issue) => issue.wardId),
    ...(session?.wardId ? [session.wardId] : []),
  ]));

  const showToast = (message: string, tone: ToastTone = "success") => {
    if (tone === "error") toast.error(message);
    else if (tone === "info") toast.info(message);
    else toast.success(message);
  };

  const ward = data.wards.find((item) => item.number === selectedWardNumber) ?? data.wards[0];
  const wardId = ward?.id ?? "";
  const residentWardLocality = residentWard ? wardLocalityName(residentWard.name) : null;
  const canReportInWard = Boolean(ward && !readOnly && ward.id === session?.wardId);
  // Live RLS permits votes only for issues in the resident's own ward. Keep
  // the UI in lockstep so browsing another ward never offers a mutation.
  const canVote = session?.role === "citizen" && !readOnly && ward.id === session.wardId;
  const wardIssues = useMemo(() => sortIssuesBySupport(issues.filter((item) => item.wardId === wardId)), [issues, wardId]);
  const openWardIssues = useMemo(() => wardIssues.filter((item) => item.status === "in_progress"), [wardIssues]);

  const requestedView = routing ? viewForPath(pathname) : localView;
  const view = requestedView === "report" && !canReportInWard ? "home" : requestedView;
  const profileOfficialId = routing ? officialIdFromPath(pathname) : null;

  useEffect(() => {
    if (routing && !canReportInWard && requestedView === "report" && pathname === viewRoutes.report) {
      window.history.replaceState(null, "", viewRoutes.home);
    }
  }, [canReportInWard, pathname, requestedView, routing]);

  if (!ward) return <p role="alert">No ward record is available for this municipality.</p>;
  const filteredIssues = filter === "all" ? wardIssues : wardIssues.filter((item) => item.status === filter);
  const selectedIssue = issues.find((item) => item.id === selectedIssueId) ?? null;
  const wardOfficial = data.officials.find((item) => item.wardId === ward.id && item.current);
  const profileOfficial = profileOfficialId ? data.officials.find((item) => item.id === profileOfficialId) : null;
  const displayedOfficial = profileOfficialId ? profileOfficial : wardOfficial;
  const displayedOfficialWard = displayedOfficial?.wardId ? data.wards.find((item) => item.id === displayedOfficial.wardId) : null;
  // Profile context follows the representative, without changing the resident's
  // selected ward or the ward used to authorize reporting and voting.
  const headerWard = view === "profile" ? displayedOfficialWard : ward;
  const headerLocality = headerWard ? wardLocalityName(headerWard.name) : null;
  const completedOfficialIssueCount = displayedOfficialWard
    ? issues.filter((item) => item.wardId === displayedOfficialWard.id && item.status === "completed").length
    : 0;
  const wardNotices = data.notices.filter((item) => item.wardId === ward.id);
  const municipalityNotices = data.notices.filter((item) => item.wardId === null);
  const latestWardNotice = wardNotices.reduce((latest, notice) => !latest || new Date(notice.createdAt).getTime() > new Date(latest.createdAt).getTime() ? notice : latest, wardNotices[0]);
  const latestMunicipalityNotice = municipalityNotices.reduce((latest, notice) => !latest || new Date(notice.createdAt).getTime() > new Date(latest.createdAt).getTime() ? notice : latest, municipalityNotices[0]);
  const tasks = data.alerts.filter((item) => item.wardIds.includes(ward.id));
  const expenditures = data.expenditures.filter((item) => item.wardId === ward.id);
  const counts = wardIssues.reduce<Record<IssueStatus, number>>(
    (result, item) => ({ ...result, [item.status]: result[item.status] + 1 }),
    { requested: 0, acknowledged: 0, in_progress: 0, completed: 0, rejected: 0 },
  );

  const moveTo = (next: View, destination = viewRoutes[next]) => {
    if (next === "report" && !canReportInWard) {
      showToast("Citizens can report issues only in their selected ward.", "error");
      return;
    }
    if (routing && window.location.pathname !== destination) {
      window.history.pushState(null, "", destination);
    }
    if (!routing) setLocalView(next);
    if (next === "report") {
      setReportStage("form");
      setFormError("");
    }
  };

  const openWard = async (nextWard: (typeof data.wards)[number]) => {
    if (loadingWardId) return;
    if (dataMode === "supabase" && onWardIssuesLoad && !loadedWardIds.current.has(nextWard.id)) {
      setLoadingWardId(nextWard.id);
      try {
        const result = await onWardIssuesLoad(nextWard.id);
        if (!result.ok) {
          showToast(result.error.message, "error");
          return;
        }
        setIssues((current) => [
          ...current.filter((issue) => issue.wardId !== nextWard.id),
          ...result.data,
        ]);
        loadedWardIds.current.add(nextWard.id);
      } catch {
        showToast("Unable to load this ward's issues. Check your connection and try again.", "error");
        return;
      } finally {
        setLoadingWardId(null);
      }
    }
    setSelectedIssueId(null);
    setSelectedWardNumber(nextWard.number);
    moveTo("home");
  };

  const returnFromProfile = () => {
    if (displayedOfficialWard && displayedOfficialWard.id !== ward.id) {
      void openWard(displayedOfficialWard);
      return;
    }
    moveTo("home");
  };

  const handleVote = async (issueId: string, direction: -1 | 1) => {
    const previous = issues.find((item) => item.id === issueId);
    if (!previous) return;
    const nextVote = previous.viewerVote === direction ? 0 : direction;
    setIssues((current) => current.map((item) => {
      if (item.id !== issueId) return item;
      const nextVote = item.viewerVote === direction ? 0 : direction;
      const removePrevious = item.viewerVote === 1 ? { upvotes: -1, downvotes: 0 } : item.viewerVote === -1 ? { upvotes: 0, downvotes: -1 } : { upvotes: 0, downvotes: 0 };
      const addNext = nextVote === 1 ? { upvotes: 1, downvotes: 0 } : nextVote === -1 ? { upvotes: 0, downvotes: 1 } : { upvotes: 0, downvotes: 0 };
      return { ...item, viewerVote: nextVote, upvotes: item.upvotes + removePrevious.upvotes + addNext.upvotes, downvotes: item.downvotes + removePrevious.downvotes + addNext.downvotes };
    }));
    if (dataMode === "supabase") {
      const result = nextVote === 0 ? await deleteIssueVote(issueId) : await setIssueVote(issueId, nextVote);
      if (!result.ok) {
        setIssues((current) => current.map((item) => item.id === issueId ? previous : item));
        showToast(result.error.message, "error");
      } else {
        showToast(nextVote === 1 ? "Your support was recorded" : nextVote === -1 ? "Your downvote was recorded" : previous.viewerVote === 1 ? "Your support was removed" : "Your downvote was removed");
      }
    }
  };

  const findSimilarIssues = async (title: string, description: string): Promise<SimilarIssueMatch[]> => {
    if (dataMode !== "supabase") return [];
    const response = await fetch("/api/issues/similar", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await getFirebaseAuthorizationHeader()) },
      body: JSON.stringify({ wardId: ward.id, title, description }),
    });
    const body = await response.json().catch(() => null) as { matches?: SimilarIssueMatch[]; error?: string } | null;
    if (!response.ok) throw new Error(body?.error ?? "AI duplicate matching is temporarily unavailable.");
    return body?.matches ?? [];
  };

  const publishNewReport = async (title = submittedTitle, description = submittedDescription) => {
    const reportTitle = title.trim();
    const reportDescription = description.trim();
    setSubmittedTitle(reportTitle);
    setSubmittedDescription(reportDescription);
    setFormError("");
    if (dataMode === "supabase" && !canReportInWard) {
      setFormError("Citizens can report issues only in their selected ward.");
      return;
    }
    let issueId = `issue-local-${issues.length + 1}`;
    if (dataMode === "supabase") {
      const result = await createLiveIssue({
        municipalityId: data.municipality.id,
        wardId: ward.id,
        title: reportTitle,
        description: reportDescription,
        originalLanguage: "en",
      });
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      issueId = result.data.id;
      if (evidenceFiles.length > 0) {
        let mediaResult;
        try {
          mediaResult = await uploadLiveIssueMedia(issueId, evidenceFiles);
        } catch {
          mediaResult = { ok: false as const, error: { code: "REQUEST_FAILED" as const, message: "The issue could not be submitted because its media upload failed." } };
        }
        if (!mediaResult.ok) {
          setFormError("The report was saved, but its evidence could not be uploaded. Please try again without attachments.");
          return;
        }
      }
      try {
        const aiResponse = await fetch("/api/ai-jobs", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await getFirebaseAuthorizationHeader()) },
          body: JSON.stringify({
            jobType: "summarization",
            issueId,
            idempotencyKey: `report-summary:${issueId}`,
            input: { text: reportDescription, language: "en", maxCharacters: 280 },
          }),
        });
        const aiBody = (await aiResponse.json().catch(() => null)) as { job?: { id?: string }; error?: string } | null;
        if (aiResponse.ok && aiBody?.job?.id) {
          setAiJobId(aiBody.job.id);
        } else if (aiBody?.error) {
          showToast(`The report was saved, but language processing was not queued: ${aiBody.error}`, "info");
        }
      } catch {
        showToast("The report was saved, but language processing could not be queued.", "info");
      }
    }
    const recordedAt = new Date().toISOString();
    const newIssue: Issue = {
      id: issueId,
      municipalityId: data.municipality.id,
      wardId: ward.id,
      reporterId: session?.profileId ?? "citizen-17",
      reporterName: "You",
      title: reportTitle,
      description: reportDescription,
      originalLanguage: "en",
      status: "requested",
      upvotes: 0,
      downvotes: 0,
      viewerVote: 0,
      media: evidenceFiles.map((file, index) => ({ id: `local-media-${index}`, kind: file.type.startsWith("video/") ? "video" as const : "photo" as const, url: URL.createObjectURL(file), alt: file.name })),
      statusHistory: [{
        status: "requested",
        actorName: "You",
        actorRole: "citizen",
        note: reportDescription,
        supportCountAtChange: null,
        createdAt: recordedAt,
      }],
      createdAt: recordedAt,
      updatedAt: recordedAt,
      escalated: false,
    };
    setIssues((current) => [newIssue, ...current]);
    setReportStage("success");
  };

  const handleReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (title.length < 4 || description.length < 8) {
      setFormError("Please add a short title and describe the place and problem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const matches = await findSimilarIssues(title, description);
      if (matches.length > 0) {
        const names = matches.slice(0, 2).map((issue) => `“${issue.title}”`).join(" and ");
        setDuplicateDraft({ title, description, matches });
        showToast(`We found a report about something similar: ${names}. Please check it before continuing.`, "info");
        setFormError("");
        return;
      }

      setDuplicateDraft(null);
      await publishNewReport(title, description);
    } catch {
      setFormError("We could not submit your report. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reportAsSeparateIssue = async () => {
    if (!duplicateDraft || isSubmitting) return;
    const draft = duplicateDraft;
    setDuplicateDraft(null);
    setIsSubmitting(true);
    try {
      await publishNewReport(draft.title, draft.description);
    } catch {
      setFormError("We could not submit your report. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.experience} aria-label="NagarSakhi citizen experience">
      <div className={styles.wardBand}>
        <div className={`${styles.wardIdentity} ${view === "profile" ? styles.profileWardIdentity : ""}`}>
          {view === "profile" && <button type="button" className={styles.profileBackButton} onClick={returnFromProfile} aria-label={`Back to ${formatWardLabel((displayedOfficialWard ?? ward).number)}`} title={`Back to ${formatWardLabel((displayedOfficialWard ?? ward).number)}`}><ArrowLeft size={22} aria-hidden="true" /></button>}
          <h1>{headerWard ? <>{formatWardLabel(headerWard.number)}{headerLocality ? <span> / {headerLocality}</span> : null}</> : data.municipality.name}</h1>
          <p className={styles.wardLocation}><MapPin size={15} aria-hidden="true" /> <span>{data.municipality.name}, {data.municipality.district}</span></p>
        </div>
      </div>

      {view !== "profile" && <nav className={styles.nav} aria-label="Citizen sections">
        {([
          ["home", "Overview"], ["issues", "Issues"], ...(canReportInWard ? [["report", "Report"]] : []), ["wards", "Wards"],
        ] as [View, string][]).map(([item, label]) => (
          <button key={item} type="button" aria-current={view === item ? "page" : undefined} className={view === item ? styles.navActive : ""} onClick={() => { if (item !== "issues") setSelectedIssueId(null); moveTo(item); }}>{label}</button>
        ))}
      </nav>}

      <main id="citizen-main" className={styles.main}>
        {view === "home" && (
          <>
            {latestMunicipalityNotice ? <section className={styles.municipalityNotice} aria-labelledby="latest-municipality-note-title">
              <div>
                <p className={styles.kicker}>Nagar Parishad notice · नगर सूचना</p>
                <h2 id="latest-municipality-note-title">{latestMunicipalityNotice.title ?? "Nagar Parishad notice"}</h2>
                <p className={styles.latestNoticeBody}>{latestMunicipalityNotice.body}</p>
              </div>
              <p className={styles.latestNoticeMeta}>{latestMunicipalityNotice.authorName} · Published {formatDate(latestMunicipalityNotice.createdAt)}</p>
            </section> : null}
            {latestWardNotice ? <section className={styles.latestNotice} aria-labelledby="latest-ward-note-title">
              <div>
                <p className={styles.kicker}>Ward notice · वार्ड सूचना</p>
                <h2 id="latest-ward-note-title">{latestWardNotice.title ?? "Ward notice"}</h2>
                <p className={styles.latestNoticeBody}>{latestWardNotice.body}</p>
              </div>
              <p className={styles.latestNoticeMeta}>{latestWardNotice.authorName} · Published {formatDate(latestWardNotice.createdAt)}</p>
            </section> : null}
            <section className={styles.homeLead} aria-labelledby="overview-title">
              <div>
                <h2 id="overview-title">What’s happening in your ward</h2>
                <p className={styles.leadCopy}>Track reports, support a neighbour’s issue, and follow public work.</p>
              </div>
            </section>

            <section className={styles.pulse} aria-label="Issue status summary">
              <button type="button" onClick={() => { setFilter("requested"); moveTo("issues"); }}><strong>{counts.requested}</strong><span>Reported</span></button>
              <button type="button" onClick={() => { setFilter("acknowledged"); moveTo("issues"); }}><strong>{counts.acknowledged}</strong><span>Acknowledged</span></button>
              <button type="button" onClick={() => { setFilter("in_progress"); moveTo("issues"); }}><strong>{counts.in_progress}</strong><span>In progress</span></button>
              <button type="button" onClick={() => { setFilter("completed"); moveTo("issues"); }}><strong>{counts.completed}</strong><span>Fixed</span></button>
              <button type="button" onClick={() => { setFilter("rejected"); moveTo("issues"); }}><strong>{counts.rejected}</strong><span>Rejected</span></button>
            </section>

            <div className={styles.homeGrid}>
              <section className={styles.section} aria-labelledby="watching-title">
                <div className={styles.sectionHead}>
                  <div><p className={styles.kicker}>Active issues · सक्रिय मुद्दे</p><h2 id="watching-title">{openWardIssues.length} active issues</h2></div>
                  <button type="button" className={styles.textAction} onClick={() => moveTo("issues")}>View all issues <ArrowUpRight size={16} aria-hidden="true" /></button>
                </div>
                {openWardIssues.length > 0 ? openWardIssues.slice(0, 2).map((issue) => <IssueRecord key={issue.id} issue={issue} canVote={canVote} viewerId={session?.profileId} onOpen={() => { setSelectedIssueId(issue.id); moveTo("issues"); }} onVote={(direction) => handleVote(issue.id, direction)} />) : (
                  <div className={styles.homeEmpty} role="status">
                    <p className={styles.kicker}>No work in progress</p>
                    <h3>No issues are currently in progress in {formatWardLabel(ward.number)}.</h3>
                    <p className={styles.homeEmptyCopy}>Reported, fixed, and rejected records remain available in the full issue board.</p>
                    <div className={styles.homeEmptyActions}>
                      <button type="button" className={styles.textAction} onClick={() => moveTo("issues")}>Browse the issue record <ArrowUpRight size={16} aria-hidden="true" /></button>
                    </div>
                  </div>
                )}
              </section>

              <aside className={styles.sideLedger} aria-label="Ward notices and information">
                <section className={styles.miniSection}>
                  <p className={styles.kicker}>Ward representative</p>
                  <button type="button" className={styles.profileButton} onClick={() => moveTo("profile", wardOfficial ? officialPath(wardOfficial.id) : undefined)}>
                    <h2>{wardOfficial?.name ?? "Ward office"}</h2>
                    <span>View Parshad profile <ArrowUpRight size={15} aria-hidden="true" /></span>
                  </button>
                  <p>{wardOfficial?.roleLabel ?? "Ward administration"} · {formatTermLabel(wardOfficial?.termNumber)}</p>
                </section>
              </aside>
            </div>

            <section className={styles.publicWork} aria-labelledby="public-work-title">
              <div className={styles.sectionHead}>
                <div><p className={styles.kicker}>Ward budget · वार्ड बजट</p><h2 id="public-work-title">Allocation and spending</h2></div>
                <p className={styles.budgetNumber}>{formatRupees(ward.spentBudget)} spent <span>of {formatRupees(ward.allocatedBudget)} allocated</span></p>
              </div>
              <div className={styles.budgetTrack} aria-label={`${formatRupees(ward.spentBudget)} spent of ${formatRupees(ward.allocatedBudget)} allocated`}><span style={{ width: `${ward.allocatedBudget > 0 ? Math.min(100, (ward.spentBudget / ward.allocatedBudget) * 100) : 0}%` }} /></div>
              <div className={styles.workGrid}>
                <div><h3>Recent spending</h3>{expenditures.length ? expenditures.map((expense) => <p key={expense.id}><span>{expense.description}</span><strong>{formatRupees(expense.amount)}</strong></p>) : <p>{dataMode === "demo" ? "No ward expenditure is listed in this demo." : "No public spending has been recorded for this ward yet."}</p>}</div>
                {tasks.length ? <div><h3>Ward tasks</h3>{tasks.map((task) => <p key={task.id}><span className={task.completed ? styles.doneTask : ""}>{task.completed ? "Completed" : "Due"}: {task.title}</span><strong>{formatDate(task.dueAt)}</strong></p>)}</div> : null}
              </div>
            </section>
          </>
        )}

        {view === "issues" && (
          <section className={styles.issueBoard} aria-labelledby="issue-board-title">
              <div className={styles.sectionHead}>
                <div><p className={styles.kicker}>Ward issues · वार्ड शिकायतें</p><h2 id="issue-board-title">{formatWardLabel(ward.number)} issue board</h2></div>
              {canReportInWard ? <button type="button" className={styles.primaryAction} onClick={() => moveTo("report")}><Plus size={19} aria-hidden="true" /> Report issue</button> : null}
            </div>
            <div className={styles.filterBar} role="group" aria-label="Filter issues by status">
              {(["all", "requested", "in_progress", "completed", "rejected"] as const).map((item) => <button key={item} type="button" className={filter === item ? styles.filterActive : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "All reports" : item === "rejected" ? "Rejected history" : statusCopy[item]}</button>)}
            </div>
            {filter === "rejected" && <div className={styles.historyIntro}><p className={styles.kicker}>Rejected history</p><p>These reports stay in the public record with the ward decision, reason, official, and timestamp.</p></div>}
            <div className={styles.boardLayout}>
              <div className={styles.issueList}>{filteredIssues.length ? filteredIssues.map((issue) => <IssueRecord key={issue.id} issue={issue} canVote={canVote} viewerId={session?.profileId} onOpen={() => setSelectedIssueId(issue.id)} onVote={(direction) => handleVote(issue.id, direction)} />) : <p className={styles.emptyState}>No reports match this status in {formatWardLabel(ward.number)}. Try another filter or report a new concern.</p>}</div>
              <aside className={styles.detailPanel} aria-live="polite">
                {selectedIssue ? <IssueDetail key={selectedIssue.id} issue={selectedIssue} onClose={() => setSelectedIssueId(null)} /> : <div className={styles.detailEmpty}><FileText size={28} aria-hidden="true" /><h3>Open a report</h3><p>Select any issue to read its evidence and public record.</p></div>}
              </aside>
            </div>
          </section>
        )}

        {view === "report" && (
          <section className={styles.reportFlow} aria-labelledby="report-title">
            <button type="button" className={styles.backButton} onClick={() => moveTo("home")}><ArrowLeft size={18} aria-hidden="true" /> Back to ward overview</button>
            <p className={styles.kicker}>New report · नई शिकायत</p>
            <h2 id="report-title">Report a ward issue</h2>
            <p id="report-guidance" className={styles.leadCopy}>Tell us what happened, where it is, and when you noticed it. Add a nearby landmark or photo so the ward team can find and verify the problem.</p>
            <p className={styles.finePrint}>Your phone number and house details stay private. Please do not include them in the report.</p>
            {reportStage === "form" && <form className={styles.reportForm} onSubmit={handleReportSubmit} noValidate aria-busy={isSubmitting}>
              <div className={styles.formField}><label htmlFor="issue-title">What needs attention?</label><input id="issue-title" name="title" type="text" maxLength={100} placeholder="Example: Streetlight near Nehru Park is off" aria-describedby={formError ? "report-error" : undefined} disabled={isSubmitting} onInput={() => setDuplicateDraft(null)} /></div>
              <div className={styles.formField}><label htmlFor="issue-description">Where is the problem and what is wrong?</label><textarea id="issue-description" name="description" rows={5} placeholder="Example: Three lamps near the school gate are off. I noticed it last night." aria-describedby="report-help" disabled={isSubmitting} onInput={() => setDuplicateDraft(null)} /><p id="report-help">Include a nearby landmark and when you noticed it. Use the language that is most comfortable for you.</p></div>
              <fieldset className={styles.attachments} disabled={isSubmitting}><legend>Photo or video evidence <span>(optional)</span></legend><input aria-label="Add photo or video evidence" accept="image/*,video/*" multiple onChange={(event) => setEvidenceFiles(Array.from(event.target.files ?? []).slice(0, 3))} type="file" />{evidenceFiles.length > 0 ? <p>{evidenceFiles.map((file) => file.name).join(", ")}</p> : <p>Photos help the ward team verify the problem. Add up to three if useful.</p>}</fieldset>
              {duplicateDraft && <aside className={styles.duplicateNotice} role="alert"><p className={styles.kicker}>We found a similar report</p><p>Someone has already reported a problem that sounds like yours. Please check these reports first. If yours is different, you can still create a new report.</p><ul>{duplicateDraft.matches.map((issue) => <li key={issue.id}>{issue.title} <small>Looks similar to your report</small></li>)}</ul><button type="button" className={styles.secondaryAction} onClick={() => void reportAsSeparateIssue()} disabled={isSubmitting}>{isSubmitting ? <><span className={styles.submitSpinner} aria-hidden="true" /> Saving…</> : "Report a different problem"}</button></aside>}
              {formError && <p id="report-error" className={styles.formError} role="alert">{formError}</p>}
              <button type="submit" className={`${styles.primaryAction} inline-flex items-center gap-2 transition-transform duration-150 hover:-translate-y-px`} disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? <><span className={styles.submitSpinner} aria-hidden="true" /> Submitting…</> : <>Submit report <ChevronRight size={19} aria-hidden="true" /></>}</button>
            </form>}
            {reportStage === "success" && <div className={styles.successState} role="status"><span className={styles.successMark}><Check size={28} aria-hidden="true" /></span><h3>Your community record is updated.</h3><p>{dataMode === "demo" ? "In this synthetic demo, the update is saved only in this browser." : "The report is now in your municipality’s live issue register."} You can follow it from the {formatWardLabel(ward.number)} issue board.</p>{dataMode === "supabase" && aiJobId ? <AiJobStatus jobId={aiJobId} /> : null}<button type="button" className={styles.primaryAction} onClick={() => moveTo("issues")}>View the issue board <ArrowUpRight size={18} aria-hidden="true" /></button></div>}
          </section>
        )}

        {view === "wards" && <section className={styles.wardBrowser} aria-labelledby="ward-browser-title" aria-busy={Boolean(loadingWardId)}><p className={styles.kicker}>{data.municipality.district}, {data.municipality.state}</p><h2 id="ward-browser-title">Browse {data.municipality.name} wards</h2><p className={styles.leadCopy}>Your ward is the place linked to your verified mobile number. You can read other ward records, but reports can only be filed in your own ward.</p>{residentWard && <div className={styles.yourWardCard}><div><p className={styles.kicker}>Your ward · आपका वार्ड</p><strong>{formatWardLabel(residentWard.number)}{residentWardLocality ? ` · ${residentWardLocality}` : ""}</strong><p>Report issues and follow work here.</p></div><button type="button" className={styles.secondaryAction} disabled={Boolean(loadingWardId)} onClick={() => void openWard(residentWard)}>Open your ward <ArrowUpRight size={16} aria-hidden="true" /></button></div>}<div className={styles.wardList}>{data.wards.map((item) => <button key={item.id} type="button" disabled={Boolean(loadingWardId)} className={item.id === residentWard?.id ? `${styles.wardSelected} ${styles.wardResident}` : item.number === ward.number ? styles.wardSelected : ""} aria-current={item.id === residentWard?.id ? "true" : undefined} onClick={() => void openWard(item)}><span>{item.id === residentWard?.id ? "Your ward" : formatWardLabel(item.number)}</span><strong>{loadingWardId === item.id ? "Opening…" : wardLocalityName(item.name) ?? formatWardLabel(item.number)}</strong><small>{formatRupees(item.spentBudget)} spent</small><ChevronRight size={18} aria-hidden="true" /></button>)}</div></section>}

        {view === "profile" && <section className={styles.profilePage} aria-labelledby="parshad-profile-title">
          <p className={styles.kicker}>Public representative profile · सार्वजनिक प्रोफ़ाइल</p>
          {displayedOfficial ? <>
            <h2 id="parshad-profile-title">{displayedOfficial.name}</h2>
            <p className={styles.profileRole}>{displayedOfficial.roleLabel}</p>
            <div className={styles.profileGrid}>
              <section><p className={styles.kicker}>Public responsibility</p><h3>{displayedOfficialWard ? `${displayedOfficial.name} manages ${formatWardLabel(displayedOfficialWard.number)}'s public issue board.` : "This public official is part of the municipality’s civic record."}</h3><p>{displayedOfficialWard ? `Residents can follow reported issues, public notices, and progress updates for ${formatWardLabel(displayedOfficialWard.number)}.` : "This public official is part of the municipality’s civic record."}</p></section>
              <section><p className={styles.kicker}>Service record</p><h3>{displayedOfficial.current ? (displayedOfficial.termNumber ? `Active · ${formatTermLabel(displayedOfficial.termNumber)}` : "Active representative") : "Term record"}</h3><p>{displayedOfficial.wonByVotes ? `${displayedOfficial.wonByVotes.toLocaleString("en-IN")} votes recorded` : displayedOfficial.termNumber ? `Serving their ${formatTermLabel(displayedOfficial.termNumber)}.` : "Term history has not been recorded."}</p></section>
            <section><p className={styles.kicker}>Fixed public issues</p><h3 className={styles.profileMetric}>{completedOfficialIssueCount}</h3></section>
            </div>
            <p className={styles.finePrint}>Only public role and term information is shown here. Private contact details are not part of the public record.</p>
            <button type="button" className={`${styles.primaryAction} mt-4`} onClick={() => moveTo("home")}>{session ? profileReturnLabels[session.role] : "Return to ward overview"}</button>
          </> : <div className={styles.profileEmpty} role="status">
            <span className={styles.profileEmptyIcon}><FileQuestion size={25} aria-hidden="true" /></span>
            <p className={styles.kicker}>Public record unavailable · सार्वजनिक रिकॉर्ड उपलब्ध नहीं</p>
            <h2 id="parshad-profile-title">We couldn’t find that representative.</h2>
            <p>This link may be outdated, or the representative may not be listed in the current municipality. Use the ward record to browse the current public information.</p>
          </div>}
        </section>}
      </main>

    </section>
  );
}

type ResolvedIssueMedia = IssueMedia & {
  resolvedUrl: string | null;
  unavailable: boolean;
};

/**
 * Browser media elements cannot attach the Firebase bearer token that protects
 * `/api/media/file`. Fetch protected evidence first, then give the media
 * element a short-lived in-memory object URL instead.
 */
function useResolvedIssueMedia(mediaItems: IssueMedia[]): ResolvedIssueMedia[] {
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(() => new Set());
  const mediaSignature = mediaItems.map((item) => `${item.id}:${item.url}`).join("|");

  useEffect(() => {
    const controller = new AbortController();
    const objectUrls: string[] = [];
    const protectedMedia = mediaItems.filter((item) => item.url.startsWith("/api/media/file?"));

    void Promise.all(protectedMedia.map(async (item) => {
      try {
        const response = await fetch(item.url, {
          headers: await getFirebaseAuthorizationHeader(),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Media request failed with ${response.status}`);
        const objectUrl = URL.createObjectURL(await response.blob());
        objectUrls.push(objectUrl);
        if (!controller.signal.aborted) {
          setUrls((current) => new Map(current).set(item.id, objectUrl));
        }
      } catch {
        if (!controller.signal.aborted) {
          setUnavailableIds((current) => new Set(current).add(item.id));
        }
      }
    }));

    return () => {
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaSignature, mediaItems]);

  return mediaItems.map((item) => {
    const isProtected = item.url.startsWith("/api/media/file?");
    return {
      ...item,
      resolvedUrl: isProtected ? urls.get(item.id) ?? null : item.url,
      unavailable: unavailableIds.has(item.id),
    };
  });
}

function EvidencePreview({ media, index, onOpen }: { media: ResolvedIssueMedia; index: number; onOpen: () => void }) {
  const isVideo = media.kind === "video";
  const isAudio = media.kind === "audio";
  const label = isVideo ? `Video ${index + 1}` : isAudio ? `Audio statement ${index + 1}` : `Photo ${index + 1}`;
  const mediaUrl = media.resolvedUrl ?? undefined;
  const canOpen = Boolean(mediaUrl);

  return <div className={styles.evidenceItem}>
    <button type="button" className={styles.evidencePreview} onClick={onOpen} disabled={!canOpen} aria-label={canOpen ? `Open ${label.toLowerCase()}` : `${media.unavailable ? "Unavailable" : "Loading"} ${label.toLowerCase()}`}>
      {!canOpen ? <span className={styles.mediaUnavailable} aria-hidden="true"><Camera size={24} /></span> : isVideo ? <><video src={mediaUrl} muted playsInline preload="metadata" aria-hidden="true" /><span className={styles.playBadge}><Play size={18} fill="currentColor" aria-hidden="true" /></span></> : isAudio ? <span className={styles.audioPreview}><Volume2 size={24} aria-hidden="true" /></span> : <img src={mediaUrl} alt="" loading="lazy" />}
    </button>
    <div className={styles.evidenceMeta}>
      <span><span className={styles.evidenceIcon} aria-hidden="true">{isVideo ? <Play size={15} fill="currentColor" /> : isAudio ? <Volume2 size={17} /> : <Camera size={17} />}</span>{label}</span>
      <small>{media.unavailable ? "Unable to load this attachment." : media.alt ?? (isVideo ? "Video evidence" : isAudio ? "Audio statement" : "Photo evidence")}</small>
    </div>
  </div>;
}

function MediaLightbox({ media, onClose }: { media: ResolvedIssueMedia | null; onClose: () => void }) {
  useEffect(() => {
    if (!media) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [media, onClose]);

  if (!media) return null;
  const isVideo = media.kind === "video";
  const isAudio = media.kind === "audio";

  if (typeof document === "undefined") return null;

  return createPortal(<div className={styles.mediaLightbox} role="dialog" aria-modal="true" aria-label={`${isVideo ? "Video" : isAudio ? "Audio" : "Photo"} evidence`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.mediaLightboxPanel}>
      <div className={styles.mediaLightboxTop}><div><p className={styles.kicker}>Evidence preview</p><h3>{media.alt ?? (isVideo ? "Video evidence" : "Photo evidence")}</h3></div><button type="button" className={styles.mediaLightboxClose} onClick={onClose} aria-label="Close evidence preview"><X size={22} aria-hidden="true" /></button></div>
      {isVideo ? <video className={styles.mediaLightboxMedia} src={media.resolvedUrl ?? undefined} controls playsInline aria-label={media.alt ?? "Video evidence"} /> : isAudio ? <audio className={styles.mediaLightboxAudio} src={media.resolvedUrl ?? undefined} controls aria-label={media.alt ?? "Audio statement"} /> : <img className={styles.mediaLightboxMedia} src={media.resolvedUrl ?? undefined} alt={media.alt ?? "Issue evidence"} />}
    </div>
  </div>, document.body);
}

function IssueDetail({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const resolvedMedia = useResolvedIssueMedia(issue.media);
  const activeMedia = resolvedMedia.find((media) => media.id === activeMediaId && media.resolvedUrl) ?? null;

  return <div className={styles.detailContent}>
    <div className={styles.detailTop}><button type="button" onClick={onClose} aria-label="Close issue detail"><X size={19} aria-hidden="true" /></button></div>
    <IssueStateMark issue={issue} />
    {issue.escalated && <div className={styles.escalationNotice} role="status"><strong>{issue.escalationStatus ? escalationCopy[issue.escalationStatus] : "Escalated to Nagar Parishad"}</strong><span>Nagar Parishad follow-up is recorded on this report.</span></div>}
    <h3>{issue.title}</h3>
    <p className={styles.detailDescription}>{issue.description}</p>
    <p className={styles.detailVoteSummary} aria-label={`Support: ${issue.upvotes} up, ${issue.downvotes} down`}>Support: {issue.upvotes} ↑ / {issue.downvotes} ↓</p>
    <StatusTrail issue={issue} />
    {issue.status === "rejected" ? <section className={styles.rejectionNotice} aria-label="Rejection history"><p className={styles.kicker}>Rejection history</p><p><strong>Reason:</strong> {issue.rejectionReason ?? "The ward office marked this report as rejected."}</p><dl className={styles.rejectionFacts}><div><dt>Decision by</dt><dd>{issue.rejectionActorName ?? "Ward representative"}</dd></div><div><dt>Rejected on</dt><dd>{issue.rejectionAt ? formatTimestamp(issue.rejectionAt) : formatDate(issue.updatedAt)}</dd></div></dl></section> : null}
    <dl className={styles.recordFacts}><div><dt>Reported by</dt><dd>{issue.reporterName}</dd></div><div><dt>First recorded</dt><dd>{formatDate(issue.createdAt)}</dd></div><div><dt>Last public update</dt><dd>{formatDate(issue.updatedAt)}</dd></div>{issue.escalated && <div><dt>Escalation</dt><dd>{issue.escalationStatus ? escalationCopy[issue.escalationStatus] : "Escalated to Nagar Parishad"}</dd></div>}</dl>
    <section className={styles.evidence}><h4>Evidence</h4>{resolvedMedia.length ? <div className={styles.evidenceList}>{resolvedMedia.map((media, index) => <EvidencePreview key={media.id} media={media} index={index} onOpen={() => setActiveMediaId(media.id)} />)}</div> : <p>No photo or video was added to this report.</p>}</section>
    <p className={styles.privacyNote}>Only the reporter’s public name is shown here. Contact details remain private.</p>
    <MediaLightbox media={activeMedia} onClose={() => setActiveMediaId(null)} />
  </div>;
}
