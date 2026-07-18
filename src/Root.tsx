import React, { useEffect, useState } from 'react';
import { CaptureContainer } from './components/capture/CaptureContainer';
import { AssessmentReport } from './components/report/AssessmentReport';
import { ContractorMarketplace } from './components/marketplace/ContractorMarketplace';
import { EnterpriseConsole } from './components/enterprise/EnterpriseConsole';
import { AuthScreen } from './components/auth/AuthScreen';
import { useAuth } from './hooks/useAuth';
import { apiFetch } from './lib/apiFetch';
import { DemoActors, ProcessResult } from './types/report.types';

type Persona = 'homeowner' | 'contractor' | 'enterprise';

export const App: React.FC = () => {
  const { session, loading, signOut } = useAuth();
  const [actors, setActors] = useState<DemoActors | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [persona, setPersona] = useState<Persona>('homeowner');

  // Load the authenticated user's context once signed in.
  useEffect(() => {
    if (!session) {
      setActors(null);
      return;
    }
    apiFetch('/v1/me/context')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`API ${res.status}`))))
      .then(setActors)
      .catch((err) => setError(err.message));
  }, [session]);

  // Switching persona also sets the user's backend role, so authz is real.
  const switchPersona = async (p: Persona) => {
    setPersona(p);
    setResult(null);
    if (p === 'homeowner' || p === 'contractor') {
      await apiFetch('/v1/me/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: p }),
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center">
        <p className="animate-pulse">Loading HOMEase…</p>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="font-semibold">Can’t reach the API</p>
        <p className="text-sm text-neutral-400">{error}</p>
        <button onClick={signOut} className="mt-2 text-sm text-blue-400 hover:underline">Sign out</button>
      </div>
    );
  }

  if (!actors) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center">
        <p className="animate-pulse">Loading your account…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Persona switcher + sign out */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
        <div className="flex gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 backdrop-blur p-1 text-xs">
          {(['homeowner', 'contractor', 'enterprise'] as Persona[]).map((p) => (
            <button
              key={p}
              onClick={() => switchPersona(p)}
              className={`px-4 py-1.5 rounded-full font-medium capitalize transition ${
                persona === p ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={signOut}
          className="rounded-full border border-neutral-700 bg-neutral-900/80 backdrop-blur px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
          title="Sign out"
        >
          ⏻
        </button>
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
