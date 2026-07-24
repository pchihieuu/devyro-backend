import { AppDataSource } from "../config/database.config";
import { SavedJob } from "../entities/SavedJob.entity";
import { PaginationOptions, getSkip } from "../utils/pagination.util";

export class SavedJobRepository {
  private repository = AppDataSource.getRepository(SavedJob);

  async findOneActive(
    jobId: string,
    jobseekerId: string
  ): Promise<SavedJob | null> {
    return this.repository.findOne({ where: { jobId, jobseekerId } });
  }

  async findOneWithDeleted(
    jobId: string,
    jobseekerId: string
  ): Promise<SavedJob | null> {
    return this.repository.findOne({
      where: { jobId, jobseekerId },
      withDeleted: true,
    });
  }

  async findById(id: string): Promise<SavedJob | null> {
    return this.repository.findOne({ where: { id } });
  }

  create(data: Partial<SavedJob>): SavedJob {
    return this.repository.create(data);
  }

  async save(savedJob: SavedJob): Promise<SavedJob> {
    return this.repository.save(savedJob);
  }

  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  async softDelete(jobId: string, jobseekerId: string): Promise<void> {
    await this.repository.softDelete({ jobId, jobseekerId });
  }
  
  async findJobIdsByJobseeker(jobseekerId: string): Promise<string[]> {
    const savedJobs = await this.repository.find({
      where: { jobseekerId },
      select: ["jobId"],
    });
    return savedJobs.map((s) => s.jobId);
  }

  async findAndCountByJobseeker(
    jobseekerId: string,
    { page, limit, sortBy, order }: PaginationOptions
  ): Promise<[SavedJob[], number]> {
    return this.repository.findAndCount({
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
  }
}

export const savedJobRepository = new SavedJobRepository();