import { SavedJob } from "../entities/SavedJob.entity";

export type CreateSavedJobData = Pick<SavedJob, "jobId" | "jobseekerId">;
