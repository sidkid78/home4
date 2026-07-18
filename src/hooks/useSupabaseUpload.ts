import { useState } from 'react';
import { ImageFrame } from '../types/capture.types';

export const useSupabaseUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * "Uploads" the captured frames (mock storage) and registers the capture with
   * the Fastify orchestrator. Returns the created capture id.
   */
  const uploadSession = async (
    propertyId: string,
    roomType: string,
    frames: ImageFrame[]
  ): Promise<string> => {
    setIsUploading(true);
    setError(null);
    try {
      // Simulate Supabase storage put.
      await new Promise((resolve) => setTimeout(resolve, 800));
      const fileUrls = frames.map((f) => `mock://storage/captures/${f.id}.jpg`);

      const response = await fetch('/v1/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, roomType, mediaUrls: fileUrls }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setIsUploading(false);
      return data.id as string;
    } catch (err: any) {
      setError(err.message);
      setIsUploading(false);
      throw err;
    }
  };

  return { uploadSession, isUploading, error };
};
