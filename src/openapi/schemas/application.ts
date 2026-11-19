import { z } from "zod";
import { isoDate, uuid } from "./common";
import { jobType } from "./job";

export const applicationStatus = z
  .enum([
    "Applied",
    "In Review",
    "Rejected",
    "Accepted",
    "Withdrawn",
    "Interview",
  ])
  .meta({ id: "ApplicationStatus" });

export const aiMatchingAnalysis = z
  .object({
    score: z.number(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    recommendations: z.array(z.string()),
    skillsMatch: z.record(z.string(), z.unknown()),
    experienceMatch: z.record(z.string(), z.unknown()),
    educationMatch: z.record(z.string(), z.unknown()),
    overallAssessment: z.string(),
  })
  .meta({ id: "AIMatchingAnalysis" });

const applicant = z.object({
  id: uuid,
  name: z.string(),
  email: z.email(),
  avatar: z.string().nullable(),
  resume: z.string().nullable(),
});

const jobBrief = z.object({
  id: uuid,
  title: z.string(),
  location: z.string().optional(),
  category: z.string().optional(),
  type: jobType.optional(),
  companyId: uuid.optional(),
  isClosed: z.boolean().optional(),
  salaryMin: z.string().nullable().optional(),
  salaryMax: z.string().nullable().optional(),
  company: z.record(z.string(), z.unknown()).optional(),
});

export const application = z
  .object({
    id: uuid,
    resume: z.string().nullable(),
    status: applicationStatus,
    aiMatchingScore: z.number().nullable(),
    aiMatchingAnalysis: aiMatchingAnalysis.nullable(),
    aiAnalyzedAt: isoDate.nullable(),
    jobId: uuid,
    applicantId: uuid,
    createdAt: isoDate,
    updatedAt: isoDate,
    job: jobBrief
      .optional()
      .meta({ description: "Only available in the detail/list endpoint" }),
    applicant: applicant
      .optional()
      .meta({ description: "Only available in the endpoint for employers" }),
  })
  .meta({ id: "Application" });
