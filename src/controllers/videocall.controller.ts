import { Request, Response, NextFunction } from "express";
import { videoCallService } from "../services/videocall.service";
import { CallStatus, CallType } from "../entities/Videocall.entity";

export const initiateCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const initiatorId = req.user!.id;
    const { participantIds, type = CallType.VIDEO } = req.body;

    const call = await videoCallService.initiateCall({
      initiatorId,
      participantIds,
      type,
    });

    res.status(201).json({
      success: true,
      message: "Call initiated successfully",
      data: {
        callId: call.id,
        roomId: call.roomId,
        type: call.type,
        status: call.status,
        participants: call.participants.map((p) => ({
          userId: p.userId,
          status: p.status,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const inviteToCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inviterId = req.user!.id;
    const { callId } = req.params;
    const { userIds } = req.body;

    await videoCallService.inviteToCall(callId, inviterId, userIds);

    res.status(200).json({
      success: true,
      message: "Users invited to the call successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const acceptCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { callId } = req.params;

    const call = await videoCallService.acceptCall(callId, userId);

    res.status(200).json({
      success: true,
      message: "Call accepted successfully",
      data: {
        callId: call.id,
        roomId: call.roomId,
        type: call.type,
        status: call.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const declineCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { callId } = req.params;

    await videoCallService.declineCall(callId, userId);

    res.status(200).json({
      success: true,
      message: "Call declined successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const leaveCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { callId } = req.params;

    await videoCallService.leaveCall(callId, userId);

    res.status(200).json({
      success: true,
      message: "Left call successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const endCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { callId } = req.params;

    await videoCallService.endCall(callId, userId);

    res.status(200).json({
      success: true,
      message: "Call ended successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const cancelCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { callId } = req.params;

    await videoCallService.cancelCall(callId, userId);

    res.status(200).json({
      success: true,
      message: "Call cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getCallHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      page = "1",
      limit = "20",
      type,
      status,
    } = req.query;

    const result = await videoCallService.getCallHistory({
      userId,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      type: type as CallType | undefined,
      status: status as CallStatus | undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveCall = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const activeCall = await videoCallService.getActiveCall(userId);

    res.status(200).json({
      success: true,
      data: activeCall
        ? {
            callId: activeCall.id,
            roomId: activeCall.roomId,
            type: activeCall.type,
            status: activeCall.status,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

export const getCallDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { callId } = req.params;

    const call = await videoCallService.getCallDetail(callId, userId);

    res.status(200).json({
      success: true,
      data: {
        id: call.id,
        roomId: call.roomId,
        type: call.type,
        status: call.status,
        durationSeconds: call.durationSeconds,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        createdAt: call.createdAt,
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
      },
    });
  } catch (error) {
    next(error);
  }
};