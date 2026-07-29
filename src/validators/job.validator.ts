import { z } from "zod";
import { JobType, JobLevel } from "../entities/Job.entity";
import { createPaginationSchema } from "./common.validator";
import { stripHtmlLength } from "../utils/htmlStrip.util";

export const jobIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid job ID format"),
  }),
});
export type JobIdParams = z.infer<typeof jobIdParamSchema>["params"];

export const getJobByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid job ID format"),
  }),
});

export type GetJobByIdParams = z.infer<typeof getJobByIdSchema>["params"];
// export type GetJobByIdQuery = z.infer<typeof getJobByIdSchema>["query"];

export const employerJobsQuerySchema = z.object({
  query: createPaginationSchema([
    "createdAt",
    "title",
    "salaryMin",
    "salaryMax",
  ] as const),
});
export type EmployerJobsQuery = z.infer<
  typeof employerJobsQuerySchema
>["query"];

const skillsField = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    // Chấp nhận cả 2 trường hợp: FE gửi array (đúng như JobPostingForm hiện tại)
    // hoặc lỡ gửi 1 string đơn/comma-separated -> vẫn ra được array chuẩn.
    const arr = Array.isArray(val) ? val : val.split(",");
    return arr.map((s) => s.trim().toLocaleLowerCase()).filter(Boolean);
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
      skills: skillsField,
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
      skills: skillsField,
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
export type UpdateJobParams = z.infer<typeof updateJobSchema>["params"]; // ✅ thêm
export type UpdateJobBody = z.infer<typeof updateJobSchema>["body"];

// Filter field riêng của job listing — không thuộc phạm vi pagination,
// nên tách khỏi createPaginationSchema và .merge() lại với nó bên dưới.
// Chấp nhận cả string đơn lẻ lẫn array (FE có thể gửi ?category=a&category=b
// -> Express tự parse thành array; gửi 1 giá trị -> string).
const jobFilterFields = z.object({
  keyword: z.string().trim().optional(),
  location: z.string().trim().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  type: z.union([z.string(), z.array(z.string())]).optional(),
  level: z.string().optional(),
  minSalary: z.coerce
    .number()
    .nonnegative("minSalary must be a non-negative number")
    .optional(),
  maxSalary: z.coerce
    .number()
    .nonnegative("maxSalary must be a non-negative number")
    .optional(),
  // Controller hiện đang destructure `skills` từ req.query nhưng schema cũ
  // không khai báo field này -> Zod strip mất, filter theo skills bị vô hiệu
  // hoá âm thầm. Bổ sung lại ở đây để khớp với những gì service/controller
  // thực sự đang dùng.
  skills: skillsField,
  // userId: z.string().uuid("Invalid user ID format").optional(),
});

export const getJobsSchema = z.object({
  query: createPaginationSchema(
    ["createdAt", "title", "salaryMin", "salaryMax"] as const,
    "createdAt"
  ).merge(jobFilterFields),
});
export type GetJobsQuery = z.infer<typeof getJobsSchema>["query"];
