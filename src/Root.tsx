import React, { useEffect, useState } from 'react';
import { CaptureContainer } from './components/capture/CaptureContainer';
import { AssessmentReport } from './components/report/AssessmentReport';
import { ContractorMarketplace } from './components/marketplace/ContractorMarketplace';
import { EnterpriseConsole } from './components/enterprise/EnterpriseConsole';
import { DemoActors, ProcessResult } from './types/report.types';

type Persona = 'homeowner' | 'contractor' | 'enterprise';

export const App: React.FC = () => {
  const [actors, setActors] = useState<DemoActors | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [persona, setPersona] = useState<Persona>('homeowner');

  useEffect(() => {
    fetch('/v1/dev/demo-property')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`API ${res.status}`))))
      .then(setActors)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="font-semibold">Can’t reach the API</p>
        <p className="text-sm text-neutral-400">{error}. Is the backend running on :3010? (npm run dev)</p>
      </div>
    );
  }

  if (!actors) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center">
        <p className="animate-pulse">Loading HOMEase…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Persona switcher */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 backdrop-blur p-1 text-xs">
        {(['homeowner', 'contractor', 'enterprise'] as Persona[]).map((p) => (
          <button
            key={p}
            onClick={() => setPersona(p)}
            className={`px-4 py-1.5 rounded-full font-medium capitalize transition ${
              persona === p ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {persona === 'enterprise' ? (
        <EnterpriseConsole actors={actors} />
      ) : persona === 'contractor' ? (
        <ContractorMarketplace actors={actors} />
      ) : result ? (
        <AssessmentReport result={result} actors={actors} onRestart={() => setResult(null)} />
      ) : (
        <CaptureContainer actors={actors} onComplete={setResult} />
      )}
    </div>
  );
};
