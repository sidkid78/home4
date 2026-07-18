import { setup, assign } from 'xstate';
import { RoomType, ImageFrame } from '../types/capture.types';

type CaptureContext = {
  roomType: RoomType;
  frames: ImageFrame[];
  error?: string;
};

type CaptureEvents =
  | { type: 'START' }
  | { type: 'CAMERA_READY' }
  | { type: 'CAMERA_ERROR'; error: string }
  | { type: 'SET_ROOM'; roomType: RoomType }
  | { type: 'CAPTURE' }
  | { type: 'CAPTURE_SUCCESS'; frame: ImageFrame }
  | { type: 'REVIEW' }
  | { type: 'RETRY' }
  | { type: 'SKIP' }
  | { type: 'UPLOAD' }
  | { type: 'UPLOAD_SUCCESS' }
  | { type: 'UPLOAD_ERROR'; error: string };

export const captureMachine = setup({
  types: {
    context: {} as CaptureContext,
    events: {} as CaptureEvents
  },
  actions: {
    setRoom: assign({
      roomType: ({ event }) => (event.type === 'SET_ROOM' ? event.roomType : 'KITCHEN')
    }),
    addFrame: assign({
      frames: ({ context, event }) => {
        if (event.type === 'CAPTURE_SUCCESS') {
          return [...context.frames, event.frame];
        }
        return context.frames;
      }
    }),
    setError: assign({
      error: ({ event }) => ('error' in event ? event.error : undefined)
    })
  }
}).createMachine({
  id: 'captureSession',
  initial: 'idle',
  context: {
    roomType: 'KITCHEN',
    frames: []
  },
  states: {
    idle: {
      on: { START: 'initializing' }
    },
    initializing: {
      on: {
        CAMERA_READY: 'guiding',
        CAMERA_ERROR: { target: 'permissionDenied', actions: 'setError' }
      }
    },
    permissionDenied: {
      on: { RETRY: 'initializing', SKIP: 'uploading' }
    },
    guiding: {
      on: {
        SET_ROOM: { actions: 'setRoom' },
        CAPTURE: 'capturing',
        REVIEW: 'reviewing'
      }
    },
    capturing: {
      on: {
        CAPTURE_SUCCESS: { target: 'guiding', actions: 'addFrame' },
        CAMERA_ERROR: { target: 'guiding', actions: 'setError' }
      }
    },
    reviewing: {
      on: {
        RETRY: 'guiding',
        UPLOAD: 'uploading'
      }
    },
    uploading: {
      on: {
        UPLOAD_SUCCESS: 'completed',
        UPLOAD_ERROR: { target: 'reviewing', actions: 'setError' }
      }
    },
    completed: {
      type: 'final'
    }
  }
});
