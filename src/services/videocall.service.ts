// import { AppDataSource } from "../config/database.config";
// import { In, LessThan } from "typeorm";
// import { User } from "../entities/User.entity";
// import { CallStatus, CallType, VideoCall } from "../entities/Videocall.entity";
// import { getWebSocketService } from "../services/websocket.service";
// import {
//   NotFoundError,
//   ForbiddenError,
//   BadRequestError,
// } from "../utils/errors";
// import { v4 as uuidv4 } from "uuid";
// import {
//   CallParticipant,
//   ParticipantStatus,
// } from "../entities/Callparticipant.entity";
// import { MAX_MESH_PARTICIPANTS, PENDING_CALL_TIMEOUT_MS } from "../constants/common";

// interface InitiateCallData {
//   initiatorId: string;
//   participantIds: string[];
//   type: CallType;
// }

// interface CallHistoryQuery {
//   userId: string;
//   page?: number;
//   limit?: number;
//   type?: CallType;
//   status?: CallStatus;
// }

// export class VideoCallService {
//   private callRepo = AppDataSource.getRepository(VideoCall);
//   // private participantRepo = AppDataSource.getRepository(CallParticipant);
//   private userRepo = AppDataSource.getRepository(User);

//   // Create new call
//   async initiateCall(data: InitiateCallData): Promise<VideoCall> {
//     const { initiatorId, participantIds, type } = data;

//     if (!participantIds || participantIds.length === 0) {
//       throw new BadRequestError("Must invite at least 1 participant");
//     }
//     if (participantIds.includes(initiatorId)) {
//       throw new BadRequestError("Cannot call yourself");
//     }

//     // Mesh limits — avoid browser overload/upload
//     const totalParticipants = participantIds.length + 1;
//     if (totalParticipants > MAX_MESH_PARTICIPANTS) {
//       throw new BadRequestError(
//         `Group call maximum ${MAX_MESH_PARTICIPANTS} people. Please upgrade to use SFU.`
//       );
//     }

//     const allUserIds = [...new Set([initiatorId, ...participantIds])];
//     const users = await this.userRepo.findBy({ id: In(allUserIds) });
//     if (users.length !== allUserIds.length) {
//       throw new NotFoundError("One or more users do not exist");
//     }

//     const activeCall = await this.findActiveCallOfUser(initiatorId);
//     if (activeCall) {
//       throw new BadRequestError("You are already in another call");
//     }

//     // Create VideoCall + CallParticipants in a transaction
//     const savedCall = await AppDataSource.transaction(async (manager) => {
//       const call = manager.create(VideoCall, {
//         roomId: uuidv4(),
//         initiatorId,
//         type,
//         status: CallStatus.PENDING,
//       });
//       const newCall = await manager.save(call);

//       const initiatorParticipant = manager.create(CallParticipant, {
//         callId: newCall.id,
//         userId: initiatorId,
//         status: ParticipantStatus.JOINED,
//         joinedAt: new Date(),
//       });
//       const invitedParticipants = participantIds.map((userId) =>
//         manager.create(CallParticipant, {
//           callId: newCall.id,
//           userId,
//           status: ParticipantStatus.INVITED,
//         })
//       );
//       await manager.save([initiatorParticipant, ...invitedParticipants]);

//       return newCall;
//     });

//     const fullCall = await this.getCallById(savedCall.id);
//     const initiatorUser = users.find((u) => u.id === initiatorId)!;
//     const ws = getWebSocketService();

//     for (const userId of participantIds) {
//       ws.sendToUser(userId, "call:incoming", {
//         callId: fullCall.id,
//         roomId: fullCall.roomId,
//         type: fullCall.type,
//         initiator: {
//           id: initiatorUser.id,
//           name: initiatorUser.name,
//           avatar: initiatorUser.avatar,
//         },
//         participantCount: totalParticipants,
//       });
//     }

//     return fullCall;
//   }

//   // Accept call
//   async acceptCall(callId: string, userId: string): Promise<VideoCall> {
//     const updatedCall = await AppDataSource.transaction(async (manager) => {
//       // Step 1: Lock only the video_calls table (do not join) → avoid PostgreSQL errors
//       const call = await manager
//         .createQueryBuilder(VideoCall, "call")
//         .where("call.id = :callId", { callId })
//         .setLock("pessimistic_write")
//         .getOne();

//       if (!call) throw new NotFoundError("Call does not exist");

//       if (
//         call.status === CallStatus.ENDED ||
//         call.status === CallStatus.CANCELLED
//       ) {
//         throw new BadRequestError("Call has ended");
//       }
//       if (call.status === CallStatus.DECLINED) {
//         throw new BadRequestError("Call has been declined");
//       }

//       // Step 2: Load individual participants (no need to lock them)
//       const participants = await manager.find(CallParticipant, {
//         where: { callId },
//         relations: ["user"],
//       });

//       const participant = participants.find((p) => p.userId === userId);
//       if (!participant) {
//         throw new ForbiddenError("You are not invited to this call");
//       }
//       if (participant.status === ParticipantStatus.JOINED) {
//         throw new BadRequestError("You have already joined this call");
//       }

//       participant.status = ParticipantStatus.JOINED;
//       participant.joinedAt = new Date();
//       await manager.save(participant);

//       if (call.status === CallStatus.PENDING) {
//         call.status = CallStatus.ACTIVE;
//         call.startedAt = new Date();
//         await manager.save(call);
//       }

//       return call;
//     });

//     // Reload full data after transaction
//     const freshCall = await this.getCallById(callId);
//     const user = await this.userRepo.findOne({ where: { id: userId } });
//     const ws = getWebSocketService();

//     for (const p of freshCall.participants) {
//       if (p.userId !== userId && p.status === ParticipantStatus.JOINED) {
//         ws.sendToUser(p.userId, "call:participant_joined", {
//           callId,
//           roomId: freshCall.roomId,
//           user: { id: user!.id, name: user!.name, avatar: user!.avatar },
//         });
//       }
//     }

//     return freshCall;
//   }
//   // Decline call
//   async declineCall(callId: string, userId: string): Promise<void> {
//     await AppDataSource.transaction(async (manager) => {
//       // Lock only video_calls table (do not join with participants) → avoid PostgreSQL deadlock errors
//       const call = await manager
//         .createQueryBuilder(VideoCall, "call")
//         .where("call.id = :callId", { callId })
//         .setLock("pessimistic_write")
//         .getOne();

//       if (!call) throw new NotFoundError("Call does not exist");
//       if (
//         call.status === CallStatus.ENDED ||
//         call.status === CallStatus.CANCELLED
//       ) {
//         throw new BadRequestError("Call has ended");
//       }

//       // Load participants separately (no need to lock them) → avoid PostgreSQL deadlock errors
//       const participants = await manager.find(CallParticipant, {
//         where: { callId },
//       });

//       const participant = participants.find((p) => p.userId === userId);
//       if (!participant) {
//         throw new ForbiddenError("You are not invited to this call");
//       }

//       participant.status = ParticipantStatus.DECLINED;
//       participant.leftAt = new Date();
//       await manager.save(participant);

//       const ws = getWebSocketService();

//       const nonInitiatorParticipants = participants.filter(
//         (p) => p.userId !== call.initiatorId
//       );
//       const canStillJoin = nonInitiatorParticipants.some(
//         (p) =>
//           p.userId !== userId &&
//           (p.status === ParticipantStatus.INVITED ||
//             p.status === ParticipantStatus.JOINED)
//       );

//       if (!canStillJoin) {
//         call.status = CallStatus.DECLINED;
//         call.endedAt = new Date();
//         await manager.save(call);

//         ws.sendToUser(call.initiatorId, "call:declined", {
//           callId,
//           declinedBy: { userId },
//         });
//       } else {
//         for (const p of participants) {
//           if (p.status === ParticipantStatus.JOINED) {
//             ws.sendToUser(p.userId, "call:participant_declined", {
//               callId,
//               userId,
//             });
//           }
//         }
//       }
//     });
//   }

//   // Leave call
//   async leaveCall(callId: string, userId: string): Promise<void> {
//     await AppDataSource.transaction(async (manager) => {
//       // Lock only video_calls table (do not join with participants) → avoid PostgreSQL deadlock errors
//       const call = await manager
//         .createQueryBuilder(VideoCall, "call")
//         .where("call.id = :callId", { callId })
//         .setLock("pessimistic_write")
//         .getOne();

//       if (!call) throw new NotFoundError("Call does not exist");
//       if (call.status === CallStatus.ENDED) {
//         throw new BadRequestError("Call has ended");
//       }

//       // Load participants separately (no need to lock them) → avoid PostgreSQL deadlock errors
//       const participants = await manager.find(CallParticipant, {
//         where: { callId },
//       });

//       const participant = participants.find((p) => p.userId === userId);
//       if (!participant || participant.status !== ParticipantStatus.JOINED) {
//         throw new BadRequestError("You are not in this call");
//       }

//       participant.status = ParticipantStatus.LEFT;
//       participant.leftAt = new Date();
//       await manager.save(participant);

//       const remainingParticipants = participants.filter(
//         (p) => p.userId !== userId && p.status === ParticipantStatus.JOINED
//       );

//       const ws = getWebSocketService();

//       // Reassign so that endCallInternal can notify the correct participants.
//       call.participants = participants;

//       if (remainingParticipants.length === 0) {
//         await this.endCallInternal(call, manager);
//       } else {
//         for (const p of remainingParticipants) {
//           ws.sendToUser(p.userId, "call:participant_left", { callId, userId });
//         }
//       }
//     });
//   }

//   // End call (initiator only)
//   async endCall(callId: string, userId: string): Promise<void> {
//     await AppDataSource.transaction(async (manager) => {
//       // Lock only video_calls table (do not join with participants) → avoid PostgreSQL deadlock errors
//       const call = await manager
//         .createQueryBuilder(VideoCall, "call")
//         .where("call.id = :callId", { callId })
//         .setLock("pessimistic_write")
//         .getOne();

//       if (!call) throw new NotFoundError("Call does not exist");
//       if (call.status === CallStatus.ENDED) {
//         throw new BadRequestError("Call has ended");
//       }
//       if (call.initiatorId !== userId) {
//         throw new ForbiddenError("Only the call initiator can end the call");
//       }

//       // Load separate participants so that endCallInternal has enough notification data.
//       const participants = await manager.find(CallParticipant, {
//         where: { callId },
//       });
//       call.participants = participants;

//       await this.endCallInternal(call, manager);
//     });
//   }

//   // Invite more people to an active call
//   async inviteToCall(
//     callId: string,
//     inviterId: string,
//     targetUserIds: string[]
//   ): Promise<void> {
//     const call = await this.callRepo.findOne({
//       where: { id: callId },
//       relations: ["participants"],
//     });

//     if (!call) throw new NotFoundError("Call does not exist");
//     if (call.status !== CallStatus.ACTIVE) {
//       throw new BadRequestError("Only can invite when the call is active");
//     }

//     // Check if inviter is in the call
//     const inviterParticipant = call.participants.find(
//       (p) => p.userId === inviterId && p.status === ParticipantStatus.JOINED
//     );
//     if (!inviterParticipant) {
//       throw new ForbiddenError("You are not in this call");
//     }

//     // Check mesh limit
//     const currentJoined = call.participants.filter(
//       (p) => p.status === ParticipantStatus.JOINED
//     ).length;
//     const currentInvited = call.participants.filter(
//       (p) => p.status === ParticipantStatus.INVITED
//     ).length;

//     if (
//       currentJoined + currentInvited + targetUserIds.length >
//       MAX_MESH_PARTICIPANTS
//     ) {
//       throw new BadRequestError(
//         `Group call maximum ${MAX_MESH_PARTICIPANTS} people`
//       );
//     }

//     // Filter out people who aren't in the call.
//     const existingUserIds = new Set(call.participants.map((p) => p.userId));
//     const newUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));

//     if (newUserIds.length === 0) {
//       throw new BadRequestError("All invited users are already in the call");
//     }

//     // Validate users exist
//     const users = await this.userRepo.findBy({ id: In(newUserIds) });
//     if (users.length !== newUserIds.length) {
//       throw new NotFoundError("One or more users do not exist");
//     }

//     // Create new participants
//     await AppDataSource.transaction(async (manager) => {
//       const newParticipants = newUserIds.map((userId) =>
//         manager.create(CallParticipant, {
//           callId,
//           userId,
//           status: ParticipantStatus.INVITED,
//         })
//       );
//       await manager.save(newParticipants);
//     });

//     // Get inviter information for notification
//     const inviter = await this.userRepo.findOne({ where: { id: inviterId } });
//     const ws = getWebSocketService();

//     // Notify newly invited people
//     for (const userId of newUserIds) {
//       ws.sendToUser(userId, "call:incoming", {
//         callId: call.id,
//         roomId: call.roomId,
//         type: call.type,
//         initiator: {
//           id: inviter!.id,
//           name: inviter!.name,
//           avatar: inviter!.avatar,
//         },
//         participantCount: currentJoined + newUserIds.length,
//         isGroupInvite: true,
//       });
//     }

//     // Notify those who are already JOINED about the new invite
//     const joinedParticipants = call.participants.filter(
//       (p) => p.status === ParticipantStatus.JOINED
//     );
//     for (const p of joinedParticipants) {
//       ws.sendToUser(p.userId, "call:participants_invited", {
//         callId,
//         invitedUsers: users.map((u) => ({
//           id: u.id,
//           name: u.name,
//           avatar: u.avatar,
//         })),
//         invitedBy: { id: inviter!.id, name: inviter!.name },
//       });
//     }
//   }
//   async cancelCall(callId: string, userId: string): Promise<void> {
//     await AppDataSource.transaction(async (manager) => {
//       const call = await manager.findOne(VideoCall, {
//         where: { id: callId },
//         relations: ["participants"],
//         lock: { mode: "pessimistic_write" },
//       });

//       if (!call) throw new NotFoundError("Call does not exist");
//       if (call.initiatorId !== userId) {
//         throw new ForbiddenError("Only the call initiator can cancel the call");
//       }
//       if (call.status !== CallStatus.PENDING) {
//         throw new BadRequestError(
//           "Only calls in pending status can be cancelled"
//         );
//       }

//       call.status = CallStatus.CANCELLED;
//       call.endedAt = new Date();
//       await manager.save(call);

//       await manager.update(
//         CallParticipant,
//         { callId: call.id, status: ParticipantStatus.INVITED },
//         { status: ParticipantStatus.MISSED, leftAt: new Date() }
//       );

//       const ws = getWebSocketService();
//       for (const p of call.participants) {
//         if (p.userId !== userId) {
//           ws.sendToUser(p.userId, "call:cancelled", { callId });
//         }
//       }
//     });
//   }

//   // Cleanup stale PENDING calls (called from scheduled job)
//   async cleanupStalePendingCalls(): Promise<void> {
//     const cutoff = new Date(Date.now() - PENDING_CALL_TIMEOUT_MS);
//     const staleCalls = await this.callRepo.find({
//       where: { status: CallStatus.PENDING, createdAt: LessThan(cutoff) },
//       relations: ["participants"],
//     });

//     if (staleCalls.length === 0) return;

//     const ws = getWebSocketService();

//     for (const call of staleCalls) {
//       await AppDataSource.transaction(async (manager) => {
//         // Double-check the status inside the transaction.
//         const freshCall = await manager.findOne(VideoCall, {
//           where: { id: call.id },
//           lock: { mode: "pessimistic_write" },
//         });
//         if (!freshCall || freshCall.status !== CallStatus.PENDING) return;

//         freshCall.status = CallStatus.MISSED;
//         freshCall.endedAt = new Date();
//         await manager.save(freshCall);

//         await manager.update(
//           CallParticipant,
//           { callId: call.id, status: ParticipantStatus.INVITED },
//           { status: ParticipantStatus.MISSED, leftAt: new Date() }
//         );
//       });

//       // Notify outside the transaction (WS does not need rollback)
//       ws.sendToUser(call.initiatorId, "call:missed", { callId: call.id });
//       for (const p of call.participants) {
//         if (p.userId !== call.initiatorId) {
//           ws.sendToUser(p.userId, "call:missed", { callId: call.id });
//         }
//       }
//     }
//   }

//   // Auto-leave when user disconnects WebSocket 
//   async handleUserDisconnect(userId: string): Promise<void> {
//     const activeCall = await this.findActiveCallOfUser(userId);
//     if (!activeCall) return;

//     try {
//       await this.leaveCall(activeCall.id, userId);
//     } catch {
//       // User may have already left — ignore
//     }
//   }

//   // Call history
//   async getCallHistory(query: CallHistoryQuery): Promise<{
//     calls: any[];
//     total: number;
//     page: number;
//     limit: number;
//   }> {
//     const { userId, page = 1, limit = 20, type, status } = query;
//     const skip = (page - 1) * limit;

//     // Use subquery instead of double-join the same table to avoid N+1 problem in TypeORM
//     const qb = this.callRepo
//       .createQueryBuilder("call")
//       .innerJoin(
//         "call.participants",
//         "myParticipant",
//         "myParticipant.userId = :userId",
//         { userId }
//       )
//       .leftJoinAndSelect("call.participants", "allParticipants")
//       .leftJoinAndSelect("allParticipants.user", "pUser")
//       .leftJoinAndSelect("call.initiator", "initiator")
//       .orderBy("call.createdAt", "DESC")
//       .skip(skip)
//       .take(limit);

//     if (type) qb.andWhere("call.type = :type", { type });
//     if (status) qb.andWhere("call.status = :status", { status });

//     const [calls, total] = await qb.getManyAndCount();

//     const formattedCalls = calls.map((call) => ({
//       id: call.id,
//       roomId: call.roomId,
//       type: call.type,
//       status: call.status,
//       durationSeconds: call.durationSeconds,
//       startedAt: call.startedAt,
//       endedAt: call.endedAt,
//       createdAt: call.createdAt,
//       isInitiator: call.initiatorId === userId,
//       initiator: {
//         id: call.initiator.id,
//         name: call.initiator.name,
//         avatar: call.initiator.avatar,
//       },
//       participants: call.participants.map((p) => ({
//         id: p.userId,
//         name: p.user?.name,
//         avatar: p.user?.avatar,
//         status: p.status,
//         joinedAt: p.joinedAt,
//         leftAt: p.leftAt,
//       })),
//     }));

//     return { calls: formattedCalls, total, page, limit };
//   }

//   // Helpers public
//   async getActiveCall(userId: string): Promise<VideoCall | null> {
//     return this.findActiveCallOfUser(userId);
//   }

//   async getCallDetail(callId: string, userId: string): Promise<VideoCall> {
//     const call = await this.getCallById(callId);
//     const isParticipant = call.participants.some((p) => p.userId === userId);
//     if (!isParticipant) {
//       throw new ForbiddenError("You do not have permission to view this call");
//     }
//     return call;
//   }

//   // Private helpers
//   private async getCallById(callId: string): Promise<VideoCall> {
//     const call = await this.callRepo.findOne({
//       where: { id: callId },
//       relations: ["participants", "participants.user", "initiator"],
//     });
//     if (!call) throw new NotFoundError("Call does not exist");
//     return call;
//   }

//   private async findActiveCallOfUser(
//     userId: string
//   ): Promise<VideoCall | null> {
//     return this.callRepo
//       .createQueryBuilder("call")
//       .innerJoin(
//         "call.participants",
//         "participant",
//         "participant.userId = :userId AND participant.status = :pStatus",
//         { userId, pStatus: ParticipantStatus.JOINED }
//       )
//       .where("call.status IN (:...statuses)", {
//         statuses: [CallStatus.PENDING, CallStatus.ACTIVE],
//       })
//       .getOne();
//   }

//   // Allow the manager to run in the same transaction as the caller.
//   private async endCallInternal(
//     call: VideoCall,
//     manager = AppDataSource.manager
//   ): Promise<void> {
//     const now = new Date();
//     let durationSeconds: number | null = null;
//     if (call.startedAt) {
//       durationSeconds = Math.floor(
//         (now.getTime() - call.startedAt.getTime()) / 1000
//       );
//     }

//     call.status = CallStatus.ENDED;
//     call.endedAt = now;
//     call.durationSeconds = durationSeconds;
//     await manager.save(call);

//     await manager.update(
//       CallParticipant,
//       { callId: call.id, status: ParticipantStatus.JOINED },
//       { status: ParticipantStatus.LEFT, leftAt: now }
//     );

//     const ws = getWebSocketService();
//     for (const p of call.participants) {
//       ws.sendToUser(p.userId, "call:ended", {
//         callId: call.id,
//         durationSeconds,
//       });
//     }
//   }
// }

// export const videoCallService = new VideoCallService();


/**
 * videocall.service.ts  (diff-friendly — only the changed sections shown)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CHANGE SUMMARY
 * ──────────────
 * Replace every `getWebSocketService().sendToUser(...)` call for *call lifecycle*
 * events with `MQPublisher.sendCallEvent(...)`.
 *
 * WHY
 * ───
 * Call events (incoming, declined, ended, missed, participant joined/left) must
 * reach the target user regardless of which API instance holds their WebSocket
 * connection.  Publishing through the `call.events` queue with a 30 s TTL and a
 * dead-letter queue ensures:
 *   • Cross-instance delivery via per-instance fanout consumer.
 *   • Observability — undelivered events land in `call.events.dlq` for inspection.
 *   • No change to WebRTC signaling (offer/answer/ICE) — those stay as direct
 *     Socket.IO relay in websocket.signaling.ts because they are real-time and
 *     stateless.
 *
 * WHAT STAYS THE SAME
 * ────────────────────
 * • All database / transaction logic is unchanged.
 * • `getWebSocketService()` is still used in websocket.service.ts for typing
 *   indicators and online-status broadcasts (those are fire-and-forget, same
 *   instance only).
 * • `sendMessageToUser` and `sendNotificationToUser` on WebSocketService are
 *   still called from their respective services; those services should be
 *   updated similarly (see notification.service.ts note below).
 */

import { AppDataSource } from "../config/database.config";
import { In, LessThan } from "typeorm";
import { User } from "../entities/User.entity";
import { CallStatus, CallType, VideoCall } from "../entities/Videocall.entity";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../utils/errors";
import { v4 as uuidv4 } from "uuid";
import {
  CallParticipant,
  ParticipantStatus,
} from "../entities/CallParticipant.entity";
import {
  MAX_MESH_PARTICIPANTS,
  PENDING_CALL_TIMEOUT_MS,
} from "../constants/common";
import { MQPublisher } from "../messaging/publisher";
import { getWebSocketService } from "./websocket.service";

interface InitiateCallData {
  initiatorId: string;
  participantIds: string[];
  type: CallType;
}

interface CallHistoryQuery {
  userId: string;
  page?: number;
  limit?: number;
  type?: CallType;
  status?: CallStatus;
}

export class VideoCallService {
  private callRepo = AppDataSource.getRepository(VideoCall);
  private userRepo = AppDataSource.getRepository(User);

  // ── initiateCall ─────────────────────────────────────────────────────────────

  async initiateCall(data: InitiateCallData): Promise<VideoCall> {
    const { initiatorId, participantIds, type } = data;

    if (!participantIds || participantIds.length === 0)
      throw new BadRequestError("Must invite at least 1 participant");
    if (participantIds.includes(initiatorId))
      throw new BadRequestError("Cannot call yourself");

    const totalParticipants = participantIds.length + 1;
    if (totalParticipants > MAX_MESH_PARTICIPANTS)
      throw new BadRequestError(
        `Group call maximum ${MAX_MESH_PARTICIPANTS} people. Please upgrade to use SFU.`
      );

    const allUserIds = [...new Set([initiatorId, ...participantIds])];
    const users = await this.userRepo.findBy({ id: In(allUserIds) });
    if (users.length !== allUserIds.length)
      throw new NotFoundError("One or more users do not exist");

    const activeCall = await this.findActiveCallOfUser(initiatorId);
    if (activeCall) throw new BadRequestError("You are already in another call");

    const savedCall = await AppDataSource.transaction(async (manager) => {
      const call = manager.create(VideoCall, {
        roomId: uuidv4(),
        initiatorId,
        type,
        status: CallStatus.PENDING,
      });
      const newCall = await manager.save(call);

      const initiatorParticipant = manager.create(CallParticipant, {
        callId: newCall.id,
        userId: initiatorId,
        status: ParticipantStatus.JOINED,
        joinedAt: new Date(),
      });
      const invitedParticipants = participantIds.map((userId) =>
        manager.create(CallParticipant, {
          callId: newCall.id,
          userId,
          status: ParticipantStatus.INVITED,
        })
      );
      await manager.save([initiatorParticipant, ...invitedParticipants]);
      return newCall;
    });

    const fullCall = await this.getCallById(savedCall.id);
    const initiatorUser = users.find((u) => u.id === initiatorId)!;

    // ✅ Publish via MQ — ensures delivery even if recipient is on a different instance
    for (const userId of participantIds) {
      MQPublisher.sendCallEvent(userId, "call:incoming", {
        callId: fullCall.id,
        roomId: fullCall.roomId,
        type: fullCall.type,
        initiator: {
          id: initiatorUser.id,
          name: initiatorUser.name,
          avatar: initiatorUser.avatar,
        },
        participantCount: totalParticipants,
      });
    }

    return fullCall;
  }

  // ── acceptCall ────────────────────────────────────────────────────────────────

  async acceptCall(callId: string, userId: string): Promise<VideoCall> {
    const updatedCall = await AppDataSource.transaction(async (manager) => {
      const call = await manager
        .createQueryBuilder(VideoCall, "call")
        .where("call.id = :callId", { callId })
        .setLock("pessimistic_write")
        .getOne();

      if (!call) throw new NotFoundError("Call does not exist");
      if (
        call.status === CallStatus.ENDED ||
        call.status === CallStatus.CANCELLED
      )
        throw new BadRequestError("Call has ended");
      if (call.status === CallStatus.DECLINED)
        throw new BadRequestError("Call has been declined");

      const participants = await manager.find(CallParticipant, {
        where: { callId },
        relations: ["user"],
      });

      const participant = participants.find((p) => p.userId === userId);
      if (!participant) throw new ForbiddenError("You are not invited to this call");
      if (participant.status === ParticipantStatus.JOINED)
        throw new BadRequestError("You have already joined this call");

      participant.status = ParticipantStatus.JOINED;
      participant.joinedAt = new Date();
      await manager.save(participant);

      if (call.status === CallStatus.PENDING) {
        call.status = CallStatus.ACTIVE;
        call.startedAt = new Date();
        await manager.save(call);
      }

      return call;
    });

    const freshCall = await this.getCallById(callId);
    const user = await this.userRepo.findOne({ where: { id: userId } });

    for (const p of freshCall.participants) {
      if (p.userId !== userId && p.status === ParticipantStatus.JOINED) {
        // ✅ MQ publish
        MQPublisher.sendCallEvent(p.userId, "call:participant_joined", {
          callId,
          roomId: freshCall.roomId,
          user: { id: user!.id, name: user!.name, avatar: user!.avatar },
        });
      }
    }

    return freshCall;
  }

  // ── declineCall ───────────────────────────────────────────────────────────────

  async declineCall(callId: string, userId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const call = await manager
        .createQueryBuilder(VideoCall, "call")
        .where("call.id = :callId", { callId })
        .setLock("pessimistic_write")
        .getOne();

      if (!call) throw new NotFoundError("Call does not exist");
      if (
        call.status === CallStatus.ENDED ||
        call.status === CallStatus.CANCELLED
      )
        throw new BadRequestError("Call has ended");

      const participants = await manager.find(CallParticipant, {
        where: { callId },
      });

      const participant = participants.find((p) => p.userId === userId);
      if (!participant) throw new ForbiddenError("You are not invited to this call");

      participant.status = ParticipantStatus.DECLINED;
      participant.leftAt = new Date();
      await manager.save(participant);

      const nonInitiatorParticipants = participants.filter(
        (p) => p.userId !== call.initiatorId
      );
      const canStillJoin = nonInitiatorParticipants.some(
        (p) =>
          p.userId !== userId &&
          (p.status === ParticipantStatus.INVITED ||
            p.status === ParticipantStatus.JOINED)
      );

      if (!canStillJoin) {
        call.status = CallStatus.DECLINED;
        call.endedAt = new Date();
        await manager.save(call);

        // ✅ MQ publish
        MQPublisher.sendCallEvent(call.initiatorId, "call:declined", {
          callId,
          declinedBy: { userId },
        });
      } else {
        for (const p of participants) {
          if (p.status === ParticipantStatus.JOINED) {
            // ✅ MQ publish
            MQPublisher.sendCallEvent(p.userId, "call:participant_declined", {
              callId,
              userId,
            });
          }
        }
      }
    });
  }

  // ── leaveCall ─────────────────────────────────────────────────────────────────

  async leaveCall(callId: string, userId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const call = await manager
        .createQueryBuilder(VideoCall, "call")
        .where("call.id = :callId", { callId })
        .setLock("pessimistic_write")
        .getOne();

      if (!call) throw new NotFoundError("Call does not exist");
      if (call.status === CallStatus.ENDED)
        throw new BadRequestError("Call has ended");

      const participants = await manager.find(CallParticipant, {
        where: { callId },
      });

      const participant = participants.find((p) => p.userId === userId);
      if (!participant || participant.status !== ParticipantStatus.JOINED)
        throw new BadRequestError("You are not in this call");

      participant.status = ParticipantStatus.LEFT;
      participant.leftAt = new Date();
      await manager.save(participant);

      const remainingParticipants = participants.filter(
        (p) => p.userId !== userId && p.status === ParticipantStatus.JOINED
      );

      call.participants = participants;

      if (remainingParticipants.length === 0) {
        await this.endCallInternal(call, manager);
      } else {
        for (const p of remainingParticipants) {
          // ✅ MQ publish
          MQPublisher.sendCallEvent(p.userId, "call:participant_left", {
            callId,
            userId,
          });
        }
      }
    });
  }

  // ── endCall ───────────────────────────────────────────────────────────────────

  async endCall(callId: string, userId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const call = await manager
        .createQueryBuilder(VideoCall, "call")
        .where("call.id = :callId", { callId })
        .setLock("pessimistic_write")
        .getOne();

      if (!call) throw new NotFoundError("Call does not exist");
      if (call.status === CallStatus.ENDED)
        throw new BadRequestError("Call has ended");
      if (call.initiatorId !== userId)
        throw new ForbiddenError("Only the call initiator can end the call");

      const participants = await manager.find(CallParticipant, {
        where: { callId },
      });
      call.participants = participants;

      await this.endCallInternal(call, manager);
    });
  }

  // ── inviteToCall ──────────────────────────────────────────────────────────────

  async inviteToCall(
    callId: string,
    inviterId: string,
    targetUserIds: string[]
  ): Promise<void> {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ["participants"],
    });

    if (!call) throw new NotFoundError("Call does not exist");
    if (call.status !== CallStatus.ACTIVE)
      throw new BadRequestError("Only can invite when the call is active");

    const inviterParticipant = call.participants.find(
      (p) => p.userId === inviterId && p.status === ParticipantStatus.JOINED
    );
    if (!inviterParticipant) throw new ForbiddenError("You are not in this call");

    const currentJoined = call.participants.filter(
      (p) => p.status === ParticipantStatus.JOINED
    ).length;
    const currentInvited = call.participants.filter(
      (p) => p.status === ParticipantStatus.INVITED
    ).length;

    if (currentJoined + currentInvited + targetUserIds.length > MAX_MESH_PARTICIPANTS)
      throw new BadRequestError(`Group call maximum ${MAX_MESH_PARTICIPANTS} people`);

    const existingUserIds = new Set(call.participants.map((p) => p.userId));
    const newUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));

    if (newUserIds.length === 0)
      throw new BadRequestError("All invited users are already in the call");

    const users = await this.userRepo.findBy({ id: In(newUserIds) });
    if (users.length !== newUserIds.length)
      throw new NotFoundError("One or more users do not exist");

    await AppDataSource.transaction(async (manager) => {
      const newParticipants = newUserIds.map((userId) =>
        manager.create(CallParticipant, {
          callId,
          userId,
          status: ParticipantStatus.INVITED,
        })
      );
      await manager.save(newParticipants);
    });

    const inviter = await this.userRepo.findOne({ where: { id: inviterId } });

    for (const userId of newUserIds) {
      // ✅ MQ publish
      MQPublisher.sendCallEvent(userId, "call:incoming", {
        callId: call.id,
        roomId: call.roomId,
        type: call.type,
        initiator: {
          id: inviter!.id,
          name: inviter!.name,
          avatar: inviter!.avatar,
        },
        participantCount: currentJoined + newUserIds.length,
        isGroupInvite: true,
      });
    }

    const joinedParticipants = call.participants.filter(
      (p) => p.status === ParticipantStatus.JOINED
    );
    for (const p of joinedParticipants) {
      // ✅ MQ publish
      MQPublisher.sendCallEvent(p.userId, "call:participants_invited", {
        callId,
        invitedUsers: users.map((u) => ({
          id: u.id,
          name: u.name,
          avatar: u.avatar,
        })),
        invitedBy: { id: inviter!.id, name: inviter!.name },
      });
    }
  }

  // ── cancelCall ────────────────────────────────────────────────────────────────

  async cancelCall(callId: string, userId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const call = await manager.findOne(VideoCall, {
        where: { id: callId },
        relations: ["participants"],
        lock: { mode: "pessimistic_write" },
      });

      if (!call) throw new NotFoundError("Call does not exist");
      if (call.initiatorId !== userId)
        throw new ForbiddenError("Only the call initiator can cancel the call");
      if (call.status !== CallStatus.PENDING)
        throw new BadRequestError("Only calls in pending status can be cancelled");

      call.status = CallStatus.CANCELLED;
      call.endedAt = new Date();
      await manager.save(call);

      await manager.update(
        CallParticipant,
        { callId: call.id, status: ParticipantStatus.INVITED },
        { status: ParticipantStatus.MISSED, leftAt: new Date() }
      );

      for (const p of call.participants) {
        if (p.userId !== userId) {
          // ✅ MQ publish
          MQPublisher.sendCallEvent(p.userId, "call:cancelled", { callId });
        }
      }
    });
  }

  // ── cleanupStalePendingCalls ──────────────────────────────────────────────────

  async cleanupStalePendingCalls(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_CALL_TIMEOUT_MS);
    const staleCalls = await this.callRepo.find({
      where: { status: CallStatus.PENDING, createdAt: LessThan(cutoff) },
      relations: ["participants"],
    });

    if (staleCalls.length === 0) return;

    for (const call of staleCalls) {
      await AppDataSource.transaction(async (manager) => {
        const freshCall = await manager.findOne(VideoCall, {
          where: { id: call.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!freshCall || freshCall.status !== CallStatus.PENDING) return;

        freshCall.status = CallStatus.MISSED;
        freshCall.endedAt = new Date();
        await manager.save(freshCall);

        await manager.update(
          CallParticipant,
          { callId: call.id, status: ParticipantStatus.INVITED },
          { status: ParticipantStatus.MISSED, leftAt: new Date() }
        );
      });

      // ✅ MQ publish — outside transaction
      MQPublisher.sendCallEvent(call.initiatorId, "call:missed", {
        callId: call.id,
      });
      for (const p of call.participants) {
        if (p.userId !== call.initiatorId) {
          MQPublisher.sendCallEvent(p.userId, "call:missed", {
            callId: call.id,
          });
        }
      }
    }
  }

  // ── handleUserDisconnect ──────────────────────────────────────────────────────

  async handleUserDisconnect(userId: string): Promise<void> {
    const activeCall = await this.findActiveCallOfUser(userId);
    if (!activeCall) return;

    try {
      await this.leaveCall(activeCall.id, userId);
    } catch {
      // already left — ignore
    }
  }

  // ── getCallHistory ────────────────────────────────────────────────────────────

  async getCallHistory(query: CallHistoryQuery): Promise<{
    calls: unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { userId, page = 1, limit = 20, type, status } = query;
    const skip = (page - 1) * limit;

    const qb = this.callRepo
      .createQueryBuilder("call")
      .innerJoin(
        "call.participants",
        "myParticipant",
        "myParticipant.userId = :userId",
        { userId }
      )
      .leftJoinAndSelect("call.participants", "allParticipants")
      .leftJoinAndSelect("allParticipants.user", "pUser")
      .leftJoinAndSelect("call.initiator", "initiator")
      .orderBy("call.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    if (type) qb.andWhere("call.type = :type", { type });
    if (status) qb.andWhere("call.status = :status", { status });

    const [calls, total] = await qb.getManyAndCount();

    const formattedCalls = calls.map((call) => ({
      id: call.id,
      roomId: call.roomId,
      type: call.type,
      status: call.status,
      durationSeconds: call.durationSeconds,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      createdAt: call.createdAt,
      isInitiator: call.initiatorId === userId,
      initiator: {
        id: call.initiator.id,
        name: call.initiator.name,
        avatar: call.initiator.avatar,
      },
      participants: call.participants.map((p) => ({
        id: p.userId,
        name: p.user?.name,
        avatar: p.user?.avatar,
        status: p.status,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
      })),
    }));

    return { calls: formattedCalls, total, page, limit };
  }

  // ── Public helpers ────────────────────────────────────────────────────────────

  async getActiveCall(userId: string): Promise<VideoCall | null> {
    return this.findActiveCallOfUser(userId);
  }

  async getCallDetail(callId: string, userId: string): Promise<VideoCall> {
    const call = await this.getCallById(callId);
    const isParticipant = call.participants.some((p) => p.userId === userId);
    if (!isParticipant)
      throw new ForbiddenError("You do not have permission to view this call");
    return call;
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async getCallById(callId: string): Promise<VideoCall> {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ["participants", "participants.user", "initiator"],
    });
    if (!call) throw new NotFoundError("Call does not exist");
    return call;
  }

  private async findActiveCallOfUser(userId: string): Promise<VideoCall | null> {
    return this.callRepo
      .createQueryBuilder("call")
      .innerJoin(
        "call.participants",
        "participant",
        "participant.userId = :userId AND participant.status = :pStatus",
        { userId, pStatus: ParticipantStatus.JOINED }
      )
      .where("call.status IN (:...statuses)", {
        statuses: [CallStatus.PENDING, CallStatus.ACTIVE],
      })
      .getOne();
  }

  /**
   * endCallInternal — shared by leaveCall (last person) and endCall (initiator).
   * Notifies all participants via MQ.
   */
  private async endCallInternal(
    call: VideoCall,
    manager = AppDataSource.manager
  ): Promise<void> {
    const now = new Date();
    let durationSeconds: number | null = null;
    if (call.startedAt) {
      durationSeconds = Math.floor(
        (now.getTime() - call.startedAt.getTime()) / 1000
      );
    }

    call.status = CallStatus.ENDED;
    call.endedAt = now;
    call.durationSeconds = durationSeconds;
    await manager.save(call);

    await manager.update(
      CallParticipant,
      { callId: call.id, status: ParticipantStatus.JOINED },
      { status: ParticipantStatus.LEFT, leftAt: now }
    );

    // ✅ MQ publish — notifies all participants cross-instance
    for (const p of call.participants) {
      MQPublisher.sendCallEvent(p.userId, "call:ended", {
        callId: call.id,
        durationSeconds,
      });
    }
  }
}

export const videoCallService = new VideoCallService();