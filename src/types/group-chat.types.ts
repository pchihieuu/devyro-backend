import { MessageType } from "../entities/GroupMessage.entity";
import { GroupRole } from "../entities/GroupMember.entity";

// Shared user reference

export interface GroupUserRef {
  id: string;
  name: string;
  avatar: string | null;
}

// Message DTOs 
export interface GroupReplyDTO {
  id: string;
  content: string | null;
  senderId: string;
  senderName: string | null;
  isDeleted: boolean;
}

export interface GroupSeenDTO {
  userId: string;
  seenAt: Date;
}

export interface GroupMessageDTO {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string | null;
  type: MessageType;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMimeType: string | null;
  replyTo: GroupReplyDTO | null;
  seenBy: GroupSeenDTO[];
  seenByMe: boolean;
  isDeleted: boolean;
  createdAt: Date;
}

// Group summary (list endpoint — lightweight)

export interface GroupMemberPreviewDTO {
  id: string;
  name: string;
  avatar: string | null;
  email: string;
  role: GroupRole;
}

export interface GroupSummaryDTO {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
  role: GroupRole;
  memberCount: number;
  members: GroupMemberPreviewDTO[];
  createdAt: Date;
}

// Group detail (single group endpoint)

export interface GroupMemberDetailDTO {
  id: string;
  name: string;
  avatar: string | null;
  email: string;
  role: GroupRole;
  status: string;
  joinedAt: Date | null;
  invitedBy: Pick<GroupUserRef, "id" | "name"> | null;
}

export interface GroupDetailDTO {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  createdBy: Pick<GroupUserRef, "id" | "name">;
  members: GroupMemberDetailDTO[];
  createdAt: Date;
}

// Pending invitation DTO

export interface PendingInvitationDTO {
  groupId: string;
  groupName: string;
  groupAvatar: string | null;
  groupDescription: string | null;
  invitedBy: GroupUserRef;
  invitedAt: Date | null;
}

// Notification event data payloads

export interface GroupInvitationData {
  groupId: string;
  groupName: string;
  invitedBy: GroupUserRef;
  actions: { accept: true; reject: true };
}

export interface GroupUpdatedData {
  groupId: string;
  name: string;
  description: string | null;
  avatar: string | null;
  updatedBy: string;
}

export interface GroupMemberJoinedData {
  groupId: string;
  user: GroupUserRef;
}

export interface GroupMemberRemovedData {
  groupId: string;
  removedUserId: string;
  isSelf: boolean;
}

export interface GroupMemberPromotedData {
  groupId: string;
  promotedUserId: string;
}

export interface GroupInvitationRejectedData {
  groupId: string;
  user: Pick<GroupUserRef, "id" | "name">;
}

export interface GroupMessagesSeenData {
  groupId: string;
  seenBy: string;
  seenAt: Date;
}

export interface GroupMessageDeletedData {
  groupId: string;
  messageId: string;
}

// Discriminated union for all notification events

export type GroupNotificationEvent =
  | { event: "group:invitation";          data: GroupInvitationData }
  | { event: "group:updated";             data: GroupUpdatedData }
  | { event: "group:member:joined";       data: GroupMemberJoinedData }
  | { event: "group:member:removed";      data: GroupMemberRemovedData }
  | { event: "group:member:promoted";     data: GroupMemberPromotedData }
  | { event: "group:invitation:rejected"; data: GroupInvitationRejectedData }
  | { event: "group:messages:seen";       data: GroupMessagesSeenData }
  | { event: "group:message:deleted";     data: GroupMessageDeletedData };

// MQ payloads 

export interface GroupMessagePayload {
  groupId: string;
  message: GroupMessageDTO;
  senderUserId: string;
}

/**
 * GroupNotificationPayload = one of the typed event shapes + targetUserIds.
 * TypeScript narrows `data` automatically when you switch on `event`.
 */
export type GroupNotificationPayload = GroupNotificationEvent & {
  targetUserIds: string[];
};

// Paginated messages response 

export interface GroupMessagesResult {
  messages: GroupMessageDTO[];
  total: number;
  hasMore: boolean;
}

// addMembers result

export interface AddMembersResult {
  invited: string[];
  skipped: string[];
}