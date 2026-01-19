import { z } from "zod";

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

export const getCompanyByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid company ID format"),
  }),
});

export const getCompanyJobsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid company ID format"),
  }),
  query: z
    .object({
      page: z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine((val) => val >= 1, "Page must be at least 1")
        .optional(),
      limit: z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine(
          (val) => val >= 1 && val <= 100,
          "Limit must be between 1 and 100"
        )
        .optional(),
      sortBy: z
        .enum(["createdAt", "title", "salaryMin", "salaryMax"])
        .optional(),
      order: z.enum(["asc", "desc"]).optional(),
    })
    .optional(),
});
