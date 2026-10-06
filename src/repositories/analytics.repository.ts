import { AppDataSource } from "../config/database.config";
import { Application, ApplicationStatus } from "../entities/Application.entity";
import { Job } from "../entities/Job.entity";
import {
  ApplicationCounts,
  JobCounts,
  RecentApplication,
  RecentJob,
} from "../types/analytics.types";

/**
 * Truy vấn thống kê cho dashboard nhà tuyển dụng.
 *
 * Gộp mọi phép đếm thành 1 câu SELECT dùng `COUNT(*) FILTER (WHERE ...)` trên
 * mỗi bảng (bản cũ: 9 câu count/find riêng + 1 câu lấy danh sách jobId rồi
 * `IN (...jobIds)` — danh sách này lớn dần theo số job của công ty). Job/
 * Application đều soft-delete nên QueryBuilder tự thêm `deletedAt IS NULL`
 * (kể cả ở bảng được join), giữ đúng semantics của `repo.count()` trước đây.
 *
 * Cửa sổ thời gian dùng nửa khoảng [from, to): bản cũ dùng `Between` (đóng 2
 * đầu) nên bản ghi đúng mốc `last7Days` bị tính vào cả 2 cửa sổ.
 */
export class AnalyticsRepository {
  private jobRepo = AppDataSource.getRepository(Job);
  private applicationRepo = AppDataSource.getRepository(Application);

  async getJobCounts(
    companyId: string,
    last7: Date,
    prev7: Date
  ): Promise<JobCounts> {
    const row = await this.jobRepo
      .createQueryBuilder("job")
      .select("COUNT(*) FILTER (WHERE job.isClosed = false)", "active")
      .addSelect("COUNT(*) FILTER (WHERE job.createdAt >= :last7)", "last7")
      .addSelect(
        "COUNT(*) FILTER (WHERE job.createdAt >= :prev7 AND job.createdAt < :last7)",
        "prev7"
      )
      .where("job.companyId = :companyId", { companyId })
      .setParameters({ last7, prev7 })
      .getRawOne<{ active: string; last7: string; prev7: string }>();

    return {
      active: Number(row?.active ?? 0),
      created: {
        last7: Number(row?.last7 ?? 0),
        prev7: Number(row?.prev7 ?? 0),
      },
    };
  }

  async getApplicationCounts(
    companyId: string,
    last7: Date,
    prev7: Date
  ): Promise<ApplicationCounts> {
    const row = await this.applicationRepo
      .createQueryBuilder("app")
      .innerJoin("app.job", "job")
      .select("COUNT(*)", "total")
      .addSelect("COUNT(*) FILTER (WHERE app.status = :accepted)", "hired")
      .addSelect("COUNT(*) FILTER (WHERE app.createdAt >= :last7)", "last7")
      .addSelect(
        "COUNT(*) FILTER (WHERE app.createdAt >= :prev7 AND app.createdAt < :last7)",
        "prev7"
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE app.status = :accepted AND app.createdAt >= :last7)",
        "hiredLast7"
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE app.status = :accepted AND app.createdAt >= :prev7 AND app.createdAt < :last7)",
        "hiredPrev7"
      )
      .where("job.companyId = :companyId", { companyId })
      .setParameters({ last7, prev7, accepted: ApplicationStatus.ACCEPTED })
      .getRawOne<
        Record<
          "total" | "hired" | "last7" | "prev7" | "hiredLast7" | "hiredPrev7",
          string
        >
      >();

    return {
      total: Number(row?.total ?? 0),
      hired: Number(row?.hired ?? 0),
      created: {
        last7: Number(row?.last7 ?? 0),
        prev7: Number(row?.prev7 ?? 0),
      },
      hiredCreated: {
        last7: Number(row?.hiredLast7 ?? 0),
        prev7: Number(row?.hiredPrev7 ?? 0),
      },
    };
  }

  async findRecentJobs(companyId: string, take: number): Promise<RecentJob[]> {
    return this.jobRepo.find({
      where: { companyId },
      select: ["id", "title", "location", "type", "createdAt", "isClosed"],
      order: { createdAt: "DESC" },
      take,
    });
  }

  /** Chỉ select field cần cho dashboard (không kéo cả row applicant). */
  async findRecentApplications(
    companyId: string,
    take: number
  ): Promise<RecentApplication[]> {
    return this.applicationRepo
      .createQueryBuilder("app")
      .innerJoin("app.job", "job")
      .leftJoin("app.applicant", "applicant")
      .select([
        "app.id",
        "app.status",
        "app.updatedAt",
        "app.createdAt",
        "job.id",
        "job.title",
        "applicant.id",
        "applicant.name",
        "applicant.email",
        "applicant.avatar",
      ])
      .where("job.companyId = :companyId", { companyId })
      .orderBy("app.createdAt", "DESC")
      .take(take)
      .getMany() as Promise<RecentApplication[]>;
  }
}

export const analyticsRepository = new AnalyticsRepository();
