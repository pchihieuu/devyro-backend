import { z } from "zod";
import { createPaginationSchema } from "./common.validator";

export const getAllCompaniesSchema = z.object({
  query: z
    .object({
      keyword: z.string().optional(),
      industry: z.string().optional(),
      size: z.string().optional(),
    })
    .merge(createPaginationSchema(["createdAt", "name"] as const)),
});
export type GetAllCompaniesQuery = z.infer<
  typeof getAllCompaniesSchema
>["query"];

export const createCompanySchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Company name must be at least 2 characters")
      .max(255, "Company name must not exceed 255 characters"),
    description: z
      .string()
      .max(2000, "Description must not exceed 2000 characters")
      .optional()
      .or(z.literal("")),
    logo: z.string().url("Invalid logo URL").optional().or(z.literal("")),
    size: z
      .string()
      .max(100, "Size must not exceed 100 characters")
      .optional()
      .or(z.literal("")),
    industry: z
      .string()
      .max(255, "Industry must not exceed 255 characters")
      .optional()
      .or(z.literal("")),
    address: z
      .string()
      .max(500, "Address must not exceed 500 characters")
      .optional()
      .or(z.literal("")),
    website: z.string().url("Invalid website URL").optional().or(z.literal("")),
    foundedYear: z
      .string()
      .max(50, "Founded year must not exceed 50 characters")
      .optional()
      .or(z.literal("")),
    benefits: z.array(z.string()).optional(),
  }),
});
export type CreateCompanyBody = z.infer<typeof createCompanySchema>["body"];

export const updateCompanySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid company ID format"),
  }),
  body: z
    .object({
      name: z
        .string()
        .min(2, "Company name must be at least 2 characters")
        .max(255, "Company name must not exceed 255 characters")
        .optional(),
      description: z
        .string()
        .max(2000, "Description must not exceed 2000 characters")
        .optional()
        .or(z.literal("")),
      logo: z.string().url("Invalid logo URL").optional().or(z.literal("")),
      size: z
        .string()
        .max(100, "Size must not exceed 100 characters")
        .optional()
        .or(z.literal("")),
      industry: z
        .string()
        .max(255, "Industry must not exceed 255 characters")
        .optional()
        .or(z.literal("")),
      address: z
        .string()
        .max(500, "Address must not exceed 500 characters")
        .optional()
        .or(z.literal("")),
      website: z
        .string()
        .url("Invalid website URL")
        .optional()
        .or(z.literal("")),
      foundedYear: z
        .string()
        .max(50, "Founded year must not exceed 50 characters")
        .optional()
        .or(z.literal("")),
      benefits: z.array(z.string()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});
export type UpdateCompanyParams = z.infer<typeof updateCompanySchema>["params"];
export type UpdateCompanyBody = z.infer<typeof updateCompanySchema>["body"];

export const getCompanyByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid company ID format"),
  }),
});
export type GetCompanyByIdParams = z.infer<
  typeof getCompanyByIdSchema
>["params"];

// Trước đây tự định nghĩa page/limit/sortBy/order riêng (order: "asc"/"desc" thường),
// lệch với createPaginationSchema (order: "ASC"/"DESC" khớp PaginationOptions) khiến
// controller phải tự .toUpperCase(). Giờ dùng chung factory như getAllCompaniesSchema.
export const getCompanyJobsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid company ID format"),
  }),
  query: createPaginationSchema([
    "createdAt",
    "title",
    "salaryMin",
    "salaryMax",
  ] as const),
});
export type GetCompanyJobsParams = z.infer<
  typeof getCompanyJobsSchema
>["params"];
export type GetCompanyJobsQuery = z.infer<typeof getCompanyJobsSchema>["query"];
