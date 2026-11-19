import { z } from "zod";
import { OpCatalog } from "../types";
import { activeSession, authSession, myProfile } from "../schemas/user";
import { uploadedImage } from "../schemas/misc";

export const authCatalog: OpCatalog = {
  "POST /auth/register": {
    summary: "Register an account",
    description:
      "Create a user, send a welcome email, and set the `refreshToken` cookie.",
    status: 201,
    data: authSession,
    setsRefreshCookie: true,
    errors: { 409: "Email already exists" },
  },
  "POST /auth/login": {
    summary: "Login",
    description:
      "Return `accessToken` in the body; `refreshToken` is in the httpOnly cookie.",
    data: authSession,
    setsRefreshCookie: true,
    errors: { 401: "Invalid email or password" },
  },
  "POST /auth/refresh-token": {
    summary: "Generate new access token",
    description:
      "Read the `refreshToken` cookie (no need for a body). Rotate the refresh token.",
    data: z.object({ accessToken: z.string() }),
    usesRefreshCookie: true,
    setsRefreshCookie: true,
  },
  "POST /auth/upload-image-public": {
    summary: "Upload image (public, use during registration)",
    status: 201,
    data: uploadedImage,
    multipart: { field: "image" },
  },
  "POST /auth/forgot-password": {
    summary: "Request password reset email",
    description:
      "Always return 200 whether the email exists or not (to prevent email enumeration).",
  },
  "POST /auth/reset-password": { summary: "Reset password using token" },
  "GET /auth/verify-reset-token/:token": {
    summary: "Verify that the password reset token is still valid",
    errors: { 400: "The token is invalid or has expired." },
  },
  "GET /auth/me": { summary: "My Profile", data: myProfile },
  "POST /auth/logout": { summary: "Logout current device" },
  "POST /auth/logout-all": { summary: "Logout all devices" },
  "GET /auth/sessions": {
    summary: "List of active login sessions",
    data: z.array(activeSession),
  },
  "DELETE /auth/sessions/:tokenId": { summary: "Revoke a login session" },
  "POST /auth/upload-image": {
    summary: "Upload avatar",
    description:
      "Automatically update the user's `avatar` after the upload (asynchronously).",
    status: 201,
    data: uploadedImage,
    multipart: { field: "image" },
  },
  "POST /auth/upload-resume": {
    summary: "Upload CV (PDF)",
    description:
      "Upload complete and automatically update the user's `resume` (asynchronously).",
    status: 201,
    data: z.object({ resumeUrl: z.string().url(), publicId: z.string() }),
    multipart: { field: "resume", description: "PDF, maximum 5MB" },
  },
};
