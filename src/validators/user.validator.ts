import { z } from "zod";

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name must not exceed 100 characters")
        .optional(),
      avatar: z
        .string()
        .optional()
        .refine(
          (val) =>
            !val || val === "" || z.string().url().safeParse(val).success,
          {
            message: "Invalid avatar URL",
          }
        ),
      resume: z
        .string()
        .optional()
        .refine(
          (val) =>
            !val || val === "" || z.string().url().safeParse(val).success,
          {
            message: "Invalid resume URL",
          }
        ),
      companyName: z
        .string()
        .min(2, "Company name must be at least 2 characters")
        .max(200, "Company name must not exceed 200 characters")
        .optional(),
      companyDescription: z
        .string()
        .max(1000, "Company description must not exceed 1000 characters")
        .optional(),
      companyLogo: z
        .string()
        .optional()
        .refine(
          (val) =>
            !val || val === "" || z.string().url().safeParse(val).success,
          {
            message: "Invalid company logo URL",
          }
        ),
      companySize: z.string().max(50).optional(),
      companyIndustry: z.string().max(100).optional(),
      companyAddress: z.string().max(255).optional(),
      companyWebsite: z
        .string()
        .optional()
        .refine(
          (val) =>
            !val || val === "" || z.string().url().safeParse(val).success,
          {
            message: "Invalid website URL",
          }
        ),
    })
    .strip(),
});

export const deleteResumeSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const getPublicProfileSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
});
