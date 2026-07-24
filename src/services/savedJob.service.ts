import { SavedJob } from "../entities/SavedJob.entity";
import { ConflictError, NotFoundError } from "../utils/errors";
import {
  PaginationOptions,
  buildPaginatedResult,
} from "../utils/pagination.util";
import {
  savedJobRepository,
  SavedJobRepository,
} from "../repositories/savedJob.repository";
import { jobRepository, JobRepository } from "../repositories/job.repository";

export class SavedJobService {
  constructor(
    private readonly savedJobRepo: SavedJobRepository = savedJobRepository,
    private readonly jobRepo: JobRepository = jobRepository
  ) {}

  async saveJob(jobId: string, jobseekerId: string): Promise<SavedJob> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) throw new NotFoundError("Job not found");

    const exists = await this.savedJobRepo.findOneWithDeleted(
      jobId,
      jobseekerId
    );

    if (exists) {
      if (!exists.deletedAt) throw new ConflictError("Job already saved");
      return this.restoreSavedJob(exists.id);
    }

    const savedJob = this.savedJobRepo.create({ jobId, jobseekerId });
    return this.savedJobRepo.save(savedJob);
  }

  private async restoreSavedJob(id: string): Promise<SavedJob> {
    await this.savedJobRepo.restore(id);
    const restored = await this.savedJobRepo.findById(id);
    if (!restored) throw new NotFoundError("Failed to restore saved job");
    return restored;
  }

  async unsaveJob(jobId: string, jobseekerId: string): Promise<void> {
    await this.savedJobRepo.softDelete(jobId, jobseekerId);
  }

  async getMySavedJobs(jobseekerId: string, pagination: PaginationOptions) {
    const [savedJobs, total] = await this.savedJobRepo.findAndCountByJobseeker(
      jobseekerId,
      pagination
    );

    return buildPaginatedResult(
      savedJobs,
      total,
      pagination.page,
      pagination.limit
    );
  }
}

export const savedJobService = new SavedJobService();
