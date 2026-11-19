import { z } from "zod";
import { isoDate, uuid, userRef } from "./common";
import { jobType } from "./job";
import { applicationStatus } from "./application";

export const notificationType = z
  .enum(["application_status_updated", "job_applied", "job_saved"])
  .meta({ id: "NotificationType" });

export const notification = z
  .object({
    id: uuid,
    title: z.string(),
    message: z.string(),
    type: notificationType,
    isRead: z.boolean(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    userId: uuid,
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .meta({ id: "Notification" });

export const employerAnalytics = z
  .object({
    counts: z.object({
      totalActiveJobs: z.number().int(),
      totalApplications: z.number().int(),
      totalHired: z.number().int(),
      trends: z
        .object({
          activeJobs: z.number(),
          applications: z.number(),
          totalHired: z.number(),
        })
        .meta({
          description:
            "% change over the last 7 days compared to the preceding 7 days",
        }),
    }),
    data: z.object({
      recentJobs: z.array(
        z.object({
          id: uuid,
          title: z.string(),
          location: z.string(),
          type: jobType,
          createdAt: isoDate,
          isClosed: z.boolean(),
        })
      ),
      recentApplications: z.array(
        z.object({
          id: uuid,
          status: applicationStatus,
          createdAt: isoDate,
          updatedAt: isoDate,
          applicant: z
            .object({
              id: uuid,
              name: z.string(),
              email: z.email(),
              avatar: z.string().nullable(),
            })
            .nullable(),
          job: z.object({ id: uuid, title: z.string() }).nullable(),
        })
      ),
    }),
  })
  .meta({ id: "EmployerAnalytics" });

export const directMessageType = z.enum(["text", "image", "file"]);

export const directMessage = z
  .object({
    id: uuid,
    senderId: uuid,
    receiverId: uuid,
    content: z.string(),
    type: directMessageType,
    fileUrl: z.string().nullable(),
    isRead: z.boolean(),
    createdAt: isoDate,
    sender: userRef.optional(),
    receiver: userRef.optional(),
  })
  .meta({ id: "DirectMessage" });

export const conversationSummary = z
  .object({
    id: uuid,
    otherUser: z.object({
      id: uuid,
      name: z.string(),
      avatar: z.string().nullable(),
      email: z.email(),
    }),
    lastMessage: z.string().nullable(),
    lastMessageAt: isoDate.nullable(),
    unreadCount: z.number().int(),
    createdAt: isoDate,
  })
  .meta({ id: "ConversationSummary" });

export const conversation = z
  .object({
    id: uuid,
    lastMessage: z.string().nullable(),
    lastMessageSenderId: uuid.nullable(),
    lastMessageAt: isoDate.nullable(),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .catchall(z.unknown())
  .meta({ id: "Conversation" });

export const groupRole = z.enum(["admin", "member"]).meta({ id: "GroupRole" });
export const groupMessageType = z.enum(["text", "image", "file", "video"]);

export const groupSummary = z
  .object({
    id: uuid,
    name: z.string(),
    description: z.string().nullable(),
    avatar: z.string().nullable(),
    lastMessage: z.string().nullable(),
    lastMessageAt: isoDate.nullable(),
    lastMessageSenderId: uuid.nullable(),
    unreadCount: z.number().int(),
    role: groupRole,
    memberCount: z.number().int(),
    members: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        avatar: z.string().nullable(),
        email: z.email(),
        role: groupRole,
      })
    ),
    createdAt: isoDate,
  })
  .meta({ id: "GroupSummary" });

export const groupDetail = z
  .object({
    id: uuid,
    name: z.string(),
    description: z.string().nullable(),
    avatar: z.string().nullable(),
    createdBy: z.object({ id: uuid, name: z.string() }),
    members: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        avatar: z.string().nullable(),
        email: z.email(),
        role: groupRole,
        status: z.string(),
        joinedAt: isoDate.nullable(),
        invitedBy: z.object({ id: uuid, name: z.string() }).nullable(),
      })
    ),
    createdAt: isoDate,
  })
  .meta({ id: "GroupDetail" });

export const groupMessage = z
  .object({
    id: uuid,
    groupId: uuid,
    senderId: uuid,
    senderName: z.string(),
    senderAvatar: z.string().nullable(),
    content: z.string().nullable(),
    type: groupMessageType,
    fileUrl: z.string().nullable(),
    fileName: z.string().nullable(),
    fileSize: z.number().int().nullable(),
    fileMimeType: z.string().nullable(),
    replyTo: z
      .object({
        id: uuid,
        content: z.string().nullable(),
        senderId: uuid,
        senderName: z.string().nullable(),
        isDeleted: z.boolean(),
      })
      .nullable(),
    seenBy: z.array(z.object({ userId: uuid, seenAt: isoDate })),
    seenByMe: z.boolean(),
    isDeleted: z.boolean(),
    createdAt: isoDate,
  })
  .meta({ id: "GroupMessage" });

export const pendingInvitation = z
  .object({
    groupId: uuid,
    groupName: z.string(),
    groupAvatar: z.string().nullable(),
    groupDescription: z.string().nullable(),
    invitedBy: userRef,
    invitedAt: isoDate.nullable(),
  })
  .meta({ id: "PendingInvitation" });

export const blogCategory = z
  .object({
    id: uuid,
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    type: z.enum(["portal_news", "industry_news"]),
    isActive: z.boolean(),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .meta({ id: "BlogCategory" });

export const blogTag = z
  .object({ id: uuid, name: z.string(), slug: z.string() })
  .catchall(z.unknown())
  .meta({ id: "BlogTag" });

export const blogPost = z
  .object({
    id: uuid,
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().nullable(),
    content: z
      .string()
      .meta({ description: "HTML. Not available in the abbreviated list" })
      .optional(),
    thumbnail: z.string().nullable(),
    status: z.enum(["draft", "published", "archived"]),
    viewCount: z.number().int(),
    publishedAt: isoDate.nullable(),
    authorId: uuid,
    categoryId: uuid,
    author: z
      .object({
        id: uuid,
        name: z.string(),
        avatar: z.string().nullable().optional(),
      })
      .optional(),
    category: blogCategory.optional(),
    tags: z.array(blogTag).optional(),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .meta({ id: "BlogPost" });

export const uploadedImage = z.object({
  imageUrl: z.string().url(),
  publicId: z.string(),
});
