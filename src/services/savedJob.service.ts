import { AppDataSource } from "../config/database.config";
import { SavedJob } from "../entities/SavedJob.entity";
import { ConflictError } from "../utils/errors";

interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  order: "ASC" | "DESC";
}
export class SavedJobService {
  private savedJobRepository = AppDataSource.getRepository(SavedJob);

  async saveJob(jobId: string, jobseekerId: string): Promise<SavedJob> {
    // Check if already saved
    const exists = await this.savedJobRepository.findOne({
      where: {
        jobId,
        jobseekerId,
      },
      withDeleted: true,
    });

    if (exists && !exists.deletedAt) {
      throw new ConflictError("Job already saved");
    }

    if (exists && exists.deletedAt) {
      await this.savedJobRepository.restore(exists.id);
      return exists;
    }
    const savedJob = this.savedJobRepository.create({
      jobId,
      jobseekerId,
    });

    return await this.savedJobRepository.save(savedJob);
  }

  async unsaveJob(jobId: string, jobseekerId: string): Promise<void> {
    await this.savedJobRepository.softDelete({
      jobId,
      jobseekerId,
    });
  }

  async getMySavedJobs(
    jobseekerId: string,
    pagination: PaginationOptions
  ): Promise<{
    savedJobs: SavedJob[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page, limit, sortBy, order } = pagination;
    const skip = (page - 1) * limit;

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
      skip,
      take: limit,
    });
    return {
      savedJobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const savedJobService = new SavedJobService();
