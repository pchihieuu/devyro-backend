import { AppDataSource } from "../config/database.config";
import { SavedJob } from "../entities/SavedJob.entity";
import { FindOptionsOrder } from "typeorm";
import { PaginationOptions, getSkip } from "../utils/pagination.util";
import { CreateSavedJobData } from "../types/savedJob.types";

const JOB_SUMMARY_SELECT = {
  id: true,
  title: true,
  location: true,
  type: true,
  companyId: true,
  isClosed: true,
} as const;

export class SavedJobRepository {
  private repo = AppDataSource.getRepository(SavedJob);

  // ---- write ops ----

  create(data: CreateSavedJobData): SavedJob {
    return this.repo.create(data);
  }

  async save(savedJob: SavedJob): Promise<SavedJob> {
    return this.repo.save(savedJob);
  }

  async restore(id: string): Promise<void> {
    await this.repo.restore(id);
  }

  async softDelete(jobId: string, jobseekerId: string): Promise<void> {
    await this.repo.softDelete({ jobId, jobseekerId });
  }

  // ---- single-record reads ----

  async findById(id: string): Promise<SavedJob | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Tìm theo jobId + jobseekerId, KỂ CẢ bản ghi đã soft-delete — dùng để phát hiện
   * case "save lại sau khi đã unsave" (deletedAt != null) để restore thay vì tạo
   * bản ghi trùng (vi phạm unique constraint jobId+jobseekerId nếu có).
   */
  async findOneWithDeleted(
    jobId: string,
    jobseekerId: string
  ): Promise<SavedJob | null> {
    return this.repo.findOne({
      where: { jobId, jobseekerId },
      withDeleted: true,
    });
  }

  /**
   * Tìm bản ghi ĐANG active (chưa soft-delete) theo jobId + jobseekerId — dùng bởi
   * job.service để đánh dấu isSaved khi trả job detail/list cho jobseeker.
   * Khác findOneWithDeleted ở chỗ mặc định TypeORM đã tự loại soft-delete rồi,
   * không cần withDeleted: true.
   */
  async findOneActive(
    jobId: string,
    jobseekerId: string
  ): Promise<SavedJob | null> {
    return this.repo.findOne({ where: { jobId, jobseekerId } });
  }

  /**
   * Danh sách jobId đã save của 1 jobseeker — dùng bởi job.service để đánh dấu
   * isSaved hàng loạt khi trả về job list (tránh N+1 query findOneActive từng job).
   */
  async findJobIdsByJobseeker(jobseekerId: string): Promise<string[]> {
    const savedJobs = await this.repo.find({
      where: { jobseekerId },
      select: ["jobId"],
    });
    return savedJobs.map((sj) => sj.jobId);
  }

  // ---- list reads ----

  /**
   * sortBy có thể là "title" — nhưng `title` là cột của Job, không phải SavedJob.
   * Không thể build order = { [sortBy]: order } phẳng như các module khác (sẽ lỗi
   * "column savedJob.title does not exist"), phải map sang order lồng qua relation
   * `job.title` khi sortBy === "title".
   */
  async findAndCountByJobseeker(
    jobseekerId: string,
    { page, limit, sortBy, order }: PaginationOptions
  ): Promise<[SavedJob[], number]> {
    const orderClause: FindOptionsOrder<SavedJob> =
      sortBy === "title"
        ? { job: { title: order } }
        : ({ [sortBy]: order } as FindOptionsOrder<SavedJob>);

    return this.repo.findAndCount({
      where: { jobseekerId },
      relations: ["job", "job.company"],
      select: { job: JOB_SUMMARY_SELECT },
      order: orderClause,
      skip: getSkip(page, limit),
      take: limit,
    });
  }
}

export const savedJobRepository = new SavedJobRepository();