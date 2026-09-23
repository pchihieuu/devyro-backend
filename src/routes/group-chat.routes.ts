import { Router } from "express";
import {
  groupChatController,
  uploadMiddleware,
} from "../controllers/group-chat.controller";
import { protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { ROUTES } from "../constants/routes";
import {
  addMembersSchema,
  createGroupSchema,
  deleteGroupMessageSchema,
  getGroupMessagesSchema,
  groupIdParamSchema,
  memberActionParamsSchema,
  sendGroupMessageSchema,
  updateGroupSchema,
} from "../validators/group-chat.validator";

const router = Router();
router.use(protect);

// IMPORTANT: Static routes MUST be registered before param routes.
// "/invitations/pending" must come before "/:groupId" or Express will
// match groupId = "invitations" and return the wrong handler.

// Groups
router.get("/", groupChatController.getUserGroups);
router.post("/", validate(createGroupSchema), groupChatController.createGroup);

// Invitations (static — before /:groupId)
router.get(
  ROUTES.GROUPS.PENDING_INVITATIONS,
  groupChatController.getPendingInvitations
);

router.get(
  ROUTES.GROUPS.BY_ID,
  validate(groupIdParamSchema),
  groupChatController.getGroupDetails
);
router.patch(
  ROUTES.GROUPS.UPDATE,
  validate(updateGroupSchema),
  groupChatController.updateGroup
);
router.post(
  ROUTES.GROUPS.LEAVE,
  validate(groupIdParamSchema),
  groupChatController.leaveGroup
);

router.post(
  ROUTES.GROUPS.ACCEPT_INVITATION,
  validate(groupIdParamSchema),
  groupChatController.acceptInvitation
);
router.post(
  ROUTES.GROUPS.REJECT_INVITATION,
  validate(groupIdParamSchema),
  groupChatController.rejectInvitation
);

router.get(
  ROUTES.GROUPS.MESSAGES,
  validate(getGroupMessagesSchema),
  groupChatController.getGroupMessages
);
router.post(
  ROUTES.GROUPS.MESSAGES,
  validate(sendGroupMessageSchema),
  groupChatController.sendGroupMessage
);
router.delete(
  ROUTES.GROUPS.DELETE_MESSAGE,
  validate(deleteGroupMessageSchema),
  groupChatController.deleteGroupMessage
);

router.post(
  ROUTES.GROUPS.UPLOAD_MEDIA,
  validate(groupIdParamSchema),
  uploadMiddleware,
  groupChatController.uploadMedia
);
router.put(
  ROUTES.GROUPS.MARK_AS_READ,
  validate(groupIdParamSchema),
  groupChatController.markAsRead
);

router.post(
  ROUTES.GROUPS.MEMBERS,
  validate(addMembersSchema),
  groupChatController.addMembers
);
router.delete(
  ROUTES.GROUPS.REMOVE_MEMBER,
  validate(memberActionParamsSchema),
  groupChatController.removeMember
);
router.put(
  ROUTES.GROUPS.PROMOTE_MEMBER,
  validate(memberActionParamsSchema),
  groupChatController.promoteMember
);

export default router;
