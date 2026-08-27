"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import type { PublicDemoData } from "@/data/demo";
import { CitizenExperience } from "@/features/citizen/CitizenExperience";
import type { WardIssuesResult } from "@/lib/data/live";
import { createLiveEscalation, publishLiveNotice, rejectLiveIssue, transitionLiveEscalation, transitionLiveIssue } from "@/lib/data/live-mutations";
import type { DemoSession, Escalation, Issue, IssueStatus, Notice } from "@/lib/domain/types";
import { sortIssuesBySupport } from "@/lib/domain/issue-sort";
import { formatWardLabel, formatWardNumber, wardLocalityName } from "@/lib/domain/ward-label";
import styles from "./adminStyles";
import { useNoticePublication, type ActionFeedback } from "./useNoticePublication";

type ExperienceProps = {
  data: PublicDemoData;
  dataMode: "demo" | "supabase";
  session?: DemoSession;
  onWardIssuesLoad?: (wardId: string) => Promise<WardIssuesResult>;
};

const statusCopy: Record<IssueStatus, string> = {
  requested: "Requested / प्राप्त",
  acknowledged: "Acknowledged / संज्ञान में",
  in_progress: "In progress / कार्य जारी",
  completed: "Fixed / ठीक",
  rejected: "Rejected / अस्वीकृत",
};

const statusClass: Record<IssueStatus, string> = {
  requested: styles.requested,
  acknowledged: styles.inProgress,
  in_progress: styles.inProgress,
  completed: styles.completed,
  rejected: styles.rejected,
};

const nextIssueStatus = (status: IssueStatus): Exclude<IssueStatus, "requested" | "rejected"> | null => (
  status === "requested" ? "acknowledged" : status === "acknowledged" ? "in_progress" : status === "in_progress" ? "completed" : null
);

const escalationCopy: Record<Escalation["status"], string> = {
  open: "Open / खुला",
  acknowledged: "Acknowledged / संज्ञान में",
  resolved: "Resolved / समाधान",
};

const escalationStateCopy: Record<Escalation["status"], string> = {
  open: "Escalated / प्रेषित",
  acknowledged: "Escalated · Acknowledged / प्रेषित · संज्ञान में",
  resolved: "Escalated · Resolved / प्रेषित · समाधान",
};

type IssueAction = "reject" | "escalate";

const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(value));

const formatRupees = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

const formatTermLabel = (termNumber?: number) => {
  if (!termNumber) return "Term not recorded";
  const suffix = termNumber % 100 >= 11 && termNumber % 100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[termNumber % 10] ?? "th";
  return `${termNumber}${suffix} term`;
};

function StatusPill({ status }: { status: IssueStatus }) {
  return <span className={`${styles.statusPill} ${statusClass[status]}`}>{statusCopy[status]}</span>;
}

function IssueStatePill({ issue }: { issue: Issue }) {
  return issue.escalated
    ? <span className={styles.escalatedPill}>{issue.escalationStatus ? escalationStateCopy[issue.escalationStatus] : "Escalated / प्रेषित"}</span>
    : <StatusPill status={issue.status} />;
}

function WorkspaceNotice({ dataMode }: { dataMode: "demo" | "supabase" }) {
  return dataMode === "demo"
    ? <p className={styles.demoNotice}><strong>Demo workspace.</strong> Names, records, images and figures are synthetic; this screen does not represent an official government service.</p>
    : <p className={styles.demoNotice}><strong>Live municipal workspace.</strong> Official actions are authorized by role and recorded in the audit trail.</p>;
}

function AuditLine({ children }: { children: React.ReactNode }) {
  return <p className={styles.auditLine}><span aria-hidden="true">•</span>{children}</p>;
}

function InlineFeedback({ feedback, id }: { feedback: ActionFeedback | null | undefined; id?: string }) {
  return feedback ? <p id={id} className={`${styles.inlineFeedback} ${feedback.state === "error" ? styles.inlineError : ""}`} role={feedback.state === "error" ? "alert" : "status"}>{feedback.message}</p> : null;
}

function SectionShortcuts({ links }: { links: [string, string][] }) {
  return <nav className={styles.sectionShortcuts} aria-label="Dashboard sections">{links.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>;
}

function WardIssueSection({ title, hint, issues }: { title: string; hint: string; issues: Issue[] }) {
  return <section className={styles.drillIssueSection} aria-label={`${title} issues`}>
    <header><div><p className={styles.kicker}>{hint}</p><h2>{title}</h2></div><strong aria-label={`${issues.length} ${title.toLowerCase()} issues`}>{issues.length}</strong></header>
    {issues.length > 0
      ? <ol>{sortIssuesBySupport(issues).map((issue) => <li key={issue.id}>
        <div>
          <b>{issue.title}</b>
          <details className={styles.drillReport}>
            <summary aria-label={`Read full report: ${issue.title}`}>Read full report</summary>
            <p>{issue.description}</p>
          </details>
        </div>
        <small>{formatDate(issue.updatedAt)} · {issue.upvotes} support{issue.upvotes === 1 ? "" : "s"}{issue.escalated ? " · Escalated" : ""}</small>
      </li>)}</ol>
      : <p className={styles.emptyRecord}>No {title.toLowerCase()} reports in this ward.</p>}
  </section>;
}

export function ParshadExperience({ data, dataMode, session, onWardIssuesLoad }: ExperienceProps) {
  const [citizenView, setCitizenView] = useState(false);
  const ward = data.wards.find((item) => item.id === session?.wardId) ?? data.wards.find((item) => item.number === 12) ?? data.wards[0];
  const official = data.officials.find((item) => item.wardId === ward?.id && item.current);
  const [issues, setIssues] = useState(() => sortIssuesBySupport(data.issues.filter((item) => item.wardId === ward?.id).map((issue) => {
    const escalation = data.escalations.find((item) => item.issueId === issue.id);
    return escalation ? { ...issue, escalated: true, escalationStatus: escalation.status } : issue;
  })));
  const [selectedIssueId, setSelectedIssueId] = useState(issues[0]?.id ?? "");
  const [issueFilter, setIssueFilter] = useState<"all" | IssueStatus>("all");
  const [auditMessage, setAuditMessage] = useState("");
  const [auditTone, setAuditTone] = useState<"success" | "error">("success");
  const [noticeText, setNoticeText] = useState("");
  const [notices, setNotices] = useState(() => data.notices.filter((notice) => notice.wardId === ward?.id));
  const noticeSequence = useRef(0);
  const noticePublication = useNoticePublication();
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingIssueId, setRejectingIssueId] = useState<string | null>(null);
  const [escalationReason, setEscalationReason] = useState("");
  const [escalatingIssueId, setEscalatingIssueId] = useState<string | null>(null);
  const [openIssueAction, setOpenIssueAction] = useState<IssueAction | null>(null);
  const requestedCount = issues.filter((item) => item.status === "requested").length;
  const completedCount = issues.filter((item) => item.status === "completed").length;
  const residents = data.publicProfiles.filter((person) => person.wardId === ward?.id).length;
  const visibleIssues = sortIssuesBySupport(issueFilter === "all" ? issues : issues.filter((issue) => issue.status === issueFilter));
  const selectedIssue = visibleIssues.find((item) => item.id === selectedIssueId) ?? visibleIssues[0];
  const municipalityNotice = data.notices.find((notice) => notice.wardId === null);

  function recordAudit(message: string, tone: "success" | "error" = "success") {
    setAuditMessage(message);
    setAuditTone(tone);
  }

  if (citizenView) {
    return <>
      <div className={styles.viewSwitchBand}>
        <div className={styles.viewSwitchBar}>
          <span>Citizen view · reading the public ward record</span>
          <button type="button" onClick={() => setCitizenView(false)}>Back to Parshad desk</button>
        </div>
      </div>
      <CitizenExperience data={data} dataMode={dataMode} session={session} readOnly routing={false} onWardIssuesLoad={onWardIssuesLoad} />
    </>;
  }

  async function changeStatus(issueId: string, status: IssueStatus) {
    const target = issues.find((item) => item.id === issueId);
    if (!target || target.status === status) return;
    if (nextIssueStatus(target.status) !== status) {
      recordAudit("Issue status must move from Reported to In progress, then to Fixed.", "error");
      return;
    }
    if (dataMode === "supabase") {
      const result = await transitionLiveIssue(issueId, status, `Updated from the Ward ${ward?.number ?? ""} official workspace.`);
      if (!result.ok) {
        recordAudit(result.error.message, "error");
        return;
      }
    }
    setIssues((current) => current.map((item) => item.id === issueId ? { ...item, status, updatedAt: new Date().toISOString() } : item));
    recordAudit(`${target.title} marked “${statusCopy[status]}” by ${official?.name ?? "Ward official"}. ${dataMode === "demo" ? "Demo change recorded locally." : "The live audit trail records this transition."}`);
  }

  async function rejectIssue(issueId: string) {
    const target = issues.find((item) => item.id === issueId);
    const reason = rejectionReason.trim();
    if (!target || target.status !== "requested" || rejectingIssueId) return;
    if (reason.length < 8 || reason.length > 500) {
      recordAudit("Add a clear rejection reason between 8 and 500 characters.", "error");
      return;
    }
    setRejectingIssueId(issueId);
    try {
      if (dataMode === "supabase") {
        const result = await rejectLiveIssue(issueId, reason);
        if (!result.ok) {
          recordAudit(result.error.message, "error");
          return;
        }
      }
      setIssues((current) => current.map((item) => item.id === issueId ? { ...item, status: "rejected", rejectionReason: reason, updatedAt: new Date().toISOString() } : item));
      setRejectionReason("");
      setOpenIssueAction(null);
      recordAudit(`${target.title} was rejected by ${official?.name ?? "Ward official"}. The reason is now part of the public record.`);
    } finally {
      setRejectingIssueId(null);
    }
  }

  async function escalateIssue(issueId: string) {
    const target = issues.find((item) => item.id === issueId);
    const reason = escalationReason.trim();
    const canEscalate = target && (target.status === "requested" || target.status === "in_progress") && !target.escalated;
    if (session?.role !== "parshad") {
      recordAudit("Only a ward Parshad can escalate an issue to the Nagar Parishad.", "error");
      return;
    }
    if (!canEscalate || escalatingIssueId) return;
    if (reason.length < 3 || reason.length > 1000) {
      recordAudit("Add an escalation reason between 3 and 1,000 characters.", "error");
      return;
    }
    setEscalatingIssueId(issueId);
    try {
      if (dataMode === "supabase") {
        const result = await createLiveEscalation(issueId, reason);
        if (!result.ok) {
          recordAudit(result.error.message, "error");
          return;
        }
      }
      setIssues((current) => current.map((item) => item.id === issueId ? { ...item, escalated: true, escalationStatus: "open", updatedAt: new Date().toISOString() } : item));
      setEscalationReason("");
      setOpenIssueAction(null);
      recordAudit(`${target.title} was escalated to the Nagar Parishad follow-up queue by ${official?.name ?? "Ward Parshad"}. ${dataMode === "demo" ? "Demo escalation recorded locally." : "The Nagar Parishad view will show this follow-up."}`);
    } finally {
      setEscalatingIssueId(null);
    }
  }

  async function publishWardNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = noticeText.trim();
    if (body.length < 2 || !ward) return;
    await noticePublication.run(async () => {
      let noticeId = `notice-local-${noticeSequence.current + 1}`;
      if (dataMode === "supabase") {
        const result = await publishLiveNotice({ municipalityId: data.municipality.id, wardId: ward.id, title: `${formatWardLabel(ward.number)} notice`, body });
        if (!result.ok) {
          throw new Error(result.error.message);
        }
        noticeId = result.data.id;
      }
      noticeSequence.current += 1;
      const notice: Notice = { id: noticeId, municipalityId: data.municipality.id, wardId: ward.id, authorName: official?.name ?? "Ward Parshad", title: `${formatWardLabel(ward.number)} notice`, body, createdAt: new Date().toISOString() };
      setNotices((current) => [notice, ...current]);
      setNoticeText("");
      return dataMode === "demo" ? `Draft notice published locally by ${notice.authorName}. It remains demo data.` : `Public ward notice published by ${notice.authorName}.`;
    });
  }

  if (!ward) return null;
  const wardLocality = wardLocalityName(ward.name);
  const selectedNextStatus = selectedIssue ? nextIssueStatus(selectedIssue.status) : null;
  const canEscalateIssue = Boolean(session?.role === "parshad" && selectedIssue && (selectedIssue.status === "requested" || selectedIssue.status === "in_progress") && !selectedIssue.escalated);
  const wardExpenditures = data.expenditures.filter((item) => item.wardId === ward.id);

  return <main className={styles.workspace} aria-label={`${formatWardLabel(ward.number)} Parshad workspace`}>
    <header className={styles.masthead}>
      <div>
        <p className={styles.eyebrow}>Parshad desk / पार्षद डेस्क</p>
        <h1>{formatWardLabel(ward.number)}{wardLocality ? <><span> · </span>{wardLocality}</> : null}</h1>
        <p className={styles.roleLine}>{official?.name ?? "Parshad not assigned"} · {data.municipality.name}{official ? <><br /><span>{official.roleLabel} · {formatTermLabel(official.termNumber)}</span></> : null}</p>
      </div>
      <div className={styles.wardStamp} aria-label={`${completedCount} fixed issues`}><b>{completedCount}</b><span>fixed<br />issues</span></div>
    </header>
    <div className={styles.roleSwitchBar} role="group" aria-label="Role view">
      <span>Viewing as <b>Parshad</b></span>
      <button type="button" onClick={() => setCitizenView(true)}>View as Citizen</button>
    </div>
    <SectionShortcuts links={[["ward-workflow", "Reports"], ["ward-notices", "Post a notice"], ["ward-finance", "Budget"]]} />
    <WorkspaceNotice dataMode={dataMode} />
    {municipalityNotice ? <section className={styles.municipalityNotice} aria-labelledby="municipality-notice-title">
      <div><p className={styles.kicker}>Nagar Parishad notice / नगर सूचना</p><h2 id="municipality-notice-title">{municipalityNotice.title ?? "Nagar Parishad notice"}</h2><p>{municipalityNotice.body}</p></div>
      <small>{municipalityNotice.authorName} · {formatDate(municipalityNotice.createdAt)}</small>
    </section> : null}

    <section className={styles.ledgerSummary} aria-label={`${formatWardLabel(ward.number)} summary`}>
      <div><span>Residents listed</span><strong>{residents}</strong><small>Public names only</small></div>
      <div><span>Needs action</span><strong>{requestedCount}</strong><small>Resident reports</small></div>
      <div><span>Fixed</span><strong>{completedCount}</strong><small>Fixed issues</small></div>
      <div><span>Ward budget</span><strong>{formatRupees(ward.allocatedBudget - ward.spentBudget)} remaining</strong><small>of {formatRupees(ward.allocatedBudget)} allocated</small></div>
    </section>

    <section id="ward-workflow" className={styles.section} aria-labelledby="workflow-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.kicker}>Issue register · शिकायत रजिस्टर</p><h2 id="workflow-title">Resident reports</h2></div>
        <p>{issues.length} reports</p>
      </div>
      <div className={styles.issueFilters} role="group" aria-label="Filter issue register by status">
        {(["all", "requested", "acknowledged", "in_progress", "completed", "rejected"] as const).map((filter) => <button key={filter} type="button" className={issueFilter === filter ? styles.issueFilterActive : ""} aria-pressed={issueFilter === filter} onClick={() => { setIssueFilter(filter); setSelectedIssueId(sortIssuesBySupport(issues.filter((issue) => filter === "all" || issue.status === filter))[0]?.id ?? ""); setOpenIssueAction(null); }}>{filter === "all" ? "All reports" : statusCopy[filter]}</button>)}
      </div>
      <div className={styles.issueLayout}>
        <div className={styles.issueList} aria-label={`${formatWardLabel(ward.number)} issue list`}>
          {visibleIssues.length > 0 ? visibleIssues.map((issue, index) => <button key={issue.id} className={`${styles.issueRow} ${selectedIssue?.id === issue.id ? styles.activeIssue : ""}`} onClick={() => { setSelectedIssueId(issue.id); setEscalationReason(""); setOpenIssueAction(null); }} aria-pressed={selectedIssue?.id === issue.id}>
            <span className={styles.issueNumber}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.issueWords}><b>{issue.title}</b><small>{formatDate(issue.createdAt)} · {issue.upvotes} supports</small></span>
            <span className={styles.issueBadges} aria-label={issue.escalated && issue.escalationStatus ? escalationStateCopy[issue.escalationStatus] : statusCopy[issue.status]}>
              <IssueStatePill issue={issue} />
            </span>
          </button>) : <p className={styles.emptyRecord}>No reports match this filter.</p>}
        </div>
        {selectedIssue && <article className={styles.issueDetail} aria-live="polite">
          <div className={styles.detailTop}><IssueStatePill issue={selectedIssue} /></div>
          <h3>{selectedIssue.title}</h3>
          <p className={styles.issueDescription}>{selectedIssue.description}</p>
          <dl className={styles.detailMeta}><div><dt>Reporter</dt><dd>{selectedIssue.reporterName}</dd></div><div><dt>Recorded on</dt><dd>{formatDate(selectedIssue.updatedAt)}</dd></div></dl>
          {selectedIssue.media.length > 0 && <div className={styles.evidence}><p className={styles.kicker}>Attached evidence</p><div className={styles.evidenceStrip}>{selectedIssue.media.map((media) => <figure key={media.id}>{media.kind === "video" ? <video src={media.url} controls preload="metadata" width={144} height={104} aria-label={media.alt ?? "Issue video evidence"} /> : <Image src={media.url} alt={media.alt ?? "Issue evidence"} width={144} height={104} unoptimized={dataMode === "supabase"} />}<figcaption>{media.kind === "photo" ? "Photo evidence" : media.kind === "video" ? "Video evidence" : "Audio statement"}</figcaption></figure>)}</div></div>}
          {selectedIssue.status === "rejected" ? <div className={styles.rejectionNotice}><b>Rejected report. This decision is terminal.</b><span>Reason: {selectedIssue.rejectionReason ?? "No reason recorded."}</span></div> : selectedNextStatus ? <fieldset className={styles.statusField}><legend>Update status</legend><p>{selectedNextStatus === "acknowledged" ? "Acknowledge this resident report before work begins." : selectedNextStatus === "in_progress" ? "Acknowledged reports move to In progress when ward work begins." : "Mark the report fixed only after the work is verified."}</p><div className={styles.statusActions}><button type="button" onClick={() => void changeStatus(selectedIssue.id, selectedNextStatus)}>{selectedNextStatus === "acknowledged" ? "Acknowledge report / संज्ञान में" : selectedNextStatus === "in_progress" ? "Move to In progress / कार्य जारी" : "Mark fixed / ठीक"}</button></div></fieldset> : null}
          {(selectedIssue.status === "requested" || canEscalateIssue) ? <>
            <div className={styles.actionChooser} role="group" aria-label="Report actions">
              {selectedIssue.status === "requested" ? <button type="button" className={`${styles.actionButton} ${styles.rejectAction} ${openIssueAction === "reject" ? styles.rejectActionActive : ""}`} aria-expanded={openIssueAction === "reject"} aria-pressed={openIssueAction === "reject"} aria-controls={openIssueAction === "reject" ? "rejection-reason-panel" : undefined} onClick={() => setOpenIssueAction((current) => current === "reject" ? null : "reject")}>Reject this report</button> : null}
              {canEscalateIssue ? <button type="button" className={`${styles.actionButton} ${styles.escalateAction} ${openIssueAction === "escalate" ? styles.escalateActionActive : ""}`} aria-expanded={openIssueAction === "escalate"} aria-pressed={openIssueAction === "escalate"} aria-controls={openIssueAction === "escalate" ? "escalation-reason-panel" : undefined} onClick={() => setOpenIssueAction((current) => current === "escalate" ? null : "escalate")}>Escalate to Nagar Parishad</button> : null}
            </div>
            {selectedIssue.status === "requested" && openIssueAction === "reject" ? <form id="rejection-reason-panel" className={styles.rejectionField} onSubmit={(event) => { event.preventDefault(); void rejectIssue(selectedIssue.id); }}><label htmlFor="rejection-reason">Reason for rejection</label><textarea id="rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} rows={3} placeholder="Explain why the ward office cannot accept this report." disabled={rejectingIssueId === selectedIssue.id} /><div><small>{rejectionReason.length}/500</small><button type="submit" className={styles.rejectButton} disabled={rejectingIssueId === selectedIssue.id || rejectionReason.trim().length < 8}>{rejectingIssueId === selectedIssue.id ? "Rejecting…" : "Reject issue"}</button></div></form> : null}
            {canEscalateIssue && openIssueAction === "escalate" ? <form id="escalation-reason-panel" className={styles.escalationField} onSubmit={(event) => { event.preventDefault(); void escalateIssue(selectedIssue.id); }}><label htmlFor="escalation-reason">Reason for escalation</label><textarea id="escalation-reason" value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} maxLength={1000} rows={3} placeholder="Explain why Nagar Parishad follow-up is needed." disabled={escalatingIssueId === selectedIssue.id} /><div><small>{escalationReason.length}/1000</small><button type="submit" className={styles.escalateButton} disabled={escalatingIssueId === selectedIssue.id || escalationReason.trim().length < 3}>{escalatingIssueId === selectedIssue.id ? "Escalating…" : "Escalate issue"}</button></div></form> : null}
          </> : null}
          {selectedIssue.escalated && <div className={styles.escalationBand}><b>{selectedIssue.escalationStatus ? escalationCopy[selectedIssue.escalationStatus] : "Escalated / प्रेषित"}</b><span>This report has a Nagar Parishad follow-up record. Keep the resident update specific.</span></div>}
        </article>}
      </div>
      {auditMessage ? <div className={`${styles.auditFeedback} ${auditTone === "error" ? styles.auditError : ""}`} role={auditTone === "error" ? "alert" : "status"}><b>{auditTone === "error" ? "Action could not be completed" : "Audited feedback"}</b><AuditLine>{auditMessage}</AuditLine></div> : null}
    </section>

    <section id="ward-finance" className={`${styles.section} ${styles.publicWork}`} aria-labelledby="public-work-title">
      <div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward budget · वार्ड बजट</p><h2 id="public-work-title">Allocation and spending</h2></div><p>{formatRupees(ward.spentBudget)} spent <span className={styles.financeSubline}>of {formatRupees(ward.allocatedBudget)} allocated</span></p></div>
      <div className={styles.financeLedger} aria-label={`${formatWardLabel(ward.number)} ward budget`}><div><span>Allocated</span><strong>{formatRupees(ward.allocatedBudget)}</strong></div><div><span>Spent</span><strong>{formatRupees(ward.spentBudget)}</strong></div><div><span>Remaining</span><strong>{formatRupees(ward.allocatedBudget - ward.spentBudget)}</strong></div></div>
      <div className={styles.recentSpending}><p className={styles.kicker}>Recent spending</p>{wardExpenditures.length > 0 ? <ol className={styles.expenditureList}>{wardExpenditures.map((item) => <li key={item.id}><div><b>{item.description}</b><small>{formatDate(item.spentAt)}</small></div><strong>{formatRupees(item.amount)}</strong></li>)}</ol> : <p className={styles.emptyRecord}>No expenditure records have been published for this ward.</p>}</div>
    </section>

    <div className={styles.secondaryColumns}>
      <section id="ward-notices" className={styles.section} aria-labelledby="notice-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward notice · वार्ड सूचना</p><h2 id="notice-title">Post a ward notice</h2></div></div>
        <form className={styles.noticeForm} onSubmit={publishWardNotice} aria-busy={noticePublication.pending}><label htmlFor="ward-notice">Notice text <span>(public)</span></label><textarea id="ward-notice" value={noticeText} onChange={(event) => setNoticeText(event.target.value)} placeholder="Example: Drain cleaning will begin on…" maxLength={280} disabled={noticePublication.pending} /><div><small>{noticeText.length}/280</small><button type="submit" disabled={noticePublication.pending || noticeText.trim().length < 2}>{noticePublication.pending ? "Publishing…" : dataMode === "demo" ? "Publish local draft" : "Publish ward notice"}</button></div></form>
        <InlineFeedback feedback={noticePublication.feedback} />
        <ol className={styles.noticeList}>{notices.map((notice) => <li key={notice.id}><p><strong>{notice.title ?? "Ward notice"}</strong><br />{notice.body}</p><small>{notice.authorName} · {formatDate(notice.createdAt)}</small></li>)}</ol>
      </section>
    </div>
    <section className={`${styles.section} ${styles.representativeBand}`} aria-labelledby="representative-title"><div><p className={styles.kicker}>Ward representative</p><h2 id="representative-title">{official ? <Link href={`/officials/${encodeURIComponent(official.id)}`}>{official.name}</Link> : "Parshad not assigned"}</h2><p>{official?.roleLabel ?? "Ward Parshad"} · {official?.termNumber ? `${official.termNumber}${official.termNumber === 1 ? "st" : official.termNumber === 2 ? "nd" : official.termNumber === 3 ? "rd" : "th"} term` : "Current term"}</p></div>{official ? <Link className={styles.profileLink} href={`/officials/${encodeURIComponent(official.id)}`}>View public profile →</Link> : null}</section>
    <section className={`${styles.section} ${styles.compliance}`} aria-labelledby="compliance-title"><p className={styles.kicker}>Record boundaries</p><h2 id="compliance-title">Ward record boundaries</h2><div><AuditLine>Public register displays names and report content only; household and phone details stay outside this view.</AuditLine><AuditLine>Budget figures are synthetic and shown for ward-level transparency.</AuditLine></div></section>
  </main>;
}

export function CorporationExperience({ data, dataMode }: ExperienceProps) {
  const searchParams = useSearchParams();
  const requestedWard = searchParams.get("ward");
  // Derive the review from the URL on every render, including Back/Forward.
  const selectedWard = data.wards.find((ward) => ward.id === requestedWard || String(ward.number) === requestedWard);
  const [escalations, setEscalations] = useState(data.escalations);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [notices, setNotices] = useState(data.notices.filter((notice) => notice.wardId === null));
  const [activity, setActivity] = useState(dataMode === "demo" ? "No Nagar Parishad action recorded in this demo session." : "No Nagar Parishad action recorded in this session.");
  const noticeSequence = useRef(0);
  const noticePublication = useNoticePublication();
  const escalationInFlight = useRef(new Set<string>());
  const [escalationFeedback, setEscalationFeedback] = useState<Record<string, ActionFeedback>>({});
  const escalationByIssue = new Map(escalations.map((item) => [item.issueId, item]));
  const allIssues = data.issues.map((issue) => {
    const escalation = escalationByIssue.get(issue.id);
    return escalation ? { ...issue, escalated: true, escalationStatus: escalation.status } : issue;
  });
  const unresolved = allIssues.filter((issue) => issue.status !== "completed" && issue.status !== "rejected").length;
  const allocated = data.wards.reduce((sum, ward) => sum + ward.allocatedBudget, 0);
  const spent = data.expenditures.reduce((sum, expenditure) => sum + expenditure.amount, 0);
  const coveredWardIds = new Set(data.officials.filter((official) => official.current && official.wardId).map((official) => official.wardId));
  const activeEscalations = escalations.filter((item) => item.status !== "resolved");
  const fixedCount = allIssues.filter((issue) => issue.status === "completed").length;
  const compliancePercent = allIssues.length > 0
    ? Math.round((fixedCount / allIssues.length) * 100)
    : 0;

  function openWard(wardId: string) {
    window.history.pushState(null, "", `/wards?ward=${encodeURIComponent(wardId)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToOverview() {
    window.history.pushState(null, "", "/overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateEscalation(id: string, status: Escalation["status"]) {
    const item = escalations.find((escalation) => escalation.id === id);
    const nextStatus = item?.status === "open" ? "acknowledged" : item?.status === "acknowledged" ? "resolved" : null;
    if (!item || status !== nextStatus || escalationInFlight.current.has(id)) return;
    const reportFeedback = (feedback: ActionFeedback) => setEscalationFeedback((current) => ({ ...current, [id]: feedback }));
    escalationInFlight.current.add(id);
    reportFeedback({ state: "pending", message: "Saving status…" });
    try {
      if (dataMode === "supabase") {
        const result = await transitionLiveEscalation(id, status);
        if (!result.ok) throw new Error(result.error.message);
      }
      setEscalations((current) => current.map((escalation) => escalation.id === id ? { ...escalation, status } : escalation));
      const message = `${item.issueTitle} marked “${escalationCopy[status]}”. ${dataMode === "demo" ? "Demo change recorded locally." : "Saved to the audit trail."}`;
      reportFeedback({ state: "success", message });
      setActivity(message);
    } catch (error) {
      reportFeedback({ state: "error", message: error instanceof Error ? error.message : "Could not confirm the status update. Refresh the record before retrying." });
    } finally {
      escalationInFlight.current.delete(id);
    }
  }

  async function publishCorporationNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = noticeTitle.trim();
    const body = noticeText.trim();
    if (title.length < 3 || body.length < 2) return;
    await noticePublication.run(async () => {
      let noticeId = `corporation-local-${noticeSequence.current + 1}`;
      if (dataMode === "supabase") {
        const result = await publishLiveNotice({ municipalityId: data.municipality.id, wardId: null, title, body });
        if (!result.ok) {
          throw new Error(result.error.message);
        }
        noticeId = result.data.id;
      }
      noticeSequence.current += 1;
      const notice: Notice = { id: noticeId, municipalityId: data.municipality.id, wardId: null, authorName: "Nagar Parishad desk", title, body, createdAt: new Date().toISOString() };
      setNotices((current) => [notice, ...current]); setNoticeTitle(""); setNoticeText("");
      return dataMode === "demo" ? "Nagar Parishad notice added locally as synthetic demo content." : "Nagar Parishad notice published to all wards.";
    });
  }

  if (selectedWard) {
    const wardIssues = allIssues.filter((issue) => issue.wardId === selectedWard.id);
    const requestedIssues = wardIssues.filter((issue) => issue.status === "requested");
    const inProgressIssues = wardIssues.filter((issue) => issue.status === "in_progress");
    const completedIssues = wardIssues.filter((issue) => issue.status === "completed");
    const wardEscalations = escalations.filter((item) => item.wardId === selectedWard.id);
    const currentParshad = data.officials.find((official) => official.wardId === selectedWard.id && official.current);
    const wardExpenditures = data.expenditures.filter((expense) => expense.wardId === selectedWard.id);
    const remainingBudget = selectedWard.allocatedBudget - selectedWard.spentBudget;
    const budgetUsed = selectedWard.allocatedBudget > 0 ? Math.round((selectedWard.spentBudget / selectedWard.allocatedBudget) * 100) : 0;
    const recentIssues = [...wardIssues].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, 5);
    const wardLocality = wardLocalityName(selectedWard.name);

    return <main className={styles.workspace} aria-label={`Nagar Parishad review for ${formatWardLabel(selectedWard.number)}`}>
      <div className={styles.drillNav}><button type="button" className={styles.drillBack} onClick={returnToOverview}><ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" /> Nagar Parishad overview</button><span>Ward drill-down / वार्ड समीक्षा</span></div>
      <header className={styles.masthead}>
        <div><p className={styles.eyebrow}>Nagar Parishad desk · Ward review</p><h1>{formatWardLabel(selectedWard.number)}{wardLocality ? <><span> · </span>{wardLocality}</> : null}</h1><p className={styles.roleLine}><b>{currentParshad?.name ?? "Parshad not assigned"}</b> · {currentParshad ? formatTermLabel(currentParshad.termNumber) : "Term record requires review"}</p></div>
        <div className={styles.wardStamp} aria-label={`${completedIssues.length} fixed issues`}><b>{completedIssues.length}</b><span>fixed<br />issues</span></div>
      </header>
      <SectionShortcuts links={[["ward-work", "Reports"], ["review-budget", "Budget"], ["review-activity", "Activity"]]} />
      <WorkspaceNotice dataMode={dataMode} />

      <section className={styles.ledgerSummary} aria-label={`${formatWardLabel(selectedWard.number)} indicators`}>
        <div><span>Requested</span><strong>{requestedIssues.length}</strong><small>Awaiting ward action</small></div>
        <div><span>In progress</span><strong>{inProgressIssues.length}</strong><small>Work recorded</small></div>
        <div><span>Fixed</span><strong>{completedIssues.length}</strong><small>Resolved reports</small></div>
        <div><span>Open escalations</span><strong>{wardEscalations.filter((item) => item.status !== "resolved").length}</strong><small>Nagar Parishad follow-ups</small></div>
      </section>

      <section id="ward-work" className={styles.section} aria-labelledby="ward-register-title">
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>Issue register · शिकायत रजिस्टर</p><h2 id="ward-register-title">Ward work by status</h2></div><p>Rejected reports remain in public history and are not counted as active work.</p></div>
        <div className={styles.drillIssueGrid}>
          <WardIssueSection title="Requested" hint="Needs a decision" issues={requestedIssues} />
          <WardIssueSection title="In progress" hint="Work underway" issues={inProgressIssues} />
          <WardIssueSection title="Fixed" hint="Resolved" issues={completedIssues} />
        </div>
      </section>

      <div className={styles.secondaryColumns}>
        <section id="review-budget" className={styles.section} aria-labelledby="ward-budget-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward budget</p><h2 id="ward-budget-title">Allocation & spending</h2></div></div>
          <dl className={styles.budgetLedger}><div><dt>Allocated</dt><dd>{formatRupees(selectedWard.allocatedBudget)}</dd></div><div><dt>Spent</dt><dd>{formatRupees(selectedWard.spentBudget)}</dd></div><div><dt>Remaining</dt><dd>{formatRupees(remainingBudget)}</dd></div><div><dt>Used</dt><dd>{budgetUsed}%</dd></div></dl>
          {wardExpenditures.length > 0 ? <ol className={styles.expenditureList}>{wardExpenditures.map((item) => <li key={item.id}><div><b>{item.description}</b><small>{formatDate(item.spentAt)}</small></div><strong>{formatRupees(item.amount)}</strong></li>)}</ol> : <p className={styles.emptyRecord}>No expenditure records have been published for this ward.</p>}
        </section>
        <section id="review-activity" className={styles.section} aria-labelledby="ward-activity-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward activity</p><h2 id="ward-activity-title">Latest public changes</h2></div></div>
          {recentIssues.length > 0 ? <ol className={styles.activityList}>{recentIssues.map((issue) => <li key={issue.id}><div><b>{issue.title}</b><StatusPill status={issue.status} /></div><small>Updated {formatDate(issue.updatedAt)}</small></li>)}</ol> : <p className={styles.emptyRecord}>No issue activity has been recorded for this ward.</p>}
        </section>
      </div>

      <section className={`${styles.section} ${styles.compliance}`} aria-labelledby="ward-review-boundary"><p className={styles.kicker}>Record boundaries</p><h2 id="ward-review-boundary">Nagar Parishad view, ward context</h2><div><AuditLine>This view uses {formatWardLabel(selectedWard.number)}&apos;s live public records and current term assignment.</AuditLine><AuditLine>{wardEscalations.length} escalation record{wardEscalations.length === 1 ? "" : "s"} linked to this ward.</AuditLine></div></section>
    </main>;
  }

  return <main className={styles.workspace} aria-label="Nagar Parishad administration workspace">
    <header className={styles.masthead}>
      <div><p className={styles.eyebrow}>Nagar Parishad desk / नगर पालिका डेस्क</p><h1>{data.municipality.name}</h1><p className={styles.roleLine}>Cross-ward review · {data.municipality.district}, {data.municipality.state}</p></div>
      <div className={styles.wardStamp} aria-label={`${data.municipality.wardCount} wards`}><b>{data.municipality.wardCount}</b><span>wards<br />in register</span></div>
    </header>
    <SectionShortcuts links={[["ward-overview", "Choose a ward"], ["municipal-follow-ups", "Follow-ups"], ["municipal-notices", "Publish notice"], ["municipal-budget", "Budget"]]} />
    <WorkspaceNotice dataMode={dataMode} />
    <section className={styles.ledgerSummary} aria-label="Nagar Parishad indicators"><div><span>Total reports</span><strong>{allIssues.length}</strong><small>{unresolved} still active</small></div><div><span>Escalations</span><strong>{activeEscalations.length}</strong><small>Require tracking</small></div><div><span>Ward coverage</span><strong>{coveredWardIds.size}/{data.wards.length}</strong><small>Active wards covered</small></div><div><span>Resolution rate</span><strong>{compliancePercent}%</strong><small>{fixedCount} of {allIssues.length} reports resolved</small></div></section>

    <section id="ward-overview" className={styles.section} aria-labelledby="ward-overview-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward register</p><h2 id="ward-overview-title">Choose a ward</h2></div><p>Select a ward number to open its full review.</p></div>
      <div className={styles.wardPicker}><label htmlFor="corporation-ward-select">Ward number</label><select id="corporation-ward-select" defaultValue="" onChange={(event) => { if (event.target.value) openWard(event.target.value); }}><option value="">Select a ward</option>{data.wards.map((ward) => <option key={ward.id} value={ward.id}>{formatWardLabel(ward.number)}</option>)}</select></div>
    </section>

    <section id="municipal-follow-ups" className={styles.section} aria-labelledby="escalation-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Escalated issues</p><h2 id="escalation-title">Nagar Parishad follow-up register</h2></div><p>Open a ward to read its full issue and activity record.</p></div>
      {escalations.length > 0 ? <div className={styles.tableWrap}><table className={`${styles.wardTable} ${styles.escalationTable}`} aria-label="Escalated reports" role="table">
        <thead><tr role="row">{["Ward", "Parshad", "Issue", "Requested", "Status", "Ward record"].map((label) => <th key={label} scope="col" role="columnheader">{label}</th>)}</tr></thead>
        <tbody>{escalations.map((item) => {
          const ward = data.wards.find((candidate) => candidate.id === item.wardId);
          const locality = ward ? wardLocalityName(ward.name) : null;
          const nextStatus = item.status === "open" ? "acknowledged" : item.status === "acknowledged" ? "resolved" : null;
          const feedback = escalationFeedback[item.id];
          const pending = feedback?.state === "pending";
          const feedbackId = `escalation-feedback-${item.id}`;
          return <tr key={item.id} role="row">
            <td data-label="Ward" role="cell"><div><b>{formatWardNumber(item.wardNumber)}</b>{locality ? <span>{locality}</span> : null}</div></td>
            <td data-label="Parshad" role="cell"><div><b>{item.parshadName}</b><span>Current representative</span></div></td>
            <td data-label="Issue" role="cell"><div><b>{item.issueTitle}</b><span>{item.reason}</span></div></td>
            <td data-label="Requested" role="cell"><div><b>{formatDate(item.createdAt)}</b><span>Nagar Parishad follow-up</span></div></td>
            <td data-label="Status" role="cell"><div className={styles.escalationControl} aria-busy={pending}>
              <b>{escalationCopy[item.status]}</b>
              {nextStatus ? <>
                {nextStatus === "resolved" ? <p id={`resolution-hint-${item.id}`}>Resolution is final. Confirm follow-up is complete before marking resolved.</p> : null}
                <button type="button" className={styles.tableAction} disabled={pending}
                  aria-label={`${nextStatus === "acknowledged" ? "Acknowledge" : "Mark resolved"}: ${item.issueTitle}`}
                  aria-describedby={nextStatus === "resolved" ? `resolution-hint-${item.id}` : undefined}
                  onClick={() => void updateEscalation(item.id, nextStatus)}>
                  {pending ? "Saving…" : nextStatus === "acknowledged" ? "Acknowledge" : "Mark resolved"}
                </button>
              </> : <p>Follow-up complete. This record cannot be reopened here.</p>}
              <InlineFeedback id={feedbackId} feedback={feedback} />
            </div></td>
            <td data-label="Ward record" role="cell"><button type="button" className={styles.tableAction} onClick={() => openWard(item.wardId)}>Open ward →</button></td>
          </tr>;
        })}</tbody>
      </table></div> : <div className={styles.emptyState}><b>No escalated issues</b><p>New ward escalations will appear here with their request date, budget context, and responsible Parshad.</p></div>}
    </section>

    <section id="municipal-notices" className={styles.section} aria-labelledby="publish-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Nagar Parishad notices · नगर सूचना</p><h2 id="publish-title">Publish a Nagar Parishad notice</h2></div></div><form className={styles.noticeForm} onSubmit={publishCorporationNotice} aria-busy={noticePublication.pending}><label htmlFor="corp-notice-title">Title <span>(shown to all wards)</span></label><input id="corp-notice-title" disabled={noticePublication.pending} value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="Example: Ward sabha records will be published" maxLength={160} /><label htmlFor="corp-notice">Description <span>(public to all wards)</span></label><textarea id="corp-notice" disabled={noticePublication.pending} value={noticeText} onChange={(event) => setNoticeText(event.target.value)} placeholder="Explain the update for residents…" maxLength={280} /><div><small>{noticeTitle.length}/160 · {noticeText.length}/280</small><button type="submit" disabled={noticePublication.pending || noticeTitle.trim().length < 3 || noticeText.trim().length < 2}>{noticePublication.pending ? "Publishing…" : dataMode === "demo" ? "Publish local draft" : "Publish Nagar Parishad notice"}</button></div></form><InlineFeedback feedback={noticePublication.feedback} /><ol className={styles.noticeList}>{notices.map((notice) => <li key={notice.id}><p><strong>{notice.title ?? "Nagar Parishad notice"}</strong><br />{notice.body}</p><small>{notice.authorName} · {formatDate(notice.createdAt)}</small></li>)}</ol></section>
    <section id="municipal-budget" className={styles.section} aria-labelledby="budget-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Budget overview · बजट अवलोकन</p><h2 id="budget-title">Nagar Parishad budget and expenditure</h2></div></div><div className={styles.budgetTotal}><span>Total allocations across all wards</span><strong>{formatRupees(allocated)}</strong><small>{formatRupees(spent)} in published spending records</small></div><ol className={styles.expenditureList}>{data.expenditures.map((item) => { const ward = data.wards.find((candidate) => candidate.id === item.wardId); return <li key={item.id}><div><b>{ward ? formatWardLabel(ward.number) : "Ward record"} · {item.description}</b><small>{formatDate(item.spentAt)}</small></div><strong>{formatRupees(item.amount)}</strong></li>; })}</ol></section>
    <section className={`${styles.section} ${styles.compliance}`} aria-labelledby="corp-audit-title"><p className={styles.kicker}>Record boundaries</p><h2 id="corp-audit-title">Decision feedback</h2><div><AuditLine>{activity}</AuditLine><AuditLine>Nagar Parishad accounts do not expose ward-private citizen contact or house data by default.</AuditLine></div></section>
  </main>;
}
