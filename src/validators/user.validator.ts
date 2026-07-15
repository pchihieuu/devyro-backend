import { z } from "zod";

export const WorkPreferenceEnum = z.enum(["onsite", "remote", "hybrid"]);
export const AvailabilityStatusEnum = z.enum([
  "available",
  "busy",
  "unavailable",
]);

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
  companyLink: z
    .string()
    .url("Invalid company URL")
    .optional()
    .or(z.literal("")),
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
  link: z.string().url("Invalid project URL").optional().or(z.literal("")),
  image: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

// Update profile schema
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

      skills: z
        .array(z.string().max(50, "Skill name must not exceed 50 characters"))
        .max(50, "Maximum 50 skills allowed")
        .optional(),

      experience: z
        .array(experienceSchema)
        .max(20, "Maximum 20 experiences allowed")
        .optional(),

      projects: z
        .array(projectSchema)
        .max(50, "Maximum 50 projects allowed")
        .optional(),
    })
    .strip() // ✅ strip TRƯỚC refine
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
});

// Search users schema
export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().min(1, "Search query is required"),
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
});

// Experience management schemas
export const addExperienceSchema = z.object({
  body: experienceSchema.refine(
    (data) => {
      // Validate that endDate is after startDate if both are provided
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
});

export const updateExperienceSchema = z.object({
  params: z.object({
    index: z
      .string()
      .regex(/^\d+$/, "Index must be a number")
      .transform((val) => parseInt(val, 10)),
  }),
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
});

export const deleteExperienceSchema = z.object({
  params: z.object({
    index: z
      .string()
      .regex(/^\d+$/, "Index must be a number")
      .transform((val) => parseInt(val, 10)),
  }),
});

// Project management schemas
export const addProjectSchema = z.object({
  body: projectSchema,
});

export const updateProjectSchema = z.object({
  params: z.object({
    index: z
      .string()
      .regex(/^\d+$/, "Index must be a number")
      .transform((val) => parseInt(val, 10)),
  }),
  body: projectSchema,
});

export const deleteProjectSchema = z.object({
  params: z.object({
    index: z
      .string()
      .regex(/^\d+$/, "Index must be a number")
      .transform((val) => parseInt(val, 10)),
  }),
});

// Get my profile schema
export const getMyProfileSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
