export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

export const ROUTES = {
  HEALTH: {
    CHECK: "/health",
  },
  AUTH: {
    BASE: "/auth",
    REGISTER: "/register",
    LOGIN: "/login",
    REFRESH_TOKEN: "/refresh-token",
    LOGOUT: "/logout",
    LOGOUT_ALL: "/logout-all",
    SESSIONS: "/sessions",
    REVOKE_SESSION: "/sessions/:tokenId",
    PROFILE: "/profile",
    ME: "/me",
    UPLOAD_IMAGE: "/upload-image",
    UPLOAD_IMAGE_PUBLIC: "/upload-image-public",
    UPLOAD_RESUME: "/upload-resume",
    FORGOT_PASSWORD: "/forgot-password",
    RESET_PASSWORD: "/reset-password",
    VERIFY_RESET_TOKEN: "/verify-reset-token/:token",
  },
  USERS: {
    BASE: "/users",
    BY_ID: "/:id",
    MY_PROFILE: "/me",
    UPDATE_PROFILE: "/profile",
    DELETE_RESUME: "/resume",
    SEARCH: "/search",
    EXPERIENCE: "/experience",
    EXPERIENCE_BY_ID: "/experience/:id",
    PROJECTS: "/projects",
    PROJECT_BY_ID: "/projects/:id",
  },
  JOBS: {
    BASE: "/jobs",
    EMPLOYER_JOBS: "/employer",
    BY_ID: "/:id",
    TOGGLE_CLOSE: "/:id/toggle-close",
  },
  APPLICATIONS: {
    BASE: "/applications",
    MY: "/my",
    BY_ID: "/:id",
    APPLY_JOB: "/apply/:jobId",
    UPDATE_STATUS: "/:id/status",
    JOB_APPLICATIONS: "/job/:jobId",
    WITH_DRAW: "/:id/withdraw",
    ANALYZE: "/:id/analyze",
  },
  SAVED_JOBS: {
    BASE: "/saved-jobs",
    BY_ID: "/:jobId",
    MY: "/my",
  },
  NOTIFICATIONS: {
    BASE: "/notifications",
    BY_ID: "/:id",
    UNREAD_COUNT: "/unread-count",
    MARK_READ: "/:id/read",
    MARK_ALL_READ: "/read-all",
  },
  ANALYTICS: {
    BASE: "/analytics",
    OVERVIEW: "/overview",
  },
  COMPANIES: {
    BASE: "/companies",
    BY_ID: "/:id",
    MY: "/my",
    JOBS: "/:id/jobs",
    UPLOAD_LOGO: "/upload-logo",
  },
  CHAT: {
    BASE: "/chat",
    CONVERSATIONS: "/conversations",
    START_CONVERSATION: "/conversations/start",
    UNREAD_COUNT: "/unread-count",
    MESSAGES: "/messages",
    GET_MESSAGES: "/messages/:otherUserId",
    MARK_AS_READ: "/messages/:otherUserId/read",
    DELETE_MESSAGE: "/messages/:messageId",
    DELETE_CONVERSATION: "/conversations/:otherUserId",
  },
  BLOGS: {
    BASE: "/blogs",
    BY_SLUG: "/:slug",
    RELATED: "/related/:id",
    LATEST: "/latest",
    CATEGORIES: "/categories",

    ADMIN: {
      POSTS: "/admin/posts",
      POST_BY_ID: "/admin/posts/:id",
      UPLOAD_IMAGE: "/admin/posts/upload-image",

      CATEGORIES: "/admin/categories",
      CATEGORY_BY_ID: "/admin/categories/:id",
    },
  },
  GROUPS: {
    BASE: "/groups",

    PENDING_INVITATIONS: "/invitations/pending",

    BY_ID: "/:groupId",
    UPDATE: "/:groupId",
    LEAVE: "/:groupId/leave",

    ACCEPT_INVITATION: "/:groupId/invitations/accept",
    REJECT_INVITATION: "/:groupId/invitations/reject",

    MESSAGES: "/:groupId/messages",
    DELETE_MESSAGE: "/:groupId/messages/:messageId",

    UPLOAD_MEDIA: "/:groupId/media",

    MARK_AS_READ: "/:groupId/read",

    MEMBERS: "/:groupId/members",
    REMOVE_MEMBER: "/:groupId/members/:targetUserId",
    PROMOTE_MEMBER: "/:groupId/members/:targetUserId/promote",
  },
};
