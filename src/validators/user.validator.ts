import { z } from "zod";
import { AvailabilityStatus, WorkPreference } from "../entities/User.entity";
export const WorkPreferenceEnum = z.nativeEnum(WorkPreference);
export const AvailabilityStatusEnum = z.nativeEnum(AvailabilityStatus);

const optionalUrlField = (message: string) =>
  z
    .string()
    .url(message)
    .optional()
    .or(z.literal(""))
    .transform((val) => (val === "" ? undefined : val));

// FIX: điểm chuẩn hoá skills DUY NHẤT trong toàn hệ thống — trim, lowercase, dedupe.
// Bắt buộc phải chuẩn hoá ở đây (không phải ở service) vì skills giờ là text[] thật,
// dùng cho toán tử && (overlap) để match với Job.skills. Nếu để lọt "React" và "react"
// là 2 giá trị khác nhau, overlap match sẽ sai/miss âm thầm mà không có lỗi nào báo ra.

// Chuẩn hoá skills DUY NHẤT — dùng chung cho cả field lưu (skillsField) lẫn field filter
// (searchUsersSchema.skills), tránh lặp lại bug "2 nơi transform khác nhau" đã gặp ở job module.
const normalizeSkills = (skills: string[]): string[] =>
  Array.from(
    new Set(skills.map((s) => s.trim().toLowerCase()).filter(Boolean))
  );

const skillsField = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Skill name cannot be empty")
      .max(50, "Skill name must not exceed 50 characters")
  )
  .max(50, "Maximum 50 skills allowed")
  .transform(normalizeSkills);

// Experience schema
const experienceSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must not exceed 100 characters"),
  company: z
    .string()
    .min(1, "Company is required")
    .max(100, "Company must not exceed 100 characters"),
  companyLink: optionalUrlField("Invalid company URL"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(2000, "Description must not exceed 2000 characters"),
  startDate: z.string().datetime("Invalid start date format"),
  endDate: z
    .string()
    .datetime("Invalid end date format")
    .optional()
    .or(z.literal("")),
});

// Project schema
const projectSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must not exceed 100 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(2000, "Description must not exceed 2000 characters"),
  technologies: z
    .array(z.string().max(50, "Technology name must not exceed 50 characters"))
    .min(1, "At least one technology is required"),
  link: optionalUrlField("Invalid project URL"),
  image: optionalUrlField("Invalid image URL"),
});

// --- Update profile schema ---
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(255, "Name must not exceed 255 characters")
        .optional(),

      avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
      resume: z.string().url("Invalid resume URL").optional().or(z.literal("")),

      title: z
        .string()
        .max(100, "Title must not exceed 100 characters")
        .optional()
        .or(z.literal("")),
      bio: z
        .string()
        .max(2000, "Bio must not exceed 2000 characters")
        .optional()
        .or(z.literal("")),
      location: z
        .string()
        .max(255, "Location must not exceed 255 characters")
        .optional()
        .or(z.literal("")),

      workPreference: WorkPreferenceEnum.optional(),
      hourlyRateMin: z
        .number()
        .min(0, "Hourly rate must be positive")
        .optional()
        .or(z.null()),
      hourlyRateMax: z
        .number()
        .min(0, "Hourly rate must be positive")
        .optional()
        .or(z.null()),

      responseTimeHours: z
        .number()
        .int()
        .min(1, "Response time must be at least 1 hour")
        .max(168, "Response time must not exceed 168 hours (1 week)")
        .optional(),

      availabilityStatus: AvailabilityStatusEnum.optional(),

      skills: skillsField.optional(),
    })
    .strip()
    .refine(
      (data) => {
        if (
          data.hourlyRateMin !== undefined &&
          data.hourlyRateMax !== undefined &&
          data.hourlyRateMin !== null &&
          data.hourlyRateMax !== null
        ) {
          return data.hourlyRateMax >= data.hourlyRateMin;
        }
        return true;
      },
      {
        message: "Maximum rate must be greater than or equal to minimum rate",
        path: ["hourlyRateMax"],
      }
    ),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// Delete resume schema
export const deleteResumeSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

// Get public profile schema
export const getPublicProfileSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

// Search users schema
export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().min(1, "Search query is required"),
    // FIX: filter theo skill dùng chung skillsField (đã lowercase) để so khớp đúng
    // với dữ liệu đã chuẩn hoá khi lưu — tránh lặp lại bug "skills có 2 field
    // transform khác nhau" đã từng gặp ở job module. Chấp nhận cả 2 dạng Express
    // parse ra: ?skills=a (string) hoặc ?skills=a&skills=b (array).
    skills: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        const arr = Array.isArray(val) ? val : [val];
        return normalizeSkills(arr);
      }),
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a number")
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a number")
      .optional()
      .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 20)),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

// --- Experience management schemas ---
export const addExperienceSchema = z.object({
  body: experienceSchema.refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end >= start;
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    }
  ),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateExperienceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid experience ID format"),
  }),
  body: experienceSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
  query: z.object({}).optional(),
});

export const deleteExperienceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid experience ID format"),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

// --- Project management schemas ---
export const addProjectSchema = z.object({
  body: projectSchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid project ID format"),
  }),
  body: projectSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  }),
  query: z.object({}).optional(),
});

export const deleteProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

// Get my profile schema
export const getMyProfileSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>["body"];
export type GetPublicProfileParams = z.infer<
  typeof getPublicProfileSchema
>["params"];
export type SearchUsersQuery = z.infer<typeof searchUsersSchema>["query"];
export type AddExperienceBody = z.infer<typeof addExperienceSchema>["body"];
export type UpdateExperienceParams = z.infer<
  typeof updateExperienceSchema
>["params"];
export type UpdateExperienceBody = z.infer<
  typeof updateExperienceSchema
>["body"];
export type DeleteExperienceParams = z.infer<
  typeof deleteExperienceSchema
>["params"];
export type AddProjectBody = z.infer<typeof addProjectSchema>["body"];
export type UpdateProjectParams = z.infer<typeof updateProjectSchema>["params"];
export type UpdateProjectBody = z.infer<typeof updateProjectSchema>["body"];
export type DeleteProjectParams = z.infer<typeof deleteProjectSchema>["params"];
