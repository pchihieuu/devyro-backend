import { AppDataSource } from "../config/database.config";
import { Job } from "../entities/Job.entity";
import { IsNull, SelectQueryBuilder } from "typeorm";
import { PaginationOptions, getSkip } from "../utils/pagination.util";

export interface JobFilters {
  keyword?: string;
  location?: string;
  category?: string | string[];
  type?: string | string[];
  level?: string;
  minSalary?: number;
  maxSalary?: number;
  skills?: string | string[];
}

const COMPANY_SUMMARY_SELECT = {
  id: true,
  name: true,
  logo: true,
  industry: true,
  size: true,
} as const;

const COMPANY_DETAIL_SELECT = {
  id: true,
  name: true,
  logo: true,
  size: true,
  industry: true,
  address: true,
  website: true,
  description: true,
  benefits: true,
  foundedYear: true,
} as const;

export class JobRepository {
  private repo = AppDataSource.getRepository(Job);

  // ---- write ops ----

  create(data: Partial<Job>): Job {
    return this.repo.create(data);
  }

  async save(job: Job): Promise<Job> {
    return this.repo.save(job);
  }

  async softDelete(jobId: string): Promise<void> {
    await this.repo.softDelete(jobId);
  }

  // ---- single-record reads ----

  async findById(jobId: string): Promise<Job | null> {
    return this.repo.findOne({ where: { id: jobId } });
  }

  /** Dùng cho check ownership (update/delete/toggle) - chỉ cần company.employerId */
  async findByIdWithCompany(jobId: string): Promise<Job | null> {
    return this.repo.findOne({ where: { id: jobId }, relations: ["company"] });
  }

  /** Job còn active (chưa soft-delete) kèm company + employer - dùng khi apply/xem applicants */
  async findActiveByIdWithCompany(jobId: string): Promise<Job | null> {
    return this.repo.findOne({
      where: { id: jobId, deletedAt: IsNull() },
      relations: ["company", "company.employer"],
    });
  }

  /** Dùng cho public detail page (getJobById) - company detail đầy đủ */
  async findByIdWithCompanyDetail(jobId: string): Promise<Job | null> {
    return this.repo.findOne({
      where: { id: jobId },
      relations: ["company", "company.employer"],
      select: { company: COMPANY_DETAIL_SELECT },
    });
  }

  // ---- list reads ----

  async findAndCountByCompany(
    companyId: string,
    { page, limit, sortBy, order }: PaginationOptions
  ): Promise<[Job[], number]> {
    return this.repo.findAndCount({
      where: { companyId },
      relations: ["company"],
      order: { [sortBy]: order },
      skip: getSkip(page, limit),
      take: limit,
    });
  }

  /** Chỉ job đang mở - dùng ở public company profile page */
  async findAndCountActiveByCompany(
    companyId: string,
    { page, limit, sortBy, order }: PaginationOptions
  ): Promise<[Job[], number]> {
    return this.repo.findAndCount({
      where: { companyId, isClosed: false },
      relations: ["company"],
      order: { [sortBy]: order },
      skip: getSkip(page, limit),
      take: limit,
    });
  }

  // ---- aggregates (dùng cho updateCompanyStats) ----

  async countByCompany(companyId: string): Promise<number> {
    return this.repo.count({ where: { companyId } });
  }

  async countActiveByCompany(companyId: string): Promise<number> {
    return this.repo.count({ where: { companyId, isClosed: false } });
  }

  private normalizeSkills(skills?: string | string[]): string[] {
    if (!skills) return [];
    return (Array.isArray(skills) ? skills : [skills])
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private normalizeList(value?: string | string[]): string[] | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  }

  private applyFilters(qb: SelectQueryBuilder<Job>, filters: JobFilters) {
    qb.where("job.isClosed = :isClosed", { isClosed: false });

    if (filters.keyword) {
      qb.andWhere("job.title ILIKE :keyword", {
        keyword: `%${filters.keyword}%`,
      });
    }
    if (filters.location) {
      qb.andWhere("job.location ILIKE :location", {
        location: `%${filters.location}%`,
      });
    }

    const categories = this.normalizeList(filters.category);
    if (categories)
      qb.andWhere("job.category IN (:...categories)", { categories });

    const types = this.normalizeList(filters.type);
    if (types) qb.andWhere("job.type IN (:...types)", { types });

    if (filters.level)
      qb.andWhere("job.level = :level", { level: filters.level });

    if (filters.minSalary && filters.maxSalary) {
      qb.andWhere(
        "job.salaryMax >= :minSalary AND job.salaryMin <= :maxSalary",
        {
          minSalary: Number(filters.minSalary),
          maxSalary: Number(filters.maxSalary),
        }
      );
    } else if (filters.minSalary) {
      qb.andWhere("job.salaryMax >= :minSalary", {
        minSalary: Number(filters.minSalary),
      });
    } else if (filters.maxSalary) {
      qb.andWhere("job.salaryMin <= :maxSalary", {
        maxSalary: Number(filters.maxSalary),
      });
    }

    return qb;
  }

  private applySkillFilter(qb: SelectQueryBuilder<Job>, skillList: string[]) {
    // && = "overlap": job.skills có ít nhất 1 phần tử trùng với skillList
    // (giữ đúng semantics OR như logic ILIKE cũ, không phải match hết)
    qb.andWhere(
      `EXISTS (SELECT 1 FROM unnest(job.skills) AS s(skill) WHERE LOWER(skill) = ANY(:skills::text[]))`,
      { skills: skillList.map((s) => s.toLocaleLowerCase()) }
    );
    return qb;
  }

  async search(
    filters: JobFilters,
    { page, limit, sortBy, order }: PaginationOptions
  ): Promise<[Job[], number]> {
    const qb = this.repo
      .createQueryBuilder("job")
      .leftJoinAndSelect("job.company", "company")
      .leftJoinAndSelect("company.employer", "employer")
      .select([
        "job",
        "company.id",
        "company.name",
        "company.logo",
        "company.industry",
        "company.size",
      ]);

    this.applyFilters(qb, filters);

    const skillList = this.normalizeSkills(filters.skills);
    if (skillList.length > 0) this.applySkillFilter(qb, skillList);

    qb.orderBy(`job.${sortBy}`, order).skip(getSkip(page, limit)).take(limit);
    return qb.getManyAndCount();
  }
}

export const jobRepository = new JobRepository();
