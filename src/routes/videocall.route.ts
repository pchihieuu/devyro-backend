import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  initiateCallSchema,
  acceptCallSchema,
  declineCallSchema,
  leaveCallSchema,
  endCallSchema,
  cancelCallSchema,
  getCallHistorySchema,
  getCallDetailSchema,
  inviteToCallSchema,
} from "../validators/videocall.validator";
import {
  initiateCall,
  acceptCall,
  declineCall,
  leaveCall,
  endCall,
  cancelCall,
  getCallHistory,
  getActiveCall,
  getCallDetail,
  inviteToCall,
} from "../controllers/videocall.controller";
import { ROUTES } from "../constants/routes";

const router = Router();

router.use(protect);

router.get(
  ROUTES.VIDEO_CALL.HISTORY,
  validate(getCallHistorySchema),
  getCallHistory
);

router.get(ROUTES.VIDEO_CALL.ACTIVE, getActiveCall);

router.post("/", validate(initiateCallSchema), initiateCall);

router.post(ROUTES.VIDEO_CALL.ACCEPT, validate(acceptCallSchema), acceptCall);

router.post(
  ROUTES.VIDEO_CALL.INVITE,
  validate(inviteToCallSchema),
  inviteToCall
);

router.post(
  ROUTES.VIDEO_CALL.DECLINE,
  validate(declineCallSchema),
  declineCall
);

router.post(ROUTES.VIDEO_CALL.LEAVE, validate(leaveCallSchema), leaveCall);

router.post(ROUTES.VIDEO_CALL.END, validate(endCallSchema), endCall);

router.post(ROUTES.VIDEO_CALL.CANCEL, validate(cancelCallSchema), cancelCall);

router.get(
  ROUTES.VIDEO_CALL.BY_ID,
  validate(getCallDetailSchema),
  getCallDetail
);

export default router;
