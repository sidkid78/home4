import React, { useState } from 'react';
import { DemoActors, RegisteredPartner, FhirBundle, FhirEntry, AuditRecord } from '../../types/report.types';
import { apiFetch } from '../../lib/apiFetch';

const PARTNER_TYPES = ['HEALTHCARE', 'INSURANCE', 'GOVERNMENT'] as const;

interface Props {
  actors: DemoActors;
}

export const EnterpriseConsole: React.FC<Props> = ({ actors }) => {
  const [name, setName] = useState('General Hospital Discharge Planning');
  const [type, setType] = useState<RegisteredPartner['type']>('HEALTHCARE');
  const [partner, setPartner] = useState<RegisteredPartner | null>(null);
  const [consent, setConsent] = useState(false);
  const [bundle, setBundle] = useState<FhirBundle | null>(null);
  const [audit, setAudit] = useState<AuditRecord[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const register = async () => {
    setBusy('register');
    setError(null);
    try {
      const res = await apiFetch('/v1/enterprise/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, consentScopes: ['READ_REPORTS'] }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Registration failed');
      setPartner(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const fetchFhir = async () => {
    if (!partner) return;
    setBusy('fhir');
    setError(null);
    setBlocked(null);
    setBundle(null);
    try {
      const res = await apiFetch(`/v1/enterprise/property/${actors.propertyId}/fhir-observations`, {
        headers: { 'x-partner-id': partner.id, 'x-homeowner-consent': consent ? 'true' : 'false' },
      });
      if (res.status === 403) {
        setBlocked((await res.json()).error || 'Access denied');
        return;
      }
      if (!res.ok) throw new Error(`FHIR request failed (${res.status})`);
      setBundle(await res.json());
      // Refresh the audit trail (the read we just made is now logged).
      const auditRes = await apiFetch(`/v1/enterprise/property/${actors.propertyId}/audit`);
      if (auditRes.ok) setAudit(await auditRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 overflow-y-auto">
      <div className="max-w-md mx-auto px-5 py-8 space-y-6 pb-16">
        <header className="space-y-1">
          <p className="text-blue-400 text-sm font-semibold tracking-wide uppercase">Enterprise</p>
          <h1 className="text-2xl font-bold">Healthcare Data Exchange</h1>
          <p className="text-neutral-400 text-sm">HL7 FHIR handoff for discharge planning — consent-gated and audited.</p>
        </header>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {/* Step 1: partner registration */}
        <Section step="1" title="Register partner">
          {!partner ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Partner name"
                className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                {PARTNER_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      type === t ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={register}
                disabled={busy === 'register' || !name.trim()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold text-sm transition"
              >
                {busy === 'register' ? 'Registering…' : 'Register & issue API key'}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-medium text-sm">{partner.name}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{partner.type}</span>
              </div>
              <p className="text-xs text-neutral-400">Scopes: {partner.consentScopes.join(', ')}</p>
              <div className="rounded-lg bg-black p-2">
                <p className="text-[10px] text-neutral-500 uppercase mb-1">API key (shown once)</p>
                <code className="text-[11px] text-emerald-300 break-all">{partner.apiKey}</code>
              </div>
            </div>
          )}
        </Section>

        {/* Step 2: consent + fetch */}
        {partner && (
          <Section step="2" title="Homeowner consent">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
              <button
                onClick={() => setConsent((c) => !c)}
                className="w-full flex items-center justify-between"
              >
                <span className="text-sm">Consent to share record</span>
                <span className={`relative w-11 h-6 rounded-full transition ${consent ? 'bg-emerald-600' : 'bg-neutral-700'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${consent ? 'translate-x-5' : ''}`} />
                </span>
              </button>
              <button
                onClick={fetchFhir}
                disabled={busy === 'fhir'}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold text-sm transition"
              >
                {busy === 'fhir' ? 'Requesting…' : 'Request FHIR record'}
              </button>
              {blocked && (
                <p className="text-amber-400 text-xs text-center border border-amber-500/30 rounded-lg p-2">
                  🔒 403 — {blocked}
                </p>
              )}
            </div>
          </Section>
        )}

        {/* Step 3: FHIR bundle */}
        {bundle && (
          <Section step="3" title={`FHIR Bundle · ${bundle.total} resources`}>
            {bundle.total === 0 ? (
              <p className="text-neutral-500 text-sm">No mapped resources — run a capture as the homeowner first.</p>
            ) : (
              <div className="space-y-3">
                {bundle.entry.map((e, i) => (
                  <FhirCard key={i} entry={e} />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Step 4: audit trail */}
        {audit && audit.length > 0 && (
          <Section step="4" title="Access audit trail">
            <div className="rounded-xl border border-neutral-800 overflow-hidden">
              {audit.map((a) => (
                <div key={a.id} className="flex justify-between items-center px-4 py-2.5 text-xs bg-neutral-900/40 border-b border-neutral-800 last:border-0">
                  <span className="font-mono text-neutral-300">{a.actionType}</span>
                  <span className="text-neutral-500">{new Date(a.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

const FhirCard: React.FC<{ entry: FhirEntry }> = ({ entry }) => {
  const r = entry.resource;
  const coding = (r.code?.coding || r.type?.coding || [])[0];
  const badge =
    r.resourceType === 'Observation'
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : r.resourceType === 'Condition'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30';
  const codeSystem = coding?.system?.includes('loinc')
    ? 'LOINC'
    : coding?.system?.includes('icd-10')
    ? 'ICD-10'
    : 'CODE';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex justify-between items-start gap-2">
        <span className="text-sm font-semibold">{r.resourceType}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge}`}>
          {codeSystem} {coding?.code}
        </span>
      </div>
      <p className="text-neutral-300 text-sm mt-1.5">{coding?.display}</p>
      {r.valueQuantity && (
        <p className="text-2xl font-bold text-blue-400 mt-1">
          {r.valueQuantity.value}
          <span className="text-sm text-neutral-500 ml-1">{r.valueQuantity.unit}</span>
        </p>
      )}
    </div>
  );
};

const Section: React.FC<{ step: string; title: string; children: React.ReactNode }> = ({ step, title, children }) => (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 text-xs flex items-center justify-center">{step}</span>
      {title}
    </h2>
    {children}
  </section>
);
