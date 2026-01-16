export const API_PREFIX = "/api/v1";

export const ROUTES = {
  AUTH: {
    BASE: "/auth",
    REGISTER: "/register",
    LOGIN: "/login",
    PROFILE: "/profile",
    ME: "/me",
    UPLOAD_IMAGE: "/upload-image",
    UPLOAD_RESUME: "/upload-resume",
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
  },
  SAVED_JOBS: {
    BASE: "/saved-jobs",
    BY_ID: "/:jobId",
    MY: "/my",
  },
  ANALYTICS: {
    BASE: "/analytics",
    OVERVIEW: "/overview",
  },
};
