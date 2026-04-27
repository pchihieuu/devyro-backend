import { z } from "zod";
import { CallStatus, CallType } from "../entities/Videocall.entity";

// POST /api/calls — Khởi tạo cuộc gọi
export const initiateCallSchema = z.object({
  body: z.object({
    participantIds: z
      .array(z.string().uuid("participantId must be a valid UUID"))
      .min(1, "Must invite at least 1 person")
      .max(49, "Maximum 49 people in a call"),
    type: z.nativeEnum(CallType).optional().default(CallType.VIDEO),
  }),
});

// POST /api/calls/:callId/accept
export const acceptCallSchema = z.object({
  params: z.object({
    callId: z.string().uuid("callId must be a valid UUID"),
  }),
});

export const inviteToCallSchema = z.object({
  params: z.object({ callId: z.string().uuid() }),
  body: z.object({
    userIds: z.array(z.string().uuid()).min(1).max(3),
  }),
});

// POST /api/calls/:callId/decline
export const declineCallSchema = z.object({
  params: z.object({
    callId: z.string().uuid("callId must be a valid UUID"),
  }),
});

// POST /api/calls/:callId/leave
export const leaveCallSchema = z.object({
  params: z.object({
    callId: z.string().uuid("callId must be a valid UUID"),
  }),
});

// POST /api/calls/:callId/end
export const endCallSchema = z.object({
  params: z.object({
    callId: z.string().uuid("callId must be a valid UUID"),
  }),
});

// POST /api/calls/:callId/cancel
export const cancelCallSchema = z.object({
  params: z.object({
    callId: z.string().uuid("callId must be a valid UUID"),
  }),
});

// GET /api/calls/history
export const getCallHistorySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .default("1")
      .transform(Number)
      .pipe(z.number().min(1)),
    limit: z
      .string()
      .optional()
      .default("20")
      .transform(Number)
      .pipe(z.number().min(1).max(100)),
    type: z.nativeEnum(CallType).optional(),
    status: z.nativeEnum(CallStatus).optional(),
  }),
});

// GET /api/calls/:callId
export const getCallDetailSchema = z.object({
  params: z.object({
    callId: z.string().uuid("callId must be a valid UUID"),
  }),
});
