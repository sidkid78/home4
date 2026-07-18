import { Type, Static } from '@sinclair/typebox';

export const CaptureCreateSchema = Type.Object({
  propertyId: Type.String(),
  roomType: Type.String(),
  mediaUrls: Type.Array(Type.String({ format: 'uri' })),
});

export type CaptureCreate = Static<typeof CaptureCreateSchema>;