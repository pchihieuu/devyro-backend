import { Router } from "express";
import {
  groupChatController,
  uploadMiddleware,
} from "../controllers/group-chat.controller";
import { protect } from "../middlewares/auth.middleware";
import { ROUTES } from "../constants/routes";

const router = Router();
router.use(protect);

// IMPORTANT: Static routes MUST be registered before param routes.
// "/invitations/pending" must come before "/:groupId" or Express will
// match groupId = "invitations" and return the wrong handler.

// Groups
router.get("/", groupChatController.getUserGroups);
router.post("/", groupChatController.createGroup);

// Invitations (static — before /:groupId)
router.get(
  ROUTES.GROUPS.PENDING_INVITATIONS,
  groupChatController.getPendingInvitations
);

router.get(ROUTES.GROUPS.BY_ID, groupChatController.getGroupDetails);
router.patch(ROUTES.GROUPS.UPDATE, groupChatController.updateGroup);
router.post(ROUTES.GROUPS.LEAVE, groupChatController.leaveGroup);

router.post(
  ROUTES.GROUPS.ACCEPT_INVITATION,
  groupChatController.acceptInvitation
);
router.post(
  ROUTES.GROUPS.REJECT_INVITATION,
  groupChatController.rejectInvitation
);

router.get(ROUTES.GROUPS.MESSAGES, groupChatController.getGroupMessages);
router.post(ROUTES.GROUPS.MESSAGES, groupChatController.sendGroupMessage);
router.delete(
  ROUTES.GROUPS.DELETE_MESSAGE,
  groupChatController.deleteGroupMessage
);

router.post(
  ROUTES.GROUPS.UPLOAD_MEDIA,
  uploadMiddleware,
  groupChatController.uploadMedia
);
router.put(ROUTES.GROUPS.MARK_AS_READ, groupChatController.markAsRead);

router.post(ROUTES.GROUPS.MEMBERS, groupChatController.addMembers);
router.delete(ROUTES.GROUPS.REMOVE_MEMBER, groupChatController.removeMember);
router.put(ROUTES.GROUPS.PROMOTE_MEMBER, groupChatController.promoteMember);

export default router;
