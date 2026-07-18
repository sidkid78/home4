import React, { useEffect, useState } from 'react';
import { CaptureContainer } from './components/capture/CaptureContainer';
import { AssessmentReport } from './components/report/AssessmentReport';
import { DemoActors, ProcessResult } from './types/report.types';

export const App: React.FC = () => {
  const [actors, setActors] = useState<DemoActors | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

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

  if (result) {
    return <AssessmentReport result={result} actors={actors} onRestart={() => setResult(null)} />;
  }

  return <CaptureContainer actors={actors} onComplete={setResult} />;
};
