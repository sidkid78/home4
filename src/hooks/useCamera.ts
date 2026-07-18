import React, { useState, useCallback } from 'react';
import { ImageFrame } from '../types/capture.types';

export const useCamera = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (stream) return;
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [stream, videoRef]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const captureFrame = useCallback(async (): Promise<ImageFrame | null> => {
    if (!videoRef.current) return null;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        const url = URL.createObjectURL(blob);
        resolve({
          id: crypto.randomUUID(),
          blob,
          url,
          timestamp: Date.now()
        });
      }, 'image/jpeg', 0.9);
    });
  }, [videoRef]);

  return { startCamera, stopCamera, captureFrame, error };
};
