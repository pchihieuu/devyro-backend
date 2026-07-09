import { AppDataSource } from "../config/database.config";
import { Job } from "../entities/Job.entity";
import { SavedJob } from "../entities/SavedJob.entity";
import { ConflictError, NotFoundError } from "../utils/errors";
import {
  getSkip,
  buildPaginatedResult,
  PaginationOptions,
} from "../utils/pagination.util";

export class SavedJobService {
  private savedJobRepository = AppDataSource.getRepository(SavedJob);
  private jobRepository = AppDataSource.getRepository(Job);

  async saveJob(jobId: string, jobseekerId: string): Promise<SavedJob> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundError("Job not found");

    const exists = await this.savedJobRepository.findOne({
      where: { jobId, jobseekerId },
      withDeleted: true,
    });

    if (exists) {
      if (!exists.deletedAt) throw new ConflictError("Job already saved");
      return this.restoreSavedJob(exists.id);
    }

    const savedJob = this.savedJobRepository.create({ jobId, jobseekerId });
    return this.savedJobRepository.save(savedJob);
  }

  private async restoreSavedJob(id: string): Promise<SavedJob> {
    await this.savedJobRepository.restore(id);
    const restored = await this.savedJobRepository.findOne({ where: { id } });
    if (!restored) throw new NotFoundError("Failed to restore saved job");
    return restored;
  }

  async unsaveJob(jobId: string, jobseekerId: string): Promise<void> {
    await this.savedJobRepository.softDelete({ jobId, jobseekerId });
  }

  async getMySavedJobs(jobseekerId: string, pagination: PaginationOptions) {
    const { page, limit, sortBy, order } = pagination;

    const [savedJobs, total] = await this.savedJobRepository.findAndCount({
      where: { jobseekerId },
      relations: ["job", "job.company"],
      select: {
        job: {
          id: true,
          title: true,
          description: true,
          requirement: true,
          location: true,
          category: true,
          type: true,
          salaryMin: true,
          salaryMax: true,
          isClosed: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      order: { [sortBy]: order },
      skip: getSkip(page, limit),
      take: limit,
    });

    return buildPaginatedResult(savedJobs, total, page, limit);
  }
}

export const savedJobService = new SavedJobService();
