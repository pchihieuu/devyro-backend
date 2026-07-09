import { AppDataSource } from "../config/database.config";
import { Job, JobType, JobLevel } from "../entities/Job.entity";
import { In, LessThanOrEqual, MoreThanOrEqual, ILike } from "typeorm";
import { PaginationOptions } from "../utils/pagination.util";

export interface JobFilters {
  keyword?: string;
  location?: string;
  category?: string | string[];
  type?: string | string[];
  level?: string;
  minSalary?: string;
  maxSalary?: string;
  skills?: string | string[];
}

const COMPANY_SUMMARY_SELECT = {
  id: true, name: true, logo: true, industry: true, size: true,
} as const;

export class JobRepository {
  private repo = AppDataSource.getRepository(Job);

  async search(filters: JobFilters, pagination: PaginationOptions): Promise<[Job[], number]> {
    const skillList = this.normalizeSkills(filters.skills);
    return skillList.length > 0
      ? this.searchWithSkills(filters, skillList, pagination)
      : this.searchSimple(filters, pagination);
  }

  private normalizeSkills(skills?: string | string[]): string[] {
    if (!skills) return [];
    return (Array.isArray(skills) ? skills : [skills]).filter(Boolean);
  }

  private normalizeList(value?: string | string[]): string[] | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  }

  private async searchSimple(filters: JobFilters, pagination: PaginationOptions): Promise<[Job[], number]> {
    const { page, limit, sortBy, order } = pagination;
    const where: any = { isClosed: false };

    if (filters.keyword) where.title = ILike(`%${filters.keyword}%`);
    if (filters.location) where.location = ILike(`%${filters.location}%`);

    const categories = this.normalizeList(filters.category);
    if (categories) where.category = In(categories);

    const types = this.normalizeList(filters.type);
    if (types) where.type = In(types as JobType[]);

    if (filters.level) where.level = filters.level as JobLevel;

    if (filters.minSalary && filters.maxSalary) {
      where.salaryMax = MoreThanOrEqual(Number(filters.minSalary));
      where.salaryMin = LessThanOrEqual(Number(filters.maxSalary));
    } else if (filters.minSalary) {
      where.salaryMax = MoreThanOrEqual(Number(filters.minSalary));
    } else if (filters.maxSalary) {
      where.salaryMin = LessThanOrEqual(Number(filters.maxSalary));
    }

    return this.repo.findAndCount({
      where,
      relations: ["company", "company.employer"],
      select: { company: COMPANY_SUMMARY_SELECT },
      order: { [sortBy]: order },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  private async searchWithSkills(
    filters: JobFilters,
    skillList: string[],
    pagination: PaginationOptions
  ): Promise<[Job[], number]> {
    const { page, limit, sortBy, order } = pagination;

    const qb = this.repo
      .createQueryBuilder("job")
      .leftJoinAndSelect("job.company", "company")
      .leftJoinAndSelect("company.employer", "employer")
      .select(["job", "company.id", "company.name", "company.logo", "company.industry", "company.size"])
      .where("job.isClosed = :isClosed", { isClosed: false });

    if (filters.keyword) qb.andWhere("job.title ILIKE :keyword", { keyword: `%${filters.keyword}%` });
    if (filters.location) qb.andWhere("job.location ILIKE :location", { location: `%${filters.location}%` });

    const categories = this.normalizeList(filters.category);
    if (categories) qb.andWhere("job.category IN (:...categories)", { categories });

    const types = this.normalizeList(filters.type);
    if (types) qb.andWhere("job.type IN (:...types)", { types });

    if (filters.level) qb.andWhere("job.level = :level", { level: filters.level });

    if (filters.minSalary && filters.maxSalary) {
      qb.andWhere("job.salaryMax >= :minSalary AND job.salaryMin <= :maxSalary", {
        minSalary: Number(filters.minSalary),
        maxSalary: Number(filters.maxSalary),
      });
    } else if (filters.minSalary) {
      qb.andWhere("job.salaryMax >= :minSalary", { minSalary: Number(filters.minSalary) });
    } else if (filters.maxSalary) {
      qb.andWhere("job.salaryMin <= :maxSalary", { maxSalary: Number(filters.maxSalary) });
    }

    skillList.forEach((skill, i) => {
      const key = `skill_${i}`;
      qb.andWhere(
        `(job.skills ILIKE :${key}_start OR job.skills ILIKE :${key}_middle OR job.skills ILIKE :${key}_exact)`,
        { [`${key}_start`]: `${skill},%`, [`${key}_middle`]: `%,${skill},%`, [`${key}_exact`]: skill }
      );
    });

    qb.orderBy(`job.${sortBy}`, order).skip((page - 1) * limit).take(limit);
    return qb.getManyAndCount();
  }
}

export const jobRepository = new JobRepository();