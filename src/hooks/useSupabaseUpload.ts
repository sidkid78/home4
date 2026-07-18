import { useState } from 'react';
import { ImageFrame } from '../types/capture.types';

export const useSupabaseUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadSession = async (propertyId: string, roomType: string, frames: ImageFrame[]) => {
    setIsUploading(true);
    setError(null);
    try {
      // Mock upload delay to simulate Supabase storage put
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const fileUrls = frames.map(f => `mock://storage/captures/${f.id}.jpg`);

      // POST to Fastify Orchestrator
      const response = await fetch('/v1/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomType,
          mediaUrls: fileUrls
        })
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Server returned error: ${response.statusText}`);
      }

      if (response.status === 404) {
        // Fallback for mocked local testing without a real backend
        console.warn('Backend not found, treating upload as local success.');
      }
      
      setIsUploading(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      setIsUploading(false);
      throw err;
    }
  };

  return { uploadSession, isUploading, error };
};
