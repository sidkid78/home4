import React, { useEffect, useRef } from 'react';
import { useMachine } from '@xstate/react';
import { captureMachine } from '../../machines/captureMachine';
import { useCamera } from '../../hooks/useCamera';
import { useSupabaseUpload } from '../../hooks/useSupabaseUpload';
import { GuidanceOverlay } from './GuidanceOverlay';
import { DemoActors, ProcessResult } from '../../types/report.types';
import { apiFetch } from '../../lib/apiFetch';

interface Props {
  actors: DemoActors;
  onComplete: (result: ProcessResult) => void;
}

export const CaptureContainer: React.FC<Props> = ({ actors, onComplete }) => {
  const [state, send] = useMachine(captureMachine);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { startCamera, stopCamera, captureFrame, error: cameraError } = useCamera(videoRef);
  const { uploadSession, isUploading, error: uploadError } = useSupabaseUpload();

  useEffect(() => {
    if (state.matches('initializing')) {
      startCamera()
        .then(() => send({ type: 'CAMERA_READY' }))
        .catch((err) => send({ type: 'CAMERA_ERROR', error: err.message }));
    }
  }, [state.value, startCamera, send]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleCapture = async () => {
    if (state.matches('guiding')) {
      send({ type: 'CAPTURE' });
      try {
        const frame = await captureFrame();
        if (frame) {
          send({ type: 'CAPTURE_SUCCESS', frame });
        }
      } catch (err: any) {
        // Fallback silently or handle
      }
    }
  };

  const runPipeline = async (frames: typeof state.context.frames) => {
    const captureId = await uploadSession(actors.propertyId, state.context.roomType, frames);
    const res = await apiFetch(`/v1/captures/${captureId}/process`, { method: 'POST' });
    if (!res.ok) throw new Error(`Processing failed: ${res.status}`);
    const result: ProcessResult = await res.json();
    onComplete(result);
  };

  const handleUpload = async () => {
    send({ type: 'UPLOAD' });
    try {
      await runPipeline(state.context.frames);
      send({ type: 'UPLOAD_SUCCESS' });
    } catch (err: any) {
      send({ type: 'UPLOAD_ERROR', error: err.message });
    }
  };

  // No camera? Still let the demo run the pipeline (mock AI needs no images).
  const handleSkipCamera = async () => {
    send({ type: 'SKIP' });
    try {
      await runPipeline([]);
      send({ type: 'UPLOAD_SUCCESS' });
    } catch (err: any) {
      send({ type: 'UPLOAD_ERROR', error: err.message });
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto h-screen bg-black overflow-hidden flex flex-col">
      {/* Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay Guidance */}
      {(state.matches('guiding') || state.matches('capturing')) && (
        <GuidanceOverlay roomType={state.context.roomType} />
      )}

      {/* Controls */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-black/50 backdrop-blur-md pb-8">
        {state.matches('idle') && (
          <button 
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold text-lg hover:bg-blue-700 transition"
            onClick={() => send({ type: 'START' })}
          >
            Start Capture
          </button>
        )}

        {(state.matches('guiding') || state.matches('capturing')) && (
          <div className="flex justify-between items-center">
            <button 
              onClick={() => send({ type: 'SET_ROOM', roomType: state.context.roomType === 'KITCHEN' ? 'BATHROOM' : 'KITCHEN' })}
              className="text-white px-4 py-2 bg-gray-800 rounded-xl"
            >
              Swap Room
            </button>
            <button 
              onClick={handleCapture}
              className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-lg active:scale-95 transition"
            />
            <button 
              onClick={() => send({ type: 'REVIEW' })}
              className="text-white px-4 py-2 bg-gray-800 rounded-xl"
              disabled={state.context.frames.length === 0}
            >
              Review ({state.context.frames.length})
            </button>
          </div>
        )}

        {state.matches('reviewing') && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto p-2">
              {state.context.frames.map(f => (
                <img key={f.id} src={f.url} className="h-24 w-16 object-cover rounded-lg shadow-sm" alt="Thumbnail" />
              ))}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => send({ type: 'RETRY' })}
                className="flex-1 py-3 bg-gray-700 text-white rounded-xl"
              >
                Capture More
              </button>
              <button 
                onClick={handleUpload}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold"
              >
                Upload
              </button>
            </div>
          </div>
        )}
        
        {state.matches('permissionDenied') && (
          <div className="space-y-3 text-center">
            <p className="text-white text-sm">
              Camera unavailable{cameraError ? ` (${cameraError})` : ''}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => send({ type: 'RETRY' })}
                className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-medium"
              >
                Retry camera
              </button>
              <button
                onClick={handleSkipCamera}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold"
              >
                Use sample capture
              </button>
            </div>
          </div>
        )}

        {state.matches('uploading') && (
          <div className="text-white text-center py-8 font-semibold animate-pulse">
            Analyzing property with AI…
          </div>
        )}

        {(uploadError || cameraError) && state.matches('reviewing') && (
          <p className="text-red-400 text-center text-sm mt-2">{uploadError || cameraError}</p>
        )}
      </div>
    </div>
  );
};
