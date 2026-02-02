export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

export const ROUTES = {
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
    UPDATE_PROFILE: "/profile",
    DELETE_RESUME: "/resume",
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
  },
};
