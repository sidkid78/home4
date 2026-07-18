import React, { useState } from 'react';
import { ProcessResult, DemoActors, HealthScore, Measurement } from '../../types/report.types';
import { apiFetch } from '../../lib/apiFetch';

const SEVERITY_STYLES: Record<string, string> = {
  HIGH: 'bg-red-500/15 border-red-500/40 text-red-300',
  MEDIUM: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  LOW: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
};

// ADA / aging-in-place reference targets, inches.
const ADA_TARGETS: Record<Measurement['feature'], { label: string; ok: (v: number) => boolean; target: string }> = {
  doorway_width: { label: 'Doorway width', target: '≥ 32"', ok: (v) => v >= 32 },
  counter_height: { label: 'Counter height', target: '≤ 34"', ok: (v) => v <= 34 },
  toilet_height: { label: 'Toilet height', target: '17–19"', ok: (v) => v >= 17 && v <= 19 },
  grab_bar_height: { label: 'Grab bar height', target: '33–36"', ok: (v) => v >= 33 && v <= 36 },
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

interface Props {
  result: ProcessResult;
  actors: DemoActors;
  onRestart: () => void;
}

export const AssessmentReport: React.FC<Props> = ({ result, actors, onRestart }) => {
  const { report, assessment, boq, lead, hitlStatus } = result;
  const [leadStatus, setLeadStatus] = useState(lead.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthScore | null>(result.health);
  const [cert, setCert] = useState<any | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const materialsTotal = boq.reduce((s, b) => s + b.price * b.qty, 0);

  const purchaseLead = async () => {
    setBusy('purchase');
    setMsg(null);
    try {
      const res = await apiFetch('/v1/dev/purchase-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, contractorId: actors.contractorId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Purchase failed');
      setLeadStatus('SOLD');
      setMsg('Lead purchased — full report unlocked for the contractor.');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const recordModification = async () => {
    setBusy('modify');
    setMsg(null);
    try {
      const res = await apiFetch(`/v1/properties/${actors.propertyId}/modifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': actors.contractorId,
          'x-user-role': 'contractor',
        },
        body: JSON.stringify({
          actionTaken: assessment.risks[0]?.recommendation || 'Completed safety modification',
          verificationMedia: ['mock://storage/modifications/verified.jpg'],
          leadId: lead.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to record');
      const data = await res.json();
      setHealth(data.updatedScore);
      setMsg('Modification recorded — property health score recalculated.');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  const viewCertificate = async () => {
    setBusy('cert');
    setMsg(null);
    try {
      const res = await apiFetch(`/v1/properties/${actors.propertyId}/certificate`, {
        headers: { 'x-user-id': actors.ownerId, 'x-user-role': 'homeowner' },
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate certificate');
      setCert(await res.json());
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-y-auto">
      <div className="max-w-md mx-auto px-5 py-8 space-y-6 pb-16">
        {/* Header */}
        <header className="space-y-1">
          <p className="text-blue-400 text-sm font-semibold tracking-wide uppercase">Assessment Report</p>
          <h1 className="text-2xl font-bold">Home Safety Analysis</h1>
          <p className="text-neutral-400 text-sm leading-relaxed">{assessment.roomSummary}</p>
        </header>

        {/* Priority + ROI stat row */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Priority" value={report.priority} accent={report.priority} />
          <Stat label="Est. cost" value={money(report.estimatedValue)} />
          <Stat label="Safety ROI" value={`${Math.round(report.roiValue)}%`} accent="LOW" />
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className={`px-2 py-1 rounded-full border ${hitlStatus === 'NEEDS_REVIEW' ? 'border-amber-500/40 text-amber-300' : 'border-emerald-500/40 text-emerald-300'}`}>
            {hitlStatus === 'NEEDS_REVIEW' ? '⚑ Needs expert review' : '✓ AI validated'}
          </span>
          <span>Confidence {Math.round(assessment.confidenceScore * 100)}%</span>
        </div>

        {/* Risks */}
        <Section title={`Identified Risks (${assessment.risks.length})`}>
          {assessment.risks.map((r) => (
            <div key={r.id} className={`rounded-xl border p-4 ${SEVERITY_STYLES[r.severity]}`}>
              <div className="flex justify-between items-start gap-3">
                <span className="font-semibold text-sm">{r.category.replace('_', ' ')}</span>
                <span className="text-xs font-bold uppercase">{r.severity}</span>
              </div>
              <p className="text-neutral-200 text-sm mt-2">{r.description}</p>
              <p className="text-neutral-400 text-xs mt-2">→ {r.recommendation}</p>
              <p className="text-neutral-500 text-xs mt-1">
                Est. {money(r.estimated_cost_range[0])}–{money(r.estimated_cost_range[1])}
              </p>
            </div>
          ))}
        </Section>

        {/* Measurements vs ADA */}
        <Section title="Measurements vs. ADA Targets">
          <div className="rounded-xl border border-neutral-800 divide-y divide-neutral-800 overflow-hidden">
            {assessment.measurements.map((m, i) => {
              const t = ADA_TARGETS[m.feature];
              const ok = t ? t.ok(m.estimated_value_inches) : true;
              return (
                <div key={i} className="flex items-center justify-between px-4 py-3 bg-neutral-900/40">
                  <div>
                    <p className="text-sm font-medium">{t?.label || m.feature}</p>
                    <p className="text-xs text-neutral-500">Target {t?.target} · {m.confidence_interval} confidence</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.estimated_value_inches}"
                    </p>
                    <p className={`text-xs ${ok ? 'text-emerald-500' : 'text-red-500'}`}>{ok ? 'Meets' : 'Below'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Materials */}
        <Section title={`Materials Checklist (${report.materialCount})`}>
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            {boq.map((b, i) => (
              <div key={i} className="flex justify-between px-4 py-2.5 text-sm bg-neutral-900/40 border-b border-neutral-800 last:border-0">
                <span className="text-neutral-200">{b.qty}× {b.name}</span>
                <span className="text-neutral-400">{money(b.price * b.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2.5 text-sm font-semibold bg-neutral-900">
              <span>Materials total</span>
              <span>{money(materialsTotal)}</span>
            </div>
          </div>
        </Section>

        {/* Marketplace */}
        <Section title="Contractor Marketplace">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Qualified Lead</p>
                <p className="text-xs text-neutral-500">
                  {report.isHighValueLead ? '★ High-value' : 'Standard'} · {money(lead.price)}
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${leadStatus === 'SOLD' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'}`}>
                {leadStatus}
              </span>
            </div>
            {leadStatus !== 'SOLD' ? (
              <button
                onClick={purchaseLead}
                disabled={busy === 'purchase'}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-semibold text-sm transition"
              >
                {busy === 'purchase' ? 'Processing…' : 'Purchase lead (as contractor)'}
              </button>
            ) : (
              <button
                onClick={recordModification}
                disabled={busy === 'modify'}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl font-semibold text-sm transition"
              >
                {busy === 'modify' ? 'Recording…' : 'Mark modification complete'}
              </button>
            )}
          </div>
        </Section>

        {/* Longitudinal health score */}
        {health && (
          <Section title="Lifetime Home Record">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <ScoreCell label="Overall" value={health.overallScore} />
                <ScoreCell label="Fall risk" value={health.fallRiskScore} />
                <ScoreCell label="Mobility" value={health.mobilityScore} />
              </div>
              {health.changeDelta != null && health.changeDelta > 0 && (
                <p className="text-emerald-400 text-center text-sm font-semibold mt-3">
                  +{health.changeDelta} points from mitigation credit
                </p>
              )}
              <button
                onClick={viewCertificate}
                disabled={busy === 'cert'}
                className="w-full mt-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded-xl text-sm font-medium transition"
              >
                {busy === 'cert' ? 'Signing…' : 'Generate signed safety certificate'}
              </button>
            </div>
          </Section>
        )}

        {cert && (
          <Section title="Signed Property Certificate (JSON-LD)">
            <pre className="rounded-xl border border-neutral-800 bg-black p-3 text-[10px] text-emerald-300 overflow-x-auto">
{JSON.stringify(cert.certificate?.credentialSubject ?? cert, null, 2)}
            </pre>
            <p className="text-neutral-500 text-xs mt-1 break-all">Proof: {cert.proof?.jws?.slice(0, 48)}…</p>
          </Section>
        )}

        {msg && <p className="text-center text-sm text-neutral-400">{msg}</p>}

        <button onClick={onRestart} className="w-full py-3 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-900 transition">
          Start a new capture
        </button>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">{title}</h2>
    <div className="space-y-3">{children}</div>
  </section>
);

const Stat: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => {
  const color =
    accent === 'HIGH' ? 'text-red-400' : accent === 'MEDIUM' ? 'text-amber-400' : accent === 'LOW' ? 'text-emerald-400' : 'text-neutral-100';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center">
      <p className="text-[11px] text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
};

const ScoreCell: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div>
    <p className="text-2xl font-bold text-emerald-400">{value}</p>
    <p className="text-[11px] text-neutral-500 uppercase">{label}</p>
  </div>
);
