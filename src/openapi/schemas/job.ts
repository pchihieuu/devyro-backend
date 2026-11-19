import { z } from "zod";
import { decimalString, isoDate, uuid } from "./common";

export const jobType = z
  .enum([
    "Full-time",
    "Part-time",
    "Contract",
    "Internship",
    "Freelance",
    "Remote",
    "Hybrid",
  ])
  .meta({ id: "JobType" });
export const jobLevel = z
  .enum(["Intern", "Fresher", "Junior", "Middle", "Senior", "Lead"])
  .meta({ id: "JobLevel" });

export const companySummary = z
  .object({
    id: uuid,
    name: z.string(),
    logo: z.string().nullable(),
    industry: z.string().nullable(),
    size: z.string().nullable(),
  })
  .meta({ id: "CompanySummary" });

export const companyDetail = z
  .object({
    id: uuid,
    name: z.string(),
    description: z.string().nullable(),
    logo: z.string().nullable(),
    size: z.string().nullable(),
    industry: z.string().nullable(),
    address: z.string().nullable(),
    website: z.string().nullable(),
    foundedYear: z.string().nullable(),
    benefits: z.array(z.string()).nullable(),
    totalJobs: z.number().int(),
    activeJobs: z.number().int(),
    employerId: uuid,
    createdAt: isoDate,
    updatedAt: isoDate,
    employer: z
      .object({
        id: uuid,
        name: z.string(),
        email: z.email(),
        avatar: z.string().nullable().optional(),
      })
      .optional()
      .meta({
        description:
          "Only available in the detail/list endpoint that includes an employer join.",
      }),
  })
  .meta({ id: "Company" });

export const job = z
  .object({
    id: uuid,
    title: z.string(),
    description: z.string().meta({ description: "HTML" }),
    requirement: z.string().meta({ description: "HTML" }),
    location: z.string(),
    category: z.string(),
    type: jobType,
    level: jobLevel.nullable(),
    salaryMin: decimalString.nullable(),
    salaryMax: decimalString.nullable(),
    skills: z
      .array(z.string())
      .nullable()
      .meta({ description: "Always lowercase" }),
    isClosed: z.boolean(),
    companyId: uuid,
    company: companySummary.optional(),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .meta({ id: "Job" });

/** Job trả về ở list/detail có thêm trạng thái theo người xem. */
export const jobWithExtras = job
  .extend({
    isSaved: z.boolean().meta({ description: "false if not logged in" }),
    applicationStatus: z.string().nullable().meta({
      description: "Application status of the viewer, null if not applied",
    }),
  })
  .meta({ id: "JobWithExtras" });

export const savedJob = z
  .object({
    id: uuid,
    jobId: uuid,
    jobseekerId: uuid,
    createdAt: isoDate,
    updatedAt: isoDate,
    job: z
      .object({
        id: uuid,
        title: z.string(),
        location: z.string(),
        type: jobType,
        companyId: uuid,
        isClosed: z.boolean(),
        company: companySummary.optional(),
      })
      .optional(),
  })
  .meta({ id: "SavedJob" });
