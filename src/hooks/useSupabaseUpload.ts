import { useState } from 'react';
import { ImageFrame } from '../types/capture.types';

// Convert a Blob to base64 (no data: prefix) for JSON transport to the backend.
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const useSupabaseUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sends captured frames to the backend, which uploads them to Supabase
   * Storage (service_role, bypasses RLS) and returns public URLs. Then
   * registers the capture. Falls back to mock URLs when there are no frames.
   */
  const uploadSession = async (
    propertyId: string,
    roomType: string,
    frames: ImageFrame[]
  ): Promise<string> => {
    setIsUploading(true);
    setError(null);
    try {
      let mediaUrls: string[];

      if (frames.length > 0) {
        const images = await Promise.all(
          frames.map(async (f) => ({ id: f.id, dataBase64: await blobToBase64(f.blob) }))
        );
        const upRes = await fetch('/v1/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, roomType, images }),
        });
        if (!upRes.ok) throw new Error((await upRes.json()).error || 'Upload failed');
        mediaUrls = (await upRes.json()).urls;
      } else {
        mediaUrls = [`mock://storage/captures/${propertyId}.jpg`];
      }

      const response = await fetch('/v1/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, roomType, mediaUrls }),
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
