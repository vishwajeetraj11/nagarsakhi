import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";

import type { PublicDemoData } from "@/data/demo";
import type { DemoSession, Official } from "@/lib/domain/types";
import { formatWardNumber } from "@/lib/domain/ward-label";

type MunicipalityPageProps = { data: PublicDemoData; session: DemoSession };

const formatRupees = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
const currentParshadForWard = (officials: Official[], wardId: string) => officials.find((official) => official.current && official.wardId === wardId && official.roleLabel.toLowerCase().includes("parshad"));

export function MunicipalityPage({ data }: MunicipalityPageProps) {
  const totalAllocated = data.wards.reduce((sum, ward) => sum + ward.allocatedBudget, 0);

  return <main className="municipality-page" id="main-content">
    <header className="municipality-hero"><div><p className="municipality-kicker">Municipality record / नगर रिकॉर्ड</p><h1>{data.municipality.name}</h1><p className="municipality-location"><MapPin size={16} aria-hidden="true" /> {data.municipality.district}, {data.municipality.state}</p><p className="municipality-lede">A read-only public account of the wards, representatives, and civic funds recorded for this municipality.</p></div><div className="municipality-stamp" aria-label={`${data.wards.length} wards in register`}><strong>{data.wards.length}</strong><span>wards<br />in register</span></div></header>
    <div className="municipality-notice" role="note"><strong>Public record</strong><span>Only municipality, ward, representative, and public finance fields are shown here. Private resident details are not part of this page.</span></div>
    <section className="municipality-section" aria-labelledby="municipality-details-title"><div className="municipality-section-heading"><div><p className="municipality-kicker">At a glance</p><h2 id="municipality-details-title">Municipality details</h2></div></div><dl className="municipality-facts"><div><dt>District</dt><dd>{data.municipality.district}</dd></div><div><dt>State</dt><dd>{data.municipality.state}</dd></div><div><dt>Ward count</dt><dd>{data.wards.length}</dd></div><div><dt>Total allocation</dt><dd>{formatRupees(totalAllocated)}</dd></div></dl></section>
    <section className="municipality-section" aria-labelledby="ward-register-title"><div className="municipality-section-heading"><div><p className="municipality-kicker">Ward register</p><h2 id="ward-register-title">Ward representatives</h2></div></div><div className="municipality-ward-table-wrap"><table className="municipality-ward-table"><thead><tr><th scope="col">Ward</th><th scope="col">Ward Parshad</th><th scope="col">Term</th><th scope="col">Allocation</th><th scope="col">Actions</th></tr></thead><tbody>{data.wards.map((ward) => { const representative = currentParshadForWard(data.officials, ward.id); return <tr key={ward.id}><th scope="row" data-label="Ward">{formatWardNumber(ward.number)}</th><td data-label="Ward Parshad">{representative ? <Link className="municipality-table-person" href={`/officials/${encodeURIComponent(representative.id)}`} aria-label={`View ${representative.name}'s public Parshad profile`}>{representative.name}</Link> : <span className="municipality-missing">Not listed</span>}</td><td data-label="Term">{representative?.termNumber ? `${representative.termNumber}${representative.termNumber === 1 ? "st" : representative.termNumber === 2 ? "nd" : representative.termNumber === 3 ? "rd" : "th"} term` : <span className="municipality-missing">Term not recorded</span>}</td><td data-label="Allocation"><strong className="municipality-table-amount">{formatRupees(ward.allocatedBudget)}</strong></td><td data-label="Actions"><Link className="municipality-table-action" href={`/wards?ward=${ward.id}`}>Open ward <ArrowUpRight size={15} aria-hidden="true" /></Link></td></tr>; })}</tbody></table></div></section>
  </main>;
}
