import React, { useEffect, useState } from 'react';
import { DemoActors, LeadTeaser, UnlockedReport, Measurement } from '../../types/report.types';
import { apiFetch } from '../../lib/apiFetch';

const SEVERITY_STYLES: Record<string, string> = {
  HIGH: 'bg-red-500/15 border-red-500/40 text-red-300',
  MEDIUM: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  LOW: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
};
const PRIORITY_TEXT: Record<string, string> = {
  HIGH: 'text-red-400',
  MEDIUM: 'text-amber-400',
  LOW: 'text-emerald-400',
};
const ADA_TARGETS: Record<Measurement['feature'], { label: string; ok: (v: number) => boolean; target: string }> = {
  doorway_width: { label: 'Doorway width', target: '≥ 32"', ok: (v) => v >= 32 },
  counter_height: { label: 'Counter height', target: '≤ 34"', ok: (v) => v <= 34 },
  toilet_height: { label: 'Toilet height', target: '17–19"', ok: (v) => v >= 17 && v <= 19 },
  grab_bar_height: { label: 'Grab bar height', target: '33–36"', ok: (v) => v >= 33 && v <= 36 },
};
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

// No Content-Type: these requests send no body, so declaring application/json
// would make Fastify try to parse an empty body and 400.
const contractorHeaders = (id: string) => ({
  'x-user-id': id,
  'x-user-role': 'contractor',
});

interface Props {
  actors: DemoActors;
}

export const ContractorMarketplace: React.FC<Props> = ({ actors }) => {
  const [leads, setLeads] = useState<LeadTeaser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onboardUrl, setOnboardUrl] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedReport | null>(null);

  const loadLeads = () => {
    apiFetch('/v1/leads')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`))))
      .then(setLeads)
      .catch((e) => setError(e.message));
  };

  useEffect(loadLeads, []);

  const onboard = async () => {
    setBusy('onboard');
    setError(null);
    try {
      const res = await apiFetch('/v1/contractors/onboard', {
        method: 'POST',
        headers: contractorHeaders(actors.contractorId),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Onboarding failed');
      setOnboardUrl((await res.json()).url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const purchase = async (lead: LeadTeaser) => {
    setBusy(lead.id);
    setError(null);
    try {
      // Settle the purchase (dev endpoint mirrors the Stripe checkout+webhook
      // settlement atomically; works whether or not live Stripe keys are set).
      const buyRes = await apiFetch('/v1/dev/purchase-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, contractorId: actors.contractorId }),
      });
      if (!buyRes.ok) throw new Error((await buyRes.json()).error || 'Purchase failed');

      // Fetch the now-unlocked report through the RLS-style paywall.
      const reportRes = await apiFetch(`/v1/reports/${lead.reportId}`, {
        headers: contractorHeaders(actors.contractorId),
      });
      if (!reportRes.ok) throw new Error(`Report still locked (${reportRes.status})`);
      setUnlocked(await reportRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (unlocked) {
    return <UnlockedReportView report={unlocked} onBack={() => { setUnlocked(null); loadLeads(); }} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-y-auto">
      <div className="max-w-md mx-auto px-5 py-8 space-y-6 pb-16">
        <header className="space-y-1">
          <p className="text-blue-400 text-sm font-semibold tracking-wide uppercase">Contractor</p>
          <h1 className="text-2xl font-bold">Lead Marketplace</h1>
          <p className="text-neutral-400 text-sm">Qualified project intelligence. Full report unlocks after purchase.</p>
        </header>

        {/* Onboarding */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Stripe Connect</p>
            <p className="text-xs text-neutral-500">Onboard to receive payouts</p>
          </div>
          {onboardUrl ? (
            <a href={onboardUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline">Open onboarding ↗</a>
          ) : (
            <button onClick={onboard} disabled={busy === 'onboard'} className="text-sm px-3 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded-lg font-medium">
              {busy === 'onboard' ? '…' : 'Onboard'}
            </button>
          )}
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {/* Leads */}
        {leads === null ? (
          <p className="text-neutral-500 animate-pulse text-center py-8">Loading leads…</p>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <p>No available leads.</p>
            <p className="text-xs mt-1">Run a capture as a homeowner to generate one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{lead.roomType.replace('_', ' ')}</span>
                      {lead.isHighValueLead && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">★ HIGH VALUE</span>}
                    </div>
                    <p className={`text-xs font-semibold ${PRIORITY_TEXT[lead.priority]}`}>{lead.priority} priority</p>
                  </div>
                  <span className="text-lg font-bold">{money(lead.price)}</span>
                </div>
                <div className="flex gap-4 text-xs text-neutral-400">
                  <span>{lead.riskCount} risks</span>
                  <span>{lead.materialCount} materials</span>
                  <span className="text-emerald-400">{Math.round(lead.roiValue)}% ROI</span>
                  <span>~{money(lead.estimatedValue)} job</span>
                </div>
                <button
                  onClick={() => purchase(lead)}
                  disabled={busy === lead.id}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold text-sm transition"
                >
                  {busy === lead.id ? 'Processing payment…' : `Buy lead — ${money(lead.price)}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const UnlockedReportView: React.FC<{ report: UnlockedReport; onBack: () => void }> = ({ report, onBack }) => {
  const a = report.assessment;
  const materialsTotal = report.boq.reduce((s, b) => s + b.price * b.qty, 0);
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-y-auto">
      <div className="max-w-md mx-auto px-5 py-8 space-y-6 pb-16">
        <header className="space-y-1">
          <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wide">✓ Purchased · Unlocked</p>
          <h1 className="text-2xl font-bold">{(report.roomType || 'Project').replace('_', ' ')} Report</h1>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center">
            <p className="text-[11px] text-neutral-500 uppercase">Priority</p>
            <p className={`text-lg font-bold mt-1 ${PRIORITY_TEXT[report.priority]}`}>{report.priority}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center">
            <p className="text-[11px] text-neutral-500 uppercase">Job value</p>
            <p className="text-lg font-bold mt-1">{money(report.estimatedValue)}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-center">
            <p className="text-[11px] text-neutral-500 uppercase">ROI</p>
            <p className="text-lg font-bold mt-1 text-emerald-400">{Math.round(report.roiValue)}%</p>
          </div>
        </div>

        {a && (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Risks ({a.risks.length})</h2>
              {a.risks.map((r) => (
                <div key={r.id} className={`rounded-xl border p-4 ${SEVERITY_STYLES[r.severity]}`}>
                  <div className="flex justify-between"><span className="font-semibold text-sm">{r.category.replace('_', ' ')}</span><span className="text-xs font-bold">{r.severity}</span></div>
                  <p className="text-neutral-200 text-sm mt-2">{r.description}</p>
                  <p className="text-neutral-400 text-xs mt-2">→ {r.recommendation}</p>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Measurements vs. ADA</h2>
              <div className="rounded-xl border border-neutral-800 [&>*+*]:border-t [&>*+*]:border-neutral-800 overflow-hidden">
                {a.measurements.map((m, i) => {
                  const t = ADA_TARGETS[m.feature];
                  const ok = t ? t.ok(m.estimated_value_inches) : true;
                  return (
                    <div key={i} className="flex justify-between px-4 py-3 bg-neutral-900/40">
                      <div><p className="text-sm font-medium">{t?.label || m.feature}</p><p className="text-xs text-neutral-500">Target {t?.target}</p></div>
                      <p className={`text-sm font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{m.estimated_value_inches}"</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">Materials ({report.materialCount})</h2>
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            {report.boq.map((b, i) => (
              <div key={i} className="flex justify-between px-4 py-2.5 text-sm bg-neutral-900/40 border-b border-neutral-800 last:border-0">
                <span>{b.qty}× {b.name}</span><span className="text-neutral-400">{money(b.price * b.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2.5 text-sm font-semibold bg-neutral-900"><span>Total</span><span>{money(materialsTotal)}</span></div>
          </div>
        </section>

        <button onClick={onBack} className="w-full py-3 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-900 transition">
          ← Back to marketplace
        </button>
      </div>
    </div>
  );
};
