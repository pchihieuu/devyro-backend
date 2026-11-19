import { z } from "zod";
import { decimalString, isoDate, uuid } from "./common";

export const userRole = z
  .enum(["jobseeker", "employer", "admin"])
  .meta({ id: "UserRole" });
const workPreference = z.enum(["onsite", "remote", "hybrid"]);
const availabilityStatus = z.enum(["available", "busy", "unavailable"]);

export const experience = z
  .object({
    id: z.string(),
    title: z.string(),
    company: z.string(),
    companyLink: z.string().optional(),
    description: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
  })
  .meta({ id: "Experience" });

export const project = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
    link: z.string().optional(),
    image: z.string().optional(),
  })
  .meta({ id: "Project" });

const publicProfileShape = {
  id: uuid,
  name: z.string(),
  role: userRole,
  avatar: z.string().nullable(),
  username: z.string().nullable(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  workPreference: workPreference.nullable(),
  hourlyRateMin: decimalString.nullable(),
  hourlyRateMax: decimalString.nullable(),
  completionRate: z.number().int(),
  totalProjects: z.number().int(),
  responseTimeHours: z.number().int(),
  availabilityStatus,
  skills: z.array(z.string()).nullable(),
  experience: z.array(experience).nullable(),
  projects: z.array(project).nullable(),
  rating: decimalString,
  reviewCount: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
};

/** GET /users/:id — `resume` only available when the viewer is permitted (employer/owner). */
export const publicProfile = z
  .object({ ...publicProfileShape, resume: z.string().optional() })
  .meta({ id: "PublicProfile" });

/** GET /users/me, /auth/me, PATCH /users/profile */
export const myProfile = z
  .object({
    ...publicProfileShape,
    email: z.email(),
    resume: z.string().nullable(),
  })
  .meta({ id: "MyProfile" });

/** Kết quả register/login (refreshToken đi qua cookie httpOnly, không có trong body). */
export const authSession = z
  .object({
    id: uuid,
    name: z.string(),
    email: z.email(),
    avatar: z.string().nullable(),
    role: userRole,
    resume: z.string().nullable(),
    accessToken: z.string().meta({
      description: "JWT - sent in header Authorization: Bearer <token>",
    }),
  })
  .meta({ id: "AuthSession" });

export const activeSession = z
  .object({
    id: z.string().meta({
      description:
        "= jti of the refresh token; used for DELETE /auth/sessions/{tokenId}",
    }),
    deviceInfo: z.string().optional(),
    ipAddress: z.string().optional(),
    createdAt: z.string(),
    expiresAt: isoDate,
  })
  .meta({ id: "ActiveSession" });
