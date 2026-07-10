import { z } from "zod";
import { JobType, JobLevel } from "../entities/Job.entity";
import { createPaginationSchema } from "./common.validator";
import { stripHtmlLength } from "../utils/htmlStrip.util";

export const employerJobsQuerySchema = z.object({
  query: createPaginationSchema([
    "createdAt",
    "title",
    "salaryMin",
    "salaryMax",
  ] as const),
});

// Field dùng chung cho description/requirement: validate theo nội dung
// thật sau khi strip HTML (dùng `he` decode entity), không đếm markup.
const richTextField = (label: string) =>
  z.string().refine((val) => stripHtmlLength(val) >= 20, {
    message: `${label} must be at least 20 characters`,
  });

export const createJobSchema = z.object({
  body: z
    .object({
      title: z
        .string()
        .min(5, "Title must be at least 5 characters")
        .max(500, "Title must not exceed 500 characters"),
      description: richTextField("Description"),
      requirement: richTextField("Requirements"),
      location: z
        .string()
        .min(2, "Location must be at least 2 characters")
        .max(255, "Location must not exceed 255 characters"),
      category: z
        .string()
        .min(2, "Category must be at least 2 characters")
        .max(255, "Category must not exceed 255 characters"),
      type: z.nativeEnum(JobType),
      level: z.nativeEnum(JobLevel).optional(),
      salaryMin: z.coerce
        .number()
        .positive("Minimum salary must be positive")
        .optional(),
      salaryMax: z.coerce
        .number()
        .positive("Maximum salary must be positive")
        .optional(),
    })
    .refine(
      (data) => {
        if (data.salaryMin && data.salaryMax) {
          return data.salaryMax >= data.salaryMin;
        }
        return true;
      },
      {
        message:
          "Maximum salary must be greater than or equal to minimum salary",
        path: ["salaryMax"],
      }
    ),
});

export const updateJobSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid job ID format"),
  }),
  body: z
    .object({
      title: z.string().min(5).max(500).optional(),
      description: richTextField("Description").optional(),
      requirement: richTextField("Requirements").optional(),
      location: z.string().min(2).max(255).optional(),
      category: z.string().min(2).max(255).optional(),
      type: z.nativeEnum(JobType).optional(),
      level: z.nativeEnum(JobLevel).optional(),
      salaryMin: z.coerce
        .number()
        .positive("Minimum salary must be positive")
        .optional(),
      salaryMax: z.coerce
        .number()
        .positive("Maximum salary must be positive")
        .optional(),
    })
    .refine(
      (data) => {
        if (data.salaryMin && data.salaryMax) {
          return data.salaryMax >= data.salaryMin;
        }
        return true;
      },
      {
        message:
          "Maximum salary must be greater than or equal to minimum salary",
        path: ["salaryMax"],
      }
    ),
});

export const getJobByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid job ID format"),
  }),
  query: z.object({
    userId: z.string().uuid("Invalid user ID format").optional(),
  }),
});

export const getJobsSchema = z.object({
  query: z.object({
    keyword: z.string().optional(),
    location: z.string().optional(),
    category: z.union([z.string(), z.array(z.string())]).optional(),
    type: z.union([z.string(), z.array(z.string())]).optional(),
    level: z.string().optional(),
    minSalary: z.string().regex(/^\d+$/, "Must be a number").optional(),
    maxSalary: z.string().regex(/^\d+$/, "Must be a number").optional(),
    userId: z.string().uuid().optional(),
    page: z.string().regex(/^\d+$/, "Page must be a number").optional(),
    limit: z.string().regex(/^\d+$/, "Limit must be a number").optional(),
    sortBy: z.string().optional(),
    order: z.enum(["asc", "desc", "ASC", "DESC"]).optional(),
  }),
});

export const jobIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid job ID format"),
  }),
});
