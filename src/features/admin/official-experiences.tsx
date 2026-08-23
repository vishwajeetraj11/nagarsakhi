"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { PublicDemoData } from "@/data/demo";
import { CitizenExperience } from "@/features/citizen/CitizenExperience";
import type { WardIssuesResult } from "@/lib/data/live";
import { publishLiveNotice, setLiveAlertCompletion, transitionLiveEscalation, transitionLiveIssue } from "@/lib/data/live-mutations";
import type { DemoSession, Escalation, IssueStatus, Notice } from "@/lib/domain/types";
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
  completed: "Completed / पूर्ण",
};

const statusClass: Record<IssueStatus, string> = {
  requested: styles.requested,
  in_progress: styles.inProgress,
  completed: styles.completed,
};

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

export function ParshadExperience({ data, dataMode, session, onWardIssuesLoad }: ExperienceProps) {
  const [citizenView, setCitizenView] = useState(false);
  const ward = data.wards.find((item) => item.id === session?.wardId) ?? data.wards.find((item) => item.number === 12) ?? data.wards[0];
  const official = data.officials.find((item) => item.wardId === ward?.id && item.current);
  const [issues, setIssues] = useState(() => data.issues.filter((item) => item.wardId === ward?.id));
  const [selectedIssueId, setSelectedIssueId] = useState(issues[0]?.id ?? "");
  const [auditMessage, setAuditMessage] = useState(dataMode === "demo" ? "No pending official action in this demo session." : "No pending official action in this session.");
  const [completedTasks, setCompletedTasks] = useState<string[]>(data.alerts.filter((alert) => alert.completed).map((alert) => alert.id));
  const [noticeText, setNoticeText] = useState("");
  const [notices, setNotices] = useState(() => data.notices.filter((notice) => notice.wardId === ward?.id));
  const noticeSequence = useRef(0);
  const selectedIssue = issues.find((item) => item.id === selectedIssueId) ?? issues[0];
  const activeTasks = data.alerts.filter((alert) => alert.wardIds.includes(ward?.id ?? ""));
  const requestedCount = issues.filter((item) => item.status === "requested").length;
  const completedCount = issues.filter((item) => item.status === "completed").length;
  const residents = data.publicProfiles.filter((person) => person.wardId === ward?.id).length;
  const wardEscalations = data.escalations.filter((item) => item.wardId === ward?.id);

  if (citizenView) {
    return <>
      <div className={styles.viewSwitchBar}>
        <span>Citizen view · reading the public ward record</span>
        <button type="button" onClick={() => setCitizenView(false)}>Back to Parshad desk</button>
      </div>
      <CitizenExperience data={data} dataMode={dataMode} session={session ? { ...session, role: "citizen" } : undefined} readOnly routing={false} onWardIssuesLoad={onWardIssuesLoad} />
    </>;
  }

  async function changeStatus(issueId: string, status: IssueStatus) {
    const target = issues.find((item) => item.id === issueId);
    if (!target || target.status === status) return;
    if (dataMode === "supabase") {
      if (status === "requested") {
        setAuditMessage("Live issue status can only move forward; reopening requires a separate reviewed action.");
        return;
      }
      const result = await transitionLiveIssue(issueId, status, `Updated from the Ward ${ward?.number ?? ""} official workspace.`);
      if (!result.ok) {
        setAuditMessage(result.error.message);
        return;
      }
    }
    setIssues((current) => current.map((item) => item.id === issueId ? { ...item, status, updatedAt: new Date().toISOString() } : item));
    setAuditMessage(`${target.id.toUpperCase()} marked “${statusCopy[status]}” by ${official?.name ?? "Ward official"}. ${dataMode === "demo" ? "Demo change recorded locally." : "The live audit trail records this transition."}`);
  }

  async function publishWardNotice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = noticeText.trim();
    if (!body || !ward) return;
    let noticeId = `notice-local-${noticeSequence.current + 1}`;
    if (dataMode === "supabase") {
      const result = await publishLiveNotice({ municipalityId: data.municipality.id, wardId: ward.id, body });
      if (!result.ok) {
        setAuditMessage(result.error.message);
        return;
      }
      noticeId = result.data.id;
    }
    noticeSequence.current += 1;
    const notice: Notice = { id: noticeId, municipalityId: data.municipality.id, wardId: ward.id, authorName: official?.name ?? "Ward Parshad", body, createdAt: new Date().toISOString() };
    setNotices((current) => [notice, ...current]);
    setNoticeText("");
    setAuditMessage(dataMode === "demo" ? `Draft notice published locally by ${notice.authorName}. It remains demo data.` : `Public ward notice published by ${notice.authorName}.`);
  }

  if (!ward) return null;

  return <main className={styles.workspace} aria-label="Ward 12 Parshad workspace">
    <header className={styles.masthead}>
      <div>
        <p className={styles.eyebrow}>Parshad desk / पार्षद डेस्क</p>
        <h1>Ward 12 <span>·</span> Nehru Nagar</h1>
        <p className={styles.roleLine}>{official?.name ?? "Ward Parshad"} <b>Ward Parshad</b> · {data.municipality.name}</p>
      </div>
      <div className={styles.wardStamp} aria-label="Ward 12 context"><b>12</b><span>ward<br />register</span></div>
    </header>
    <div className={styles.roleSwitchBar} role="group" aria-label="Role view">
      <span>Viewing as <b>Parshad</b></span>
      <button type="button" onClick={() => setCitizenView(true)}>View as Citizen</button>
    </div>
    <WorkspaceNotice dataMode={dataMode} />

    <section className={styles.ledgerSummary} aria-label="Ward 12 summary">
      <div><span>Residents listed</span><strong>{residents}</strong><small>Public names only</small></div>
      <div><span>Needs action</span><strong>{requestedCount}</strong><small>Resident reports</small></div>
      <div><span>Closed</span><strong>{completedCount}</strong><small>Verified updates</small></div>
      <div><span>Ward balance</span><strong>{formatRupees(ward.allocatedBudget - ward.spentBudget)}</strong><small>of {formatRupees(ward.allocatedBudget)}</small></div>
    </section>

    <section id="ward-workflow" className={styles.section} aria-labelledby="workflow-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.kicker}>Issue register</p><h2 id="workflow-title">Decide the next clear step</h2></div>
        <p>{issues.length} reports · status changes are recorded in the audit note below.</p>
      </div>
      <div className={styles.issueLayout}>
        <div className={styles.issueList} aria-label="Ward 12 issue list">
          {issues.map((issue, index) => <button key={issue.id} className={`${styles.issueRow} ${selectedIssue?.id === issue.id ? styles.activeIssue : ""}`} onClick={() => setSelectedIssueId(issue.id)} aria-pressed={selectedIssue?.id === issue.id}>
            <span className={styles.issueNumber}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.issueWords}><b>{issue.title}</b><small>{issue.id.toUpperCase()} · {formatDate(issue.createdAt)} · {issue.upvotes} supports</small></span>
            <StatusPill status={issue.status} />
          </button>)}
        </div>
        {selectedIssue && <article className={styles.issueDetail} aria-live="polite">
          <div className={styles.detailTop}><span className={styles.recordNumber}>{selectedIssue.id.toUpperCase()}</span><StatusPill status={selectedIssue.status} /></div>
          <h3>{selectedIssue.title}</h3>
          <p className={styles.issueDescription}>{selectedIssue.description}</p>
          <dl className={styles.detailMeta}><div><dt>Reporter</dt><dd>{selectedIssue.reporterName}</dd></div><div><dt>Language</dt><dd>{selectedIssue.originalLanguage === "hi" ? "Hindi / हिन्दी" : "English"}</dd></div><div><dt>Last record</dt><dd>{formatDate(selectedIssue.updatedAt)}</dd></div></dl>
          {selectedIssue.media.length > 0 && <div className={styles.evidence}><p className={styles.kicker}>Attached evidence</p><div className={styles.evidenceStrip}>{selectedIssue.media.map((media) => <figure key={media.id}>{media.kind === "video" ? <video src={media.url} controls preload="metadata" width={144} height={104} aria-label={media.alt ?? "Issue video evidence"} /> : <Image src={media.url} alt={media.alt ?? "Issue evidence"} width={144} height={104} unoptimized={dataMode === "supabase"} />}<figcaption>{media.kind === "photo" ? "Photo evidence" : media.kind === "video" ? "Video evidence" : "Audio statement"}</figcaption></figure>)}</div></div>}
          <fieldset className={styles.statusField}><legend>Record a status update</legend><p>{dataMode === "demo" ? "Choose an explicit status. This demo records the change locally; it does not publish an official decision." : "Choose the next explicit status. Live transitions are role-checked and audited."}</p><div className={styles.statusActions}>{(["requested", "in_progress", "completed"] as IssueStatus[]).map((status) => <button type="button" key={status} onClick={() => changeStatus(selectedIssue.id, status)} className={selectedIssue.status === status ? styles.currentStatus : ""} aria-pressed={selectedIssue.status === status}>{statusCopy[status]}</button>)}</div></fieldset>
          {selectedIssue.escalated && <div className={styles.escalationBand}><b>Escalated / प्रेषित</b><span>This report has a corporation follow-up record. Keep the resident update specific.</span></div>}
        </article>}
      </div>
      <div className={styles.auditFeedback} role="status"><b>Audited feedback</b><AuditLine>{auditMessage}</AuditLine></div>
    </section>

    <div className={styles.secondaryColumns}>
      <section className={styles.section} aria-labelledby="tasks-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Ward calendar</p><h2 id="tasks-title">Required follow-ups</h2></div></div>
        <ul className={styles.taskList}>{activeTasks.map((task) => { const done = completedTasks.includes(task.id); return <li key={task.id}><label><input type="checkbox" checked={done} onChange={async () => { const nextDone = !done; if (dataMode === "supabase") { const result = await setLiveAlertCompletion(task.id, nextDone); if (!result.ok) { setAuditMessage(result.error.message); return; } } setCompletedTasks((current) => done ? current.filter((id) => id !== task.id) : [...current, task.id]); setAuditMessage(`${task.title} marked ${nextDone ? "complete" : "open"}${dataMode === "demo" ? " in this local demo session" : ""}.`); }} /><span><b>{task.title}</b><small>Due {formatDate(task.dueAt)} · {task.description}</small></span></label><span className={done ? styles.doneMark : styles.openMark}>{done ? "Complete" : "Open"}</span></li>; })}</ul>
      </section>
      <section className={styles.section} aria-labelledby="notice-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Resident notice</p><h2 id="notice-title">Share a ward update</h2></div></div>
        <form className={styles.noticeForm} onSubmit={publishWardNotice}><label htmlFor="ward-notice">Notice text <span>(public)</span></label><textarea id="ward-notice" value={noticeText} onChange={(event) => setNoticeText(event.target.value)} placeholder="Example: Drain cleaning will begin on…" maxLength={280} /><div><small>{noticeText.length}/280</small><button type="submit" disabled={!noticeText.trim()}>{dataMode === "demo" ? "Publish local draft" : "Publish ward notice"}</button></div></form>
        <ol className={styles.noticeList}>{notices.map((notice) => <li key={notice.id}><p>{notice.body}</p><small>{notice.authorName} · {formatDate(notice.createdAt)}</small></li>)}</ol>
      </section>
    </div>
    <section className={`${styles.section} ${styles.compliance}`} aria-labelledby="compliance-title"><p className={styles.kicker}>Compliance & privacy</p><h2 id="compliance-title">Ward record boundaries</h2><div><AuditLine>Public register displays names and report content only; household and phone details stay outside this view.</AuditLine><AuditLine>{wardEscalations.length} Ward 12 escalation{wardEscalations.length === 1 ? " is" : "s are"} visible to the corporation queue.</AuditLine><AuditLine>Budget figures are synthetic and shown for ward-level transparency.</AuditLine></div></section>
  </main>;
}

export function CorporationExperience({ data, dataMode }: ExperienceProps) {
  const [escalations, setEscalations] = useState(data.escalations);
  const [noticeText, setNoticeText] = useState("");
  const [notices, setNotices] = useState(data.notices.filter((notice) => notice.wardId === null));
  const [activity, setActivity] = useState(dataMode === "demo" ? "No corporation action recorded in this demo session." : "No corporation action recorded in this session.");
  const noticeSequence = useRef(0);
  const watchedWards = data.wards.filter((ward) => [7, 12, 18].includes(ward.number));
  const allIssues = data.issues;
  const unresolved = allIssues.filter((issue) => issue.status !== "completed").length;
  const spent = watchedWards.reduce((sum, ward) => sum + ward.spentBudget, 0);
  const allocated = watchedWards.reduce((sum, ward) => sum + ward.allocatedBudget, 0);
  const compliancePercent = Math.round((allIssues.filter((issue) => issue.status !== "requested").length / allIssues.length) * 100);

  const issuesByWard = watchedWards.map((ward) => ({ ward, issues: allIssues.filter((issue) => issue.wardId === ward.id), escalations: escalations.filter((item) => item.wardId === ward.id) }));

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
    setActivity(`${item?.issueId.toUpperCase() ?? "Escalation"} marked “${escalationCopy[status]}” by Corporation desk. ${dataMode === "demo" ? "Demo change recorded locally." : "The transition was committed to the audit trail."}`);
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

  return <main className={styles.workspace} aria-label="Corporation administration workspace">
    <header className={styles.masthead}>
      <div><p className={styles.eyebrow}>Corporation desk / निगम डेस्क</p><h1>{data.municipality.name}</h1><p className={styles.roleLine}>Cross-ward review · {data.municipality.district}, {data.municipality.state}</p></div>
      <div className={styles.wardStamp} aria-label={`${data.municipality.wardCount} wards`}><b>{data.municipality.wardCount}</b><span>wards<br />in register</span></div>
    </header>
    <WorkspaceNotice dataMode={dataMode} />
    <section className={styles.ledgerSummary} aria-label="Corporation indicators"><div><span>Open reports</span><strong>{unresolved}</strong><small>Across active wards</small></div><div><span>Escalations</span><strong>{escalations.filter((item) => item.status !== "resolved").length}</strong><small>Require tracking</small></div><div><span>Term coverage</span><strong>3/3</strong><small>Active parshads listed</small></div><div><span>Compliance signal</span><strong>{compliancePercent}%</strong><small>Status updated or closed</small></div></section>

    <section id="ward-overview" className={styles.section} aria-labelledby="ward-overview-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Cross-ward register</p><h2 id="ward-overview-title">Where intervention is needed</h2></div><p>Compact records become labelled entries on small screens.</p></div>
      <div className={styles.tableWrap}><table className={styles.wardTable}><thead><tr><th>Ward</th><th>Parshad & term</th><th>Issues</th><th>Escalation</th><th>Budget used</th><th>Compliance</th></tr></thead><tbody>{issuesByWard.map(({ ward, issues, escalations: wardEscalations }) => { const official = data.officials.find((person) => person.wardId === ward.id && person.current); const inFlight = issues.filter((issue) => issue.status !== "completed").length; const used = Math.round((ward.spentBudget / ward.allocatedBudget) * 100); return <tr key={ward.id}><td data-label="Ward"><b>{ward.number}</b><span>{ward.name}</span></td><td data-label="Parshad & term"><b>{official?.name ?? "Unassigned"}</b><span>{official?.current ? "Current term · Active" : "Term record pending"}</span></td><td data-label="Issues"><b>{inFlight} in progress</b><span>{issues.filter((issue) => issue.status === "completed").length} closed</span></td><td data-label="Escalation"><b>{wardEscalations.length ? escalationCopy[wardEscalations[0].status] : "None"}</b><span>{wardEscalations[0]?.issueId.toUpperCase() ?? "No record"}</span></td><td data-label="Budget used"><b>{formatRupees(ward.spentBudget)}</b><span>{used}% of {formatRupees(ward.allocatedBudget)}</span></td><td data-label="Compliance"><b>{inFlight <= 2 ? "On track" : "Review"}</b><span>{inFlight <= 2 ? "Recent updates present" : "Response window watch"}</span></td></tr>; })}</tbody></table></div>
    </section>

    <div className={styles.secondaryColumns}>
      <section className={styles.section} aria-labelledby="escalation-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Escalation queue</p><h2 id="escalation-title">Assign a visible outcome</h2></div></div><div className={styles.escalationList}>{escalations.map((item) => <article key={item.id}><div><span className={styles.recordNumber}>{item.issueId.toUpperCase()} · Ward {item.wardNumber}</span><h3>{item.issueTitle}</h3><p>{item.reason}</p></div><label>Corporation status<select value={item.status} onChange={(event) => updateEscalation(item.id, event.target.value as Escalation["status"])}><option value="open">Open / खुला</option><option value="acknowledged">Acknowledged / संज्ञान में</option><option value="resolved">Resolved / समाधान</option></select></label></article>)}</div></section>
      <section className={styles.section} aria-labelledby="budget-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Public spending</p><h2 id="budget-title">Budget & expenditure</h2></div></div><div className={styles.budgetTotal}><span>Tracked wards</span><strong>{formatRupees(spent)}</strong><small>of {formatRupees(allocated)} allocated</small></div><ol className={styles.expenditureList}>{data.expenditures.map((item) => { const ward = data.wards.find((candidate) => candidate.id === item.wardId); return <li key={item.id}><div><b>Ward {ward?.number} · {item.description}</b><small>{formatDate(item.spentAt)}</small></div><strong>{formatRupees(item.amount)}</strong></li>; })}</ol></section>
    </div>

    <div className={styles.secondaryColumns}>
      <section className={styles.section} aria-labelledby="alerts-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Operational alerts</p><h2 id="alerts-title">Upcoming & overdue checks</h2></div></div><ul className={styles.alertList}>{data.alerts.map((alert) => <li key={alert.id}><span className={alert.completed ? styles.doneMark : styles.openMark}>{alert.completed ? "Complete" : "Action"}</span><div><b>{alert.title}</b><p>{alert.description}</p><small>Due {formatDate(alert.dueAt)} · Wards {alert.wardIds.map((id) => data.wards.find((ward) => ward.id === id)?.number).join(", ")}</small></div></li>)}</ul></section>
      <section className={styles.section} aria-labelledby="publish-title"><div className={styles.sectionHeading}><div><p className={styles.kicker}>Public notices</p><h2 id="publish-title">Publish a corporation update</h2></div></div><form className={styles.noticeForm} onSubmit={publishCorporationNotice}><label htmlFor="corp-notice">Notice text <span>(public to all wards)</span></label><textarea id="corp-notice" value={noticeText} onChange={(event) => setNoticeText(event.target.value)} placeholder="Example: Ward sabha records will be published…" maxLength={280} /><div><small>{noticeText.length}/280</small><button type="submit" disabled={!noticeText.trim()}>{dataMode === "demo" ? "Publish local draft" : "Publish corporation notice"}</button></div></form><ol className={styles.noticeList}>{notices.map((notice) => <li key={notice.id}><p>{notice.body}</p><small>{notice.authorName} · {formatDate(notice.createdAt)}</small></li>)}</ol></section>
    </div>
    <section className={`${styles.section} ${styles.compliance}`} aria-labelledby="corp-audit-title"><p className={styles.kicker}>Audit record</p><h2 id="corp-audit-title">Decision feedback</h2><div role="status"><AuditLine>{activity}</AuditLine><AuditLine>Corporation accounts do not expose ward-private citizen contact or house data by default.</AuditLine></div></section>
  </main>;
}
