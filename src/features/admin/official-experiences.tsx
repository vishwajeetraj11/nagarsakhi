"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import type { PublicDemoData } from "@/data/demo";
import { CitizenExperience } from "@/features/citizen/CitizenExperience";
import type { WardIssuesResult } from "@/lib/data/live";
import { createLiveEscalation, publishLiveNotice, rejectLiveIssue, setLiveAlertCompletion, transitionLiveEscalation, transitionLiveIssue } from "@/lib/data/live-mutations";
import type { DemoSession, Escalation, Issue, IssueStatus, Notice } from "@/lib/domain/types";
import { wardLocalityName } from "@/lib/domain/ward-label";
import styles from "./adminStyles";

type ExperienceProps = {
  data: PublicDemoData;
  dataMode: "demo" | "supabase";
  session?: DemoSession;
  onWardIssuesLoad?: (wardId: string) => Promise<WardIssuesResult>;
};

const statusCopy: Record<IssueStatus, string> = {
  requested: "Requested / प्राप्त",
  in_progress: "In progress / कार्य जारी",
  completed: "Fixed / ठीक",
  rejected: "Rejected / अस्वीकृत",
};

const statusClass: Record<IssueStatus, string> = {
  requested: styles.requested,
  in_progress: styles.inProgress,
  completed: styles.completed,
  rejected: styles.rejected,
};

const nextIssueStatus = (status: IssueStatus): Exclude<IssueStatus, "requested" | "rejected"> | null => (
  status === "requested" ? "in_progress" : status === "in_progress" ? "completed" : null
);

const escalationCopy: Record<Escalation["status"], string> = {
  open: "Open / खुला",
  acknowledged: "Acknowledged / संज्ञान में",
  resolved: "Resolved / समाधान",
};

const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(value));

const formatRupees = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(value);

function StatusPill({ status }: { status: IssueStatus }) {
  return <span className={`${styles.statusPill} ${statusClass[status]}`}>{statusCopy[status]}</span>;
}

function WorkspaceNotice({ dataMode }: { dataMode: "demo" | "supabase" }) {
  return dataMode === "demo"
    ? <p className={styles.demoNotice}><strong>Demo workspace.</strong> Names, records, images and figures are synthetic; this screen does not represent an official government service.</p>
    : <p className={styles.demoNotice}><strong>Live municipal workspace.</strong> Official actions are authorized by role and recorded in the audit trail.</p>;
}

function AuditLine({ children }: { children: React.ReactNode }) {
  return <p className={styles.auditLine}><span aria-hidden="true">•</span>{children}</p>;
}

function WardIssueSection({ title, hint, issues }: { title: string; hint: string; issues: Issue[] }) {
  return <section className={styles.drillIssueSection} aria-label={`${title} issues`}>
    <header><div><p className={styles.kicker}>{hint}</p><h2>{title}</h2></div><strong aria-label={`${issues.length} ${title.toLowerCase()} issues`}>{issues.length}</strong></header>
    {issues.length > 0
      ? <ol>{issues.map((issue) => <li key={issue.id}>
        <div><b>{issue.title}</b><p>{issue.description}</p></div>
        <small>{formatDate(issue.updatedAt)} · {issue.upvotes} support{issue.upvotes === 1 ? "" : "s"}{issue.escalated ? " · Escalated" : ""}</small>
      </li>)}</ol>
      : <p className={styles.emptyRecord}>No {title.toLowerCase()} reports in this ward.</p>}
  </section>;
}

export function ParshadExperience({ data, dataMode, session, onWardIssuesLoad }: ExperienceProps) {
  const [citizenView, setCitizenView] = useState(false);
  const ward = data.wards.find((item) => item.id === session?.wardId) ?? data.wards.find((item) => item.number === 12) ?? data.wards[0];
  const official = data.officials.find((item) => item.wardId === ward?.id && item.current);
  const [issues, setIssues] = useState(() => data.issues.filter((item) => item.wardId === ward?.id));
  const [selectedIssueId, setSelectedIssueId] = useState(issues[0]?.id ?? "");
  const [auditMessage, setAuditMessage] = useState(dataMode === "demo" ? "No pending official action in this demo session." : "No pending official action in this session.");
  const [auditTone, setAuditTone] = useState<"success" | "error">("success");
  const [completedTasks, setCompletedTasks] = useState<string[]>(data.alerts.filter((alert) => alert.completed).map((alert) => alert.id));
  const [noticeText, setNoticeText] = useState("");
  const [notices, setNotices] = useState(() => data.notices.filter((notice) => notice.wardId === ward?.id));
  const noticeSequence = useRef(0);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingIssueId, setRejectingIssueId] = useState<string | null>(null);
  const [escalationReason, setEscalationReason] = useState("");
  const [escalatingIssueId, setEscalatingIssueId] = useState<string | null>(null);
  const selectedIssue = issues.find((item) => item.id === selectedIssueId) ?? issues[0];
  const activeTasks = data.alerts.filter((alert) => alert.wardIds.includes(ward?.id ?? ""));
  const requestedCount = issues.filter((item) => item.status === "requested").length;
  const completedCount = issues.filter((item) => item.status === "completed").length;
  const residents = data.publicProfiles.filter((person) => person.wardId === ward?.id).length;

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
      recordAudit("Only a ward Parshad can escalate an issue to the corporation.", "error");
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
      setIssues((current) => current.map((item) => item.id === issueId ? { ...item, escalated: true, updatedAt: new Date().toISOString() } : item));
      setEscalationReason("");
      recordAudit(`${target.title} was escalated to the corporation follow-up queue by ${official?.name ?? "Ward Parshad"}. ${dataMode === "demo" ? "Demo escalation recorded locally." : "The corporation view will show this follow-up."}`);
    } finally {
      setEscalatingIssueId(null);
    }
  }

  async function publishWardNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = noticeText.trim();
    if (!body || !ward) return;
    let noticeId = `notice-local-${noticeSequence.current + 1}`;
    if (dataMode === "supabase") {
      const result = await publishLiveNotice({ municipalityId: data.municipality.id, wardId: ward.id, body });
      if (!result.ok) {
        recordAudit(result.error.message, "error");
        return;
      }
      noticeId = result.data.id;
    }
    noticeSequence.current += 1;
    const notice: Notice = { id: noticeId, municipalityId: data.municipality.id, wardId: ward.id, authorName: official?.name ?? "Ward Parshad", body, createdAt: new Date().toISOString() };
    setNotices((current) => [notice, ...current]);
    setNoticeText("");
    recordAudit(dataMode === "demo" ? `Draft notice published locally by ${notice.authorName}. It remains demo data.` : `Public ward notice published by ${notice.authorName}.`);
  }

  if (!ward) return null;
  const wardLocality = wardLocalityName(ward.name);
  const selectedNextStatus = selectedIssue ? nextIssueStatus(selectedIssue.status) : null;
  const canEscalateIssue = Boolean(session?.role === "parshad" && selectedIssue && (selectedIssue.status === "requested" || selectedIssue.status === "in_progress") && !selectedIssue.escalated);

  return <main className={styles.workspace} aria-label={`Ward ${ward.number} Parshad workspace`}>
    <header className={styles.masthead}>
      <div>
        <p className={styles.eyebrow}>Parshad desk / पार्षद डेस्क</p>
        <h1>Ward {ward.number}{wardLocality ? <><span> · </span>{wardLocality}</> : null}</h1>
        <p className={styles.roleLine}>{official?.name ?? "Ward Parshad"} <b>Ward Parshad</b> · {data.municipality.name}</p>
      </div>
      <div className={styles.wardStamp} aria-label={`Ward ${ward.number} context`}><b>{ward.number}</b><span>ward<br />register</span></div>
    </header>
    <div className={styles.roleSwitchBar} role="group" aria-label="Role view">
      <span>Viewing as <b>Parshad</b></span>
      <button type="button" onClick={() => setCitizenView(true)}>View as Citizen</button>
    </div>
    <WorkspaceNotice dataMode={dataMode} />

    <section className={styles.ledgerSummary} aria-label={`Ward ${ward.number} summary`}>
      <div><span>Residents listed</span><strong>{residents}</strong><small>Public names only</small></div>
      <div><span>Needs action</span><strong>{requestedCount}</strong><small>Resident reports</small></div>
      <div><span>Closed</span><strong>{completedCount}</strong><small>Verified updates</small></div>
      <div><span>Ward balance</span><strong>{formatRupees(ward.allocatedBudget - ward.spentBudget)}</strong><small>of {formatRupees(ward.allocatedBudget)}</small></div>
    </section>

    <section id="ward-workflow" className={styles.section} aria-labelledby="workflow-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.kicker}>Issue register</p><h2 id="workflow-title">Decide the next clear step</h2></div>
        <p>{issues.length} reports</p>
      </div>
      <div className={styles.issueLayout}>
        <div className={styles.issueList} aria-label={`Ward ${ward.number} issue list`}>
          {issues.map((issue, index) => <button key={issue.id} className={`${styles.issueRow} ${selectedIssue?.id === issue.id ? styles.activeIssue : ""}`} onClick={() => { setSelectedIssueId(issue.id); setEscalationReason(""); }} aria-pressed={selectedIssue?.id === issue.id}>
            <span className={styles.issueNumber}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.issueWords}><b>{issue.title}</b><small>{formatDate(issue.createdAt)} · {issue.upvotes} supports</small></span>
            <StatusPill status={issue.status} />
          </button>)}
        </div>
        {selectedIssue && <article className={styles.issueDetail} aria-live="polite">
          <div className={styles.detailTop}><StatusPill status={selectedIssue.status} /></div>
          <h3>{selectedIssue.title}</h3>
          <p className={styles.issueDescription}>{selectedIssue.description}</p>
          <dl className={styles.detailMeta}><div><dt>Reporter</dt><dd>{selectedIssue.reporterName}</dd></div><div><dt>Recorded on</dt><dd>{formatDate(selectedIssue.updatedAt)}</dd></div></dl>
          {selectedIssue.media.length > 0 && <div className={styles.evidence}><p className={styles.kicker}>Attached evidence</p><div className={styles.evidenceStrip}>{selectedIssue.media.map((media) => <figure key={media.id}>{media.kind === "video" ? <video src={media.url} controls preload="metadata" width={144} height={104} aria-label={media.alt ?? "Issue video evidence"} /> : <Image src={media.url} alt={media.alt ?? "Issue evidence"} width={144} height={104} unoptimized={dataMode === "supabase"} />}<figcaption>{media.kind === "photo" ? "Photo evidence" : media.kind === "video" ? "Video evidence" : "Audio statement"}</figcaption></figure>)}</div></div>}
          {selectedIssue.status === "rejected" ? <div className={styles.rejectionNotice}><b>Rejected report. This decision is terminal.</b><span>Reason: {selectedIssue.rejectionReason ?? "No reason recorded."}</span></div> : selectedNextStatus ? <fieldset className={styles.statusField}><legend>Record a status update</legend><p>{selectedNextStatus === "in_progress" ? "New reports move to In progress first. Mark them fixed only after work is underway and verified." : "This report is in progress. Mark it fixed once the work is verified."}</p><div className={styles.statusActions}><button type="button" onClick={() => void changeStatus(selectedIssue.id, selectedNextStatus)}>{selectedNextStatus === "in_progress" ? "Move to In progress / कार्य जारी" : "Mark fixed / ठीक"}</button></div></fieldset> : null}
          {selectedIssue.status === "requested" ? <form className={styles.rejectionField} onSubmit={(event) => { event.preventDefault(); void rejectIssue(selectedIssue.id); }}><label htmlFor="rejection-reason">Reject this report <span>Reason required</span></label><textarea id="rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} rows={3} placeholder="Explain why the ward office cannot accept this report." disabled={rejectingIssueId === selectedIssue.id} /><div><small>{rejectionReason.length}/500</small><button type="submit" className={styles.rejectButton} disabled={rejectingIssueId === selectedIssue.id || rejectionReason.trim().length < 8}>{rejectingIssueId === selectedIssue.id ? "Rejecting…" : "Reject issue"}</button></div></form> : null}
          {canEscalateIssue ? <form className={styles.escalationField} onSubmit={(event) => { event.preventDefault(); void escalateIssue(selectedIssue.id); }}><label htmlFor="escalation-reason">Escalate to corporation <span>Reason required</span></label><textarea id="escalation-reason" value={escalationReason} onChange={(event) => setEscalationReason(event.target.value)} maxLength={1000} rows={3} placeholder="Explain why corporation follow-up is needed." disabled={escalatingIssueId === selectedIssue.id} /><div><small>{escalationReason.length}/1000</small><button type="submit" className={styles.escalateButton} disabled={escalatingIssueId === selectedIssue.id || escalationReason.trim().length < 3}>{escalatingIssueId === selectedIssue.id ? "Escalating…" : "Escalate issue"}</button></div></form> : null}
          {selectedIssue.escalated && <div className={styles.escalationBand}><b>Escalated / प्रेषित</b><span>This report has a corporation follow-up record. Keep the resident update specific.</span></div>}
        </article>}
      </div>
      <div className={`${styles.auditFeedback} ${auditTone === "error" ? styles.auditError : ""}`} role={auditTone === "error" ? "alert" : "status"}><b>{auditTone === "error" ? "Action could not be completed" : "Audited feedback"}</b><AuditLine>{auditMessage}</AuditLine></div>
    </section>

    <div className={styles.secondaryColumns}>
      <section className={styles.section} aria-labelledby="tasks-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward calendar</p><h2 id="tasks-title">Required follow-ups</h2></div></div>
        <ul className={styles.taskList}>{activeTasks.map((task) => { const done = completedTasks.includes(task.id); return <li key={task.id}><label><input type="checkbox" checked={done} onChange={async () => { const nextDone = !done; if (dataMode === "supabase") { const result = await setLiveAlertCompletion(task.id, nextDone); if (!result.ok) { recordAudit(result.error.message, "error"); return; } } setCompletedTasks((current) => done ? current.filter((id) => id !== task.id) : [...current, task.id]); recordAudit(`${task.title} marked ${nextDone ? "complete" : "open"}${dataMode === "demo" ? " in this local demo session" : ""}.`); }} /><span><b>{task.title}</b><small>Due {formatDate(task.dueAt)} · {task.description}</small></span></label><span className={done ? styles.doneMark : styles.openMark}>{done ? "Complete" : "Open"}</span></li>; })}</ul>
      </section>
      <section className={styles.section} aria-labelledby="notice-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Resident notice</p><h2 id="notice-title">Share a ward update</h2></div></div>
        <form className={styles.noticeForm} onSubmit={publishWardNotice}><label htmlFor="ward-notice">Notice text <span>(public)</span></label><textarea id="ward-notice" value={noticeText} onChange={(event) => setNoticeText(event.target.value)} placeholder="Example: Drain cleaning will begin on…" maxLength={280} /><div><small>{noticeText.length}/280</small><button type="submit" disabled={!noticeText.trim()}>{dataMode === "demo" ? "Publish local draft" : "Publish ward notice"}</button></div></form>
        <ol className={styles.noticeList}>{notices.map((notice) => <li key={notice.id}><p>{notice.body}</p><small>{notice.authorName} · {formatDate(notice.createdAt)}</small></li>)}</ol>
      </section>
    </div>
    <section className={`${styles.section} ${styles.compliance}`} aria-labelledby="compliance-title"><p className={styles.kicker}>Compliance & privacy</p><h2 id="compliance-title">Ward record boundaries</h2><div><AuditLine>Public register displays names and report content only; household and phone details stay outside this view.</AuditLine><AuditLine>Budget figures are synthetic and shown for ward-level transparency.</AuditLine></div></section>
  </main>;
}

export function CorporationExperience({ data, dataMode }: ExperienceProps) {
  const [escalations, setEscalations] = useState(data.escalations);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState("");
  const [notices, setNotices] = useState(data.notices.filter((notice) => notice.wardId === null));
  const [activity, setActivity] = useState(dataMode === "demo" ? "No corporation action recorded in this demo session." : "No corporation action recorded in this session.");
  const noticeSequence = useRef(0);
  const allIssues = data.issues;
  const unresolved = allIssues.filter((issue) => issue.status !== "completed" && issue.status !== "rejected").length;
  const spent = data.wards.reduce((sum, ward) => sum + ward.spentBudget, 0);
  const allocated = data.wards.reduce((sum, ward) => sum + ward.allocatedBudget, 0);
  const coveredWardIds = new Set(data.officials.filter((official) => official.current && official.wardId).map((official) => official.wardId));
  const activeEscalations = escalations.filter((item) => item.status !== "resolved");
  const compliancePercent = allIssues.length > 0
    ? Math.round((allIssues.filter((issue) => issue.status !== "requested").length / allIssues.length) * 100)
    : 0;

  const selectedWard = data.wards.find((ward) => ward.id === selectedWardId);

  function openWard(wardId: string) {
    setSelectedWardId(wardId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToOverview() {
    setSelectedWardId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateEscalation(id: string, status: Escalation["status"]) {
    const item = escalations.find((escalation) => escalation.id === id);
    if (dataMode === "supabase") {
      if (status === "open") {
        setActivity("Live escalation status can only move forward; reopening requires a reviewed action.");
        return;
      }
      const result = await transitionLiveEscalation(id, status);
      if (!result.ok) {
        setActivity(result.error.message);
        return;
      }
    }
    setEscalations((current) => current.map((escalation) => escalation.id === id ? { ...escalation, status } : escalation));
    setActivity(`${item?.issueTitle ?? "Escalation"} marked “${escalationCopy[status]}” by Corporation desk. ${dataMode === "demo" ? "Demo change recorded locally." : "The transition was committed to the audit trail."}`);
  }

  async function publishCorporationNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = noticeText.trim();
    if (!body) return;
    let noticeId = `corporation-local-${noticeSequence.current + 1}`;
    if (dataMode === "supabase") {
      const result = await publishLiveNotice({ municipalityId: data.municipality.id, wardId: null, body });
      if (!result.ok) {
        setActivity(result.error.message);
        return;
      }
      noticeId = result.data.id;
    }
    noticeSequence.current += 1;
    const notice: Notice = { id: noticeId, municipalityId: data.municipality.id, wardId: null, authorName: "Corporation desk", body, createdAt: new Date().toISOString() };
    setNotices((current) => [notice, ...current]); setNoticeText("");
    setActivity(dataMode === "demo" ? "Corporation notice added locally as synthetic demo content." : "Corporation notice published to all wards.");
  }

  if (selectedWard) {
    const wardIssues = allIssues.filter((issue) => issue.wardId === selectedWard.id);
    const requestedIssues = wardIssues.filter((issue) => issue.status === "requested");
    const inProgressIssues = wardIssues.filter((issue) => issue.status === "in_progress");
    const completedIssues = wardIssues.filter((issue) => issue.status === "completed");
    const wardEscalations = escalations.filter((item) => item.wardId === selectedWard.id);
    const currentParshad = data.officials.find((official) => official.wardId === selectedWard.id && official.current);
    const wardExpenditures = data.expenditures.filter((expense) => expense.wardId === selectedWard.id);
    const wardAlerts = data.alerts.filter((alert) => alert.wardIds.includes(selectedWard.id));
    const remainingBudget = selectedWard.allocatedBudget - selectedWard.spentBudget;
    const budgetUsed = selectedWard.allocatedBudget > 0 ? Math.round((selectedWard.spentBudget / selectedWard.allocatedBudget) * 100) : 0;
    const recentIssues = [...wardIssues].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, 5);
    const wardLocality = wardLocalityName(selectedWard.name);

    return <main className={styles.workspace} aria-label={`Corporation review for Ward ${selectedWard.number}`}>
      <div className={styles.drillNav}><button type="button" className={styles.drillBack} onClick={returnToOverview}><ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" /> Corporation overview</button><span>Ward drill-down / वार्ड समीक्षा</span></div>
      <header className={styles.masthead}>
        <div><p className={styles.eyebrow}>Corporation desk · Ward review</p><h1>Ward {selectedWard.number}{wardLocality ? <><span> · </span>{wardLocality}</> : null}</h1><p className={styles.roleLine}><b>{currentParshad?.name ?? "Parshad not assigned"}</b> · {currentParshad ? "Current ward representative" : "Term record requires review"}</p></div>
        <div className={styles.wardStamp} aria-label={`${completedIssues.length} fixed issues`}><b>{completedIssues.length}</b><span>fixed<br />issues</span></div>
      </header>
      <WorkspaceNotice dataMode={dataMode} />

      <section className={styles.ledgerSummary} aria-label={`Ward ${selectedWard.number} indicators`}>
        <div><span>Requested</span><strong>{requestedIssues.length}</strong><small>Awaiting ward action</small></div>
        <div><span>In progress</span><strong>{inProgressIssues.length}</strong><small>Work recorded</small></div>
        <div><span>Fixed</span><strong>{completedIssues.length}</strong><small>Fixed public reports</small></div>
        <div><span>Open escalations</span><strong>{wardEscalations.filter((item) => item.status !== "resolved").length}</strong><small>Corporation follow-ups</small></div>
      </section>

      <section className={styles.section} aria-labelledby="ward-register-title">
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>Issue register</p><h2 id="ward-register-title">Ward work by status</h2></div><p>Rejected reports remain in public history and are not counted as active work.</p></div>
        <div className={styles.drillIssueGrid}>
          <WardIssueSection title="Requested" hint="Needs a decision" issues={requestedIssues} />
          <WardIssueSection title="In progress" hint="Work underway" issues={inProgressIssues} />
          <WardIssueSection title="Fixed" hint="Public record" issues={completedIssues} />
        </div>
      </section>

      <div className={styles.secondaryColumns}>
        <section className={styles.section} aria-labelledby="ward-budget-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward budget</p><h2 id="ward-budget-title">Allocation & spending</h2></div></div>
          <dl className={styles.budgetLedger}><div><dt>Allocated</dt><dd>{formatRupees(selectedWard.allocatedBudget)}</dd></div><div><dt>Spent</dt><dd>{formatRupees(selectedWard.spentBudget)}</dd></div><div><dt>Remaining</dt><dd>{formatRupees(remainingBudget)}</dd></div><div><dt>Used</dt><dd>{budgetUsed}%</dd></div></dl>
          {wardExpenditures.length > 0 ? <ol className={styles.expenditureList}>{wardExpenditures.map((item) => <li key={item.id}><div><b>{item.description}</b><small>{formatDate(item.spentAt)}</small></div><strong>{formatRupees(item.amount)}</strong></li>)}</ol> : <p className={styles.emptyRecord}>No expenditure records have been published for this ward.</p>}
        </section>
        <section className={styles.section} aria-labelledby="ward-activity-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward activity</p><h2 id="ward-activity-title">Latest public changes</h2></div></div>
          {recentIssues.length > 0 ? <ol className={styles.activityList}>{recentIssues.map((issue) => <li key={issue.id}><div><b>{issue.title}</b><span>{statusCopy[issue.status]}</span></div><small>Updated {formatDate(issue.updatedAt)}</small></li>)}</ol> : <p className={styles.emptyRecord}>No issue activity has been recorded for this ward.</p>}
          {wardAlerts.length > 0 && <div className={styles.wardChecks}><p className={styles.kicker}>Operational checks</p>{wardAlerts.map((alert) => <p key={alert.id}><b>{alert.completed ? "Complete" : "Action needed"}</b><span>{alert.title} · Due {formatDate(alert.dueAt)}</span></p>)}</div>}
        </section>
      </div>

      <section className={`${styles.section} ${styles.compliance}`} aria-labelledby="ward-review-boundary"><p className={styles.kicker}>Review boundary</p><h2 id="ward-review-boundary">Corporation view, ward context</h2><div><AuditLine>This view uses Ward {selectedWard.number}&apos;s live public records and current term assignment.</AuditLine><AuditLine>Private phone and household details are not included.</AuditLine><AuditLine>{wardEscalations.length} escalation record{wardEscalations.length === 1 ? "" : "s"} linked to this ward.</AuditLine></div></section>
    </main>;
  }

  return <main className={styles.workspace} aria-label="Corporation administration workspace">
    <header className={styles.masthead}>
      <div><p className={styles.eyebrow}>Corporation desk / निगम डेस्क</p><h1>{data.municipality.name}</h1><p className={styles.roleLine}>Cross-ward review · {data.municipality.district}, {data.municipality.state}</p></div>
      <div className={styles.wardStamp} aria-label={`${data.municipality.wardCount} wards`}><b>{data.municipality.wardCount}</b><span>wards<br />in register</span></div>
    </header>
    <WorkspaceNotice dataMode={dataMode} />
    <section className={styles.ledgerSummary} aria-label="Corporation indicators"><div><span>Total reports</span><strong>{allIssues.length}</strong><small>{unresolved} still active</small></div><div><span>Escalations</span><strong>{activeEscalations.length}</strong><small>Require tracking</small></div><div><span>Ward coverage</span><button type="button" className={styles.metricButton} onClick={() => document.getElementById("ward-overview")?.scrollIntoView({ behavior: "smooth" })}><strong>{coveredWardIds.size}/{data.wards.length}</strong><small>Open ward register ↓</small></button></div><div><span>Compliance signal</span><strong>{compliancePercent}%</strong><small>Status updated or closed</small></div></section>

    <section id="ward-overview" className={styles.section} aria-labelledby="ward-overview-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward register</p><h2 id="ward-overview-title">Choose a ward</h2></div><p>Select a ward number to open its full review.</p></div>
      <div className={styles.wardPicker}><label htmlFor="corporation-ward-select">Ward number</label><select id="corporation-ward-select" defaultValue="" onChange={(event) => { if (event.target.value) openWard(event.target.value); }}><option value="">Select a ward</option>{data.wards.map((ward) => <option key={ward.id} value={ward.id}>Ward {ward.number}</option>)}</select></div>
    </section>

    <section className={styles.section} aria-labelledby="escalation-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Escalated issues</p><h2 id="escalation-title">Corporation follow-up register</h2></div><p>Open a ward to read its full issue and activity record.</p></div>
      {escalations.length > 0 ? <div className={styles.tableWrap}><table className={`${styles.wardTable} ${styles.escalationTable}`}><thead><tr><th>Ward</th><th>Parshad</th><th>Issue</th><th>Budget</th><th>Requested</th><th>Status</th><th>Ward record</th></tr></thead><tbody>{escalations.map((item) => { const ward = data.wards.find((candidate) => candidate.id === item.wardId); const used = ward && ward.allocatedBudget > 0 ? Math.round((ward.spentBudget / ward.allocatedBudget) * 100) : 0; return <tr key={item.id}><td data-label="Ward"><div><b>{item.wardNumber}</b><span>{ward ? wardLocalityName(ward.name) ?? `Ward ${item.wardNumber}` : "Ward record"}</span></div></td><td data-label="Parshad"><b>{item.parshadName}</b><span>Current representative</span></td><td data-label="Issue"><b>{item.issueTitle}</b><span>{item.reason}</span></td><td data-label="Budget"><b>{formatRupees(ward?.spentBudget ?? 0)}</b><span>{used}% used</span></td><td data-label="Requested"><b>{formatDate(item.createdAt)}</b><span>Corporation follow-up</span></td><td data-label="Status"><label className={styles.statusSelect}><span>Corporation status</span><select value={item.status} onChange={(event) => updateEscalation(item.id, event.target.value as Escalation["status"])}><option value="open">Open / खुला</option><option value="acknowledged">Acknowledged / संज्ञान में</option><option value="resolved">Resolved / समाधान</option></select></label></td><td data-label="Ward record"><button type="button" className={styles.tableAction} onClick={() => openWard(item.wardId)}>Open ward →</button></td></tr>; })}</tbody></table></div> : <div className={styles.emptyState}><b>No escalated issues</b><p>New ward escalations will appear here with their request date, budget context, and responsible Parshad.</p></div>}
    </section>

    <section className={styles.section} aria-labelledby="budget-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Public spending</p><h2 id="budget-title">Municipality budget & expenditure</h2></div></div><div className={styles.budgetTotal}><span>All wards in this register</span><strong>{formatRupees(spent)}</strong><small>of {formatRupees(allocated)} allocated</small></div><ol className={styles.expenditureList}>{data.expenditures.map((item) => { const ward = data.wards.find((candidate) => candidate.id === item.wardId); return <li key={item.id}><div><b>Ward {ward?.number} · {item.description}</b><small>{formatDate(item.spentAt)}</small></div><strong>{formatRupees(item.amount)}</strong></li>; })}</ol></section>

    <div className={styles.secondaryColumns}>
      <section className={styles.section} aria-labelledby="alerts-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Operational alerts</p><h2 id="alerts-title">Upcoming & overdue checks</h2></div></div><ul className={styles.alertList}>{data.alerts.map((alert) => <li key={alert.id}><span className={alert.completed ? styles.doneMark : styles.openMark}>{alert.completed ? "Complete" : "Action"}</span><div><b>{alert.title}</b><p>{alert.description}</p><small>Due {formatDate(alert.dueAt)} · Wards {alert.wardIds.map((id) => data.wards.find((ward) => ward.id === id)?.number).join(", ")}</small></div></li>)}</ul></section>
      <section className={styles.section} aria-labelledby="publish-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Public notices</p><h2 id="publish-title">Publish a corporation update</h2></div></div><form className={styles.noticeForm} onSubmit={publishCorporationNotice}><label htmlFor="corp-notice">Notice text <span>(public to all wards)</span></label><textarea id="corp-notice" value={noticeText} onChange={(event) => setNoticeText(event.target.value)} placeholder="Example: Ward sabha records will be published…" maxLength={280} /><div><small>{noticeText.length}/280</small><button type="submit" disabled={!noticeText.trim()}>{dataMode === "demo" ? "Publish local draft" : "Publish corporation notice"}</button></div></form><ol className={styles.noticeList}>{notices.map((notice) => <li key={notice.id}><p>{notice.body}</p><small>{notice.authorName} · {formatDate(notice.createdAt)}</small></li>)}</ol></section>
    </div>
    <section className={`${styles.section} ${styles.compliance}`} aria-labelledby="corp-audit-title"><p className={styles.kicker}>Audit record</p><h2 id="corp-audit-title">Decision feedback</h2><div role="status"><AuditLine>{activity}</AuditLine><AuditLine>Corporation accounts do not expose ward-private citizen contact or house data by default.</AuditLine></div></section>
  </main>;
}
