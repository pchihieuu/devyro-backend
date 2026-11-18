import { Router } from "express";
import { ROUTES } from "../constants/routes";
import authRoutes from "./auth.route";
import userRoutes from "./user.route";
import jobRoutes from "./job.route";
import applicationRoutes from "./application.route";
import savedJobRoutes from "./savedJob.route";
import analyticsRoutes from "./analytics.route";
import companyRoutes from "./company.route";
import notificationRoutes from "./notification.route";
import chatRoutes from "./chat.routes";
import blogRoutes from "./blog.route";
import groupChatRoutes from "./group-chat.routes";

export interface ApiRouterMount {
  /** Base path, vd "/jobs" (đã nằm sau API_PREFIX). */
  base: string;
  router: Router;
  /** Tên nhóm hiển thị trong tài liệu OpenAPI. */
  tag: string;
}

/**
 * NGUỒN DUY NHẤT của danh sách router: app.ts mount từ đây, OpenAPI generator
 * đọc cũng từ đây. Thêm module mới = thêm 1 dòng ở đây, không thể "mount mà
 * quên tài liệu" hay ngược lại.
 */
export const apiRouters: readonly ApiRouterMount[] = [
  { base: ROUTES.AUTH.BASE, router: authRoutes, tag: "auth" },
  { base: ROUTES.USERS.BASE, router: userRoutes, tag: "users" },
  { base: ROUTES.JOBS.BASE, router: jobRoutes, tag: "jobs" },
  { base: ROUTES.APPLICATIONS.BASE, router: applicationRoutes, tag: "applications" },
  { base: ROUTES.SAVED_JOBS.BASE, router: savedJobRoutes, tag: "saved-jobs" },
  { base: ROUTES.ANALYTICS.BASE, router: analyticsRoutes, tag: "analytics" },
  { base: ROUTES.COMPANIES.BASE, router: companyRoutes, tag: "companies" },
  { base: ROUTES.NOTIFICATIONS.BASE, router: notificationRoutes, tag: "notifications" },
  { base: ROUTES.CHAT.BASE, router: chatRoutes, tag: "chat" },
  { base: ROUTES.BLOGS.BASE, router: blogRoutes, tag: "blogs" },
  { base: ROUTES.GROUPS.BASE, router: groupChatRoutes, tag: "groups" },
];
