export type RoomType = 'KITCHEN' | 'BATHROOM' | 'STAIRS' | 'ENTRYWAY' | 'LIVING_ROOM';

export type CaptureState = 
  | 'idle' 
  | 'initializing' 
  | 'permissionDenied' 
  | 'guiding' 
  | 'capturing' 
  | 'reviewing' 
  | 'uploading' 
  | 'completed';

export interface ImageFrame {
  id: string;
  blob: Blob;
  url: string;
  timestamp: number;
}

export interface CaptureSession {
  id: string;
  roomType: RoomType;
  frames: ImageFrame[];
}
