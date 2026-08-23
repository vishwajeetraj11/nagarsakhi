"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  ChevronRight,
  FileText,
  MapPin,
  Plus,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { AiJobStatus } from "@/components/ai";
import type { PublicDemoData } from "@/data/demo";
import { createLiveIssue, deleteIssueVote, setIssueVote, uploadLiveIssueMedia } from "@/lib/data/live-mutations";
import type { DemoSession, Issue, IssueStatus } from "@/lib/domain/types";
import { getFirebaseAuthorizationHeader } from "@/lib/firebase";
import styles from "./CitizenExperience.module.css";

type View = "home" | "issues" | "report" | "wards" | "parshad";
type ReportStage = "form" | "success";

const statusCopy: Record<IssueStatus, string> = {
  requested: "Reported",
  in_progress: "In progress",
  completed: "Completed",
};

const statusHindi: Record<IssueStatus, string> = {
  requested: "दर्ज किया गया",
  in_progress: "काम जारी है",
  completed: "पूरा हुआ",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

const formatRupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const issueWords = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9\u0900-\u097f]+/u).filter((word) => word.length > 2));

const issueSimilarity = (left: string, right: string) => {
  const leftWords = issueWords(left);
  const rightWords = issueWords(right);
  if (leftWords.size === 0 || rightWords.size === 0) return 0;
  let overlap = 0;
  for (const word of leftWords) if (rightWords.has(word)) overlap += 1;
  return overlap / Math.min(leftWords.size, rightWords.size);
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

function IssueRecord({ issue, onOpen, onVote }: { issue: Issue; onOpen: () => void; onVote: (direction: -1 | 1) => void }) {
  const photoCount = issue.media.filter((item) => item.kind === "photo").length;

  return (
    <article className={styles.issueRecord}>
      <button type="button" className={styles.issueOpen} onClick={onOpen} aria-label={`Open issue: ${issue.title}`}>
        <div className={styles.issueEyebrow}>
          <span>REF. {issue.id.replace("issue-", "W12-")}</span>
          <StatusMark status={issue.status} />
        </div>
        <h3>{issue.title}</h3>
        <p>{issue.description}</p>
        <div className={styles.issueMeta}>
          <span>By {issue.reporterName}</span>
          <span>{formatDate(issue.createdAt)}</span>
          {photoCount > 0 && <span>{photoCount} photo{photoCount > 1 ? "s" : ""}</span>}
          {issue.escalated && <span className={styles.escalated}>Escalated</span>}
        </div>
      </button>
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
    </article>
  );
}

type CitizenExperienceProps = {
  data: PublicDemoData;
  dataMode: "demo" | "supabase";
  session?: DemoSession;
  readOnly?: boolean;
};

export function CitizenExperience({ data, dataMode, session, readOnly = false }: CitizenExperienceProps) {
  const [view, setView] = useState<View>("home");
  const initialWard = data.wards.find((item) => item.id === session?.wardId) ?? data.wards.find((item) => item.number === 12) ?? data.wards[0];
  const [selectedWardNumber, setSelectedWardNumber] = useState(initialWard?.number ?? 1);
  const [issues, setIssues] = useState<Issue[]>(data.issues);
  const [filter, setFilter] = useState<"all" | IssueStatus>("all");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [reportStage, setReportStage] = useState<ReportStage>("form");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [submittedTitle, setSubmittedTitle] = useState("");
  const [submittedDescription, setSubmittedDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [aiJobId, setAiJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(""), 5200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const ward = data.wards.find((item) => item.number === selectedWardNumber) ?? data.wards[0];
  const wardId = ward?.id ?? "";
  const canReportInWard = !readOnly && (dataMode === "demo" || ward.id === session?.wardId);
  const wardIssues = useMemo(() => issues.filter((item) => item.wardId === wardId), [issues, wardId]);
  if (!ward) return <p role="alert">No ward record is available for this municipality.</p>;
  const filteredIssues = filter === "all" ? wardIssues : wardIssues.filter((item) => item.status === filter);
  const selectedIssue = issues.find((item) => item.id === selectedIssueId) ?? null;
  const wardOfficial = data.officials.find((item) => item.wardId === ward.id && item.current);
  const notices = data.notices.filter((item) => item.wardId === null || item.wardId === ward.id);
  const tasks = data.alerts.filter((item) => item.wardIds.includes(ward.id));
  const expenditures = data.expenditures.filter((item) => item.wardId === ward.id);
  const counts = wardIssues.reduce<Record<IssueStatus, number>>(
    (result, item) => ({ ...result, [item.status]: result[item.status] + 1 }),
    { requested: 0, in_progress: 0, completed: 0 },
  );
  const moveTo = (next: View) => {
    if (next === "report" && !canReportInWard) {
      setActionMessage("Citizens can report issues only in their selected ward.");
      return;
    }
    setView(next);
    if (next === "report") {
      setReportStage("form");
      setFormError("");
    }
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
        setActionMessage(result.error.message);
      } else {
        setActionMessage("Your support was recorded.");
      }
    }
  };

  const findSimilarIssues = (title: string, description: string) => wardIssues
    .filter((issue) => issue.status !== "completed")
    .map((issue) => ({ issue, score: issueSimilarity(`${title} ${description}`, `${issue.title} ${issue.description}`) }))
    .filter(({ score }) => score >= 0.25)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ issue }) => issue);

  const publishNewReport = async (title = submittedTitle, description = submittedDescription) => {
    setSubmittedTitle(title);
    setSubmittedDescription(description);
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
        title: submittedTitle,
        description: submittedDescription,
        originalLanguage: "en",
      });
      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }
      issueId = result.data.id;
      if (evidenceFiles.length > 0) {
        const mediaResult = await uploadLiveIssueMedia(issueId, evidenceFiles);
        if (!mediaResult.ok) setActionMessage(mediaResult.error.message);
      }
      const aiResponse = await fetch("/api/ai-jobs", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await getFirebaseAuthorizationHeader()) },
        body: JSON.stringify({
          jobType: "summarization",
          issueId,
          idempotencyKey: `report-summary:${issueId}`,
          input: { text: submittedDescription, language: "en", maxCharacters: 280 },
        }),
      });
      const aiBody = (await aiResponse.json().catch(() => null)) as { job?: { id?: string }; error?: string } | null;
      if (aiResponse.ok && aiBody?.job?.id) {
        setAiJobId(aiBody.job.id);
      } else if (aiBody?.error) {
        setActionMessage(`The report was saved, but language processing was not queued: ${aiBody.error}`);
      }
    }
    const newIssue: Issue = {
      id: issueId,
      municipalityId: data.municipality.id,
      wardId: ward.id,
      reporterId: session?.profileId ?? "citizen-17",
      reporterName: "You",
      title: submittedTitle,
      description: submittedDescription,
      originalLanguage: "en",
      status: "requested",
      upvotes: 1,
      downvotes: 0,
      viewerVote: 1,
      media: dataMode === "demo" ? evidenceFiles.map((file, index) => ({ id: `local-media-${index}`, kind: "photo" as const, url: URL.createObjectURL(file), alt: file.name })) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      escalated: false,
    };
    setIssues((current) => [newIssue, ...current]);
    setReportStage("success");
  };

  const handleReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (title.length < 4 || description.length < 8) {
      setFormError("Please add a short title and describe the place and problem.");
      return;
    }

    const matches = findSimilarIssues(title, description);
    if (matches.length > 0) {
      const names = matches.slice(0, 2).map((issue) => `“${issue.title}”`).join(" and ");
      setToastMessage(`A similar report already exists: ${names}. Open the Issues section to support it.`);
      setActionMessage("We did not create a duplicate report.");
      setFormError("");
      return;
    }

    await publishNewReport(title, description);
  };

  return (
    <section className={styles.experience} aria-label="NagarSakhi citizen experience">
      <a className={styles.skipLink} href="#citizen-main">Skip to ward information</a>
      <div className={styles.wardBand}>
        <div>
          <p className={styles.kicker}>Public ward ledger · नागरिक वार्ड रिकॉर्ड</p>
          <h1>Ward {ward.number}<span> / {ward.name}</span></h1>
          <p><MapPin size={15} aria-hidden="true" /> {data.municipality.name}, {data.municipality.district}</p>
        </div>
        <button type="button" className={styles.wardSwitcher} onClick={() => moveTo("wards")}>
          Browse wards <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className={styles.nav} aria-label="Citizen sections">
        {([
          ["home", "Overview"], ["issues", "Issues"], ...(canReportInWard ? [["report", "Report"]] : []), ["wards", "Wards"],
        ] as [View, string][]).map(([item, label]) => (
          <button key={item} type="button" aria-current={view === item ? "page" : undefined} className={view === item ? styles.navActive : ""} onClick={() => { if (item !== "issues") setSelectedIssueId(null); moveTo(item); }}>{label}</button>
        ))}
      </nav>

      <main id="citizen-main" className={styles.main}>
        {actionMessage ? <p className={actionMessage.includes("could not") ? styles.formError : styles.finePrint} role="status">{actionMessage}</p> : null}
        {toastMessage ? <div className="fixed right-4 bottom-4 z-20 flex w-[min(28rem,calc(100vw-2rem))] items-start gap-4 bg-[var(--indigo)] px-4 py-4 pl-[1.1rem] text-[0.9rem] leading-[1.45] text-[var(--paper)] shadow-[0_14px_35px_oklch(20%_0.04_260_/_0.22)]" role="status" aria-live="polite"><span>{toastMessage}</span><button className="-mt-1 -mr-1 h-8 w-8 shrink-0 bg-transparent text-[1.35rem] leading-none text-inherit" type="button" onClick={() => setToastMessage("")} aria-label="Dismiss notification">×</button></div> : null}
        {view === "home" && (
          <>
            <section className={styles.homeLead} aria-labelledby="overview-title">
              <div>
                <p className={styles.kicker}>Neighbourhood pulse · इस सप्ताह</p>
                <h2 id="overview-title">See what your ward is working on.</h2>
                <p className={styles.leadCopy}>Follow reports, back a neighbour’s issue, and keep track of public work in one clear record.</p>
              </div>
              {canReportInWard ? <button type="button" className={styles.primaryAction} onClick={() => moveTo("report")}><Plus size={19} aria-hidden="true" /> Report an issue</button> : null}
            </section>

            <section className={styles.pulse} aria-label="Issue status summary">
              <button type="button" onClick={() => { setFilter("requested"); moveTo("issues"); }}><strong>{counts.requested}</strong><span>Reported</span></button>
              <button type="button" onClick={() => { setFilter("in_progress"); moveTo("issues"); }}><strong>{counts.in_progress}</strong><span>In progress</span></button>
              <button type="button" onClick={() => { setFilter("completed"); moveTo("issues"); }}><strong>{counts.completed}</strong><span>Completed</span></button>
            </section>

            <div className={styles.homeGrid}>
              <section className={styles.section} aria-labelledby="watching-title">
                <div className={styles.sectionHead}>
                  <div><p className={styles.kicker}>Open record</p><h2 id="watching-title">Worth watching</h2></div>
                  <button type="button" className={styles.textAction} onClick={() => moveTo("issues")}>View all issues <ArrowUpRight size={16} aria-hidden="true" /></button>
                </div>
                {wardIssues.slice(0, 2).map((issue) => <IssueRecord key={issue.id} issue={issue} onOpen={() => { setSelectedIssueId(issue.id); moveTo("issues"); }} onVote={(direction) => handleVote(issue.id, direction)} />)}
              </section>

              <aside className={styles.sideLedger} aria-label="Ward notices and information">
                <section className={styles.miniSection}>
                  <p className={styles.kicker}>Ward representative</p>
                  <button type="button" className={styles.profileButton} onClick={() => moveTo("parshad")}>
                    <h2>{wardOfficial?.name ?? "Ward office"}</h2>
                    <span>View Parshad profile <ArrowUpRight size={15} aria-hidden="true" /></span>
                  </button>
                  <p>{wardOfficial?.roleLabel ?? "Ward administration"} · Current term</p>
                </section>
                <section className={styles.miniSection}>
                  <p className={styles.kicker}>Latest notice</p>
                  <p className={styles.noticeBody}>{notices[0]?.body}</p>
                  <span className={styles.finePrint}>Published {notices[0] ? formatDate(notices[0].createdAt) : "recently"}</span>
                </section>
              </aside>
            </div>

            <section className={styles.publicWork} aria-labelledby="public-work-title">
              <div className={styles.sectionHead}>
                <div><p className={styles.kicker}>Public work account</p><h2 id="public-work-title">Ward funds & commitments</h2></div>
                <p className={styles.budgetNumber}>{formatRupees(ward.spentBudget)} <span>of {formatRupees(ward.allocatedBudget)}</span></p>
              </div>
              <div className={styles.budgetTrack} aria-label={`${formatRupees(ward.spentBudget)} of ${formatRupees(ward.allocatedBudget)} spent`}><span style={{ width: `${Math.min(100, (ward.spentBudget / ward.allocatedBudget) * 100)}%` }} /></div>
              <div className={styles.workGrid}>
                <div><h3>Recent spending</h3>{expenditures.length ? expenditures.map((expense) => <p key={expense.id}><span>{expense.description}</span><strong>{formatRupees(expense.amount)}</strong></p>) : <p>No ward expenditure is listed in this demo.</p>}</div>
                <div><h3>Ward tasks</h3>{tasks.length ? tasks.map((task) => <p key={task.id}><span className={task.completed ? styles.doneTask : ""}>{task.completed ? "Completed" : "Due"}: {task.title}</span><strong>{formatDate(task.dueAt)}</strong></p>) : <p>No tasks are currently published.</p>}</div>
              </div>
            </section>
          </>
        )}

        {view === "issues" && (
          <section className={styles.issueBoard} aria-labelledby="issue-board-title">
            <div className={styles.sectionHead}>
              <div><p className={styles.kicker}>Community reports · जन शिकायतें</p><h2 id="issue-board-title">Ward {ward.number} issue board</h2></div>
              {canReportInWard ? <button type="button" className={styles.primaryAction} onClick={() => moveTo("report")}><Plus size={19} aria-hidden="true" /> Report issue</button> : null}
            </div>
            <div className={styles.filterBar} role="group" aria-label="Filter issues by status">
              {(["all", "requested", "in_progress", "completed"] as const).map((item) => <button key={item} type="button" className={filter === item ? styles.filterActive : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "All reports" : statusCopy[item]}</button>)}
            </div>
            <div className={styles.boardLayout}>
              <div className={styles.issueList}>{filteredIssues.length ? filteredIssues.map((issue) => <IssueRecord key={issue.id} issue={issue} onOpen={() => setSelectedIssueId(issue.id)} onVote={(direction) => handleVote(issue.id, direction)} />) : <p className={styles.emptyState}>No reports match this status in Ward {ward.number}. Try another filter or report a new concern.</p>}</div>
              <aside className={styles.detailPanel} aria-live="polite">
                {selectedIssue ? <IssueDetail issue={selectedIssue} onClose={() => setSelectedIssueId(null)} /> : <div className={styles.detailEmpty}><FileText size={28} aria-hidden="true" /><h3>Open a report</h3><p>Select any issue to read its evidence and public record.</p></div>}
              </aside>
            </div>
          </section>
        )}

        {view === "report" && (
          <section className={styles.reportFlow} aria-labelledby="report-title">
            <button type="button" className={styles.backButton} onClick={() => moveTo("home")}><ArrowLeft size={18} aria-hidden="true" /> Back to ward overview</button>
            <p className={styles.kicker}>New public record · नया रिकॉर्ड</p>
            <h2 id="report-title">Report a ward issue</h2>
            <p className={styles.leadCopy}>Your phone number and house details stay private. Your report shows your name only.</p>
            {reportStage === "form" && <form className={styles.reportForm} onSubmit={handleReportSubmit} noValidate>
              <div className={styles.formField}><label htmlFor="issue-title">What needs attention?</label><input id="issue-title" name="title" type="text" maxLength={100} placeholder="Example: Streetlight near Nehru Park is off" aria-describedby={formError ? "report-error" : undefined} /></div>
              <div className={styles.formField}><label htmlFor="issue-description">Describe the place and problem</label><textarea id="issue-description" name="description" rows={5} placeholder="Include a nearby landmark so the ward team can find it." aria-describedby="report-help" /><p id="report-help">Use the language that is most comfortable for you. We will keep the original text with the report.</p></div>
              <fieldset className={styles.attachments}><legend>Photo or video evidence <span>(optional)</span></legend><input aria-label="Add photo or video evidence" accept="image/*,video/*" multiple onChange={(event) => setEvidenceFiles(Array.from(event.target.files ?? []).slice(0, 3))} type="file" />{evidenceFiles.length > 0 ? <p>{evidenceFiles.map((file) => file.name).join(", ")}</p> : <p>Add up to three photos or videos so the ward team can verify the location.</p>}</fieldset>
              {formError && <p id="report-error" className={styles.formError} role="alert">{formError}</p>}
              <button type="submit" className={`${styles.primaryAction} inline-flex items-center gap-2 transition-transform duration-150 hover:-translate-y-px`}>Submit report <ChevronRight size={19} aria-hidden="true" /></button>
            </form>}
            {reportStage === "success" && <div className={styles.successState} role="status"><span className={styles.successMark}><Check size={28} aria-hidden="true" /></span><h3>Your community record is updated.</h3><p>{dataMode === "demo" ? "In this synthetic demo, the update is saved only in this browser." : "The report is now in your municipality’s live issue register."} You can follow it from the Ward {ward.number} issue board.</p>{dataMode === "supabase" && aiJobId ? <AiJobStatus jobId={aiJobId} /> : null}<button type="button" className={styles.primaryAction} onClick={() => moveTo("issues")}>View the issue board <ArrowUpRight size={18} aria-hidden="true" /></button></div>}
          </section>
        )}

        {view === "wards" && <section className={styles.wardBrowser} aria-labelledby="ward-browser-title"><p className={styles.kicker}>{data.municipality.district}, {data.municipality.state}</p><h2 id="ward-browser-title">Browse Phusro wards</h2><p className={styles.leadCopy}>Choose a ward to read its public issue record and budget summary.</p><div className={styles.wardList}>{data.wards.map((item) => <button key={item.id} type="button" className={item.number === ward.number ? styles.wardSelected : ""} aria-current={item.number === ward.number ? "true" : undefined} onClick={() => { setSelectedWardNumber(item.number); moveTo("home"); }}><span>Ward {item.number}</span><strong>{item.name}</strong><small>{formatRupees(item.spentBudget)} spent</small><ChevronRight size={18} aria-hidden="true" /></button>)}</div></section>}

        {view === "parshad" && <section className={styles.profilePage} aria-labelledby="parshad-profile-title">
          <button type="button" className={styles.backButton} onClick={() => moveTo("home")}><ArrowLeft size={18} aria-hidden="true" /> Back to Ward {ward.number}</button>
          <p className={styles.kicker}>Ward representative · सार्वजनिक प्रोफ़ाइल</p>
          <h2 id="parshad-profile-title">{wardOfficial?.name ?? "Ward Parshad"}</h2>
          <p className={styles.profileRole}>{wardOfficial?.roleLabel ?? "Ward Parshad"} · Ward {ward.number}, {data.municipality.name}</p>
          <div className={styles.profileGrid}>
            <section><p className={styles.kicker}>Public responsibility</p><h3>Keep the ward record moving.</h3><p>Residents can follow reported issues, public notices, and progress updates for this ward from the civic record.</p></section>
            <section><p className={styles.kicker}>Current term</p><h3>{wardOfficial?.current ? "Active representative" : "Term record"}</h3><p>{wardOfficial?.wonByVotes ? `${wardOfficial.wonByVotes.toLocaleString("en-IN")} votes recorded` : "Current term information is maintained by the municipality."}</p></section>
          </div>
          <button type="button" className={styles.primaryAction} onClick={() => moveTo("home")}>Return to citizen view</button>
        </section>}
      </main>

      <footer className={styles.footer}>{dataMode === "demo" ? "NagarSakhi uses synthetic people, records, media and budgets for this demonstration." : "NagarSakhi keeps resident phone and household details outside the public record."}</footer>
    </section>
  );
}

function IssueDetail({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  return <div className={styles.detailContent}><div className={styles.detailTop}><p>REPORT {issue.id.replace("issue-", "W12-")}</p><button type="button" onClick={onClose} aria-label="Close issue detail"><X size={19} aria-hidden="true" /></button></div><StatusMark status={issue.status} /><h3>{issue.title}</h3><p className={styles.detailDescription}>{issue.description}</p><dl className={styles.recordFacts}><div><dt>Reported by</dt><dd>{issue.reporterName}</dd></div><div><dt>First recorded</dt><dd>{formatDate(issue.createdAt)}</dd></div><div><dt>Last public update</dt><dd>{formatDate(issue.updatedAt)}</dd></div>{issue.escalated && <div><dt>Escalation</dt><dd>Sent to ward office</dd></div>}</dl><section className={styles.evidence}><h4>Evidence</h4>{issue.media.length ? <div className={styles.evidenceList}>{issue.media.map((media, index) => <div key={media.id}><Camera size={17} aria-hidden="true" /><span>{media.kind === "photo" ? `Photo ${index + 1}` : "Voice note"}</span><small>{media.alt ?? "Attached by reporter"}</small></div>)}</div> : <p>No photo or voice note was added to this report.</p>}</section><p className={styles.privacyNote}>Only the reporter’s public name is shown here. Contact details remain private.</p></div>;
}
