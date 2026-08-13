import { AppDataSource } from "../config/database.config";
import { Company } from "../entities/Company.entity";
import { FindOptionsWhere, Like } from "typeorm";
import { PaginationOptions, getSkip } from "../utils/pagination.util";
import { CompanyDetail, CompanySummary } from "../types/company.types";

export interface CompanyFilters {
  keyword?: string;
  industry?: string;
  size?: string;
}

const EMPLOYER_SUMMARY_SELECT = { id: true, name: true, email: true } as const;
const EMPLOYER_DETAIL_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

type CompanyWritableFields = Omit<Company, "employer" | "jobs">;
function buildCompanyWhere(filters: CompanyFilters): FindOptionsWhere<Company> {
  const where: FindOptionsWhere<Company> = {};
  if (filters.keyword) where.name = Like(`%${filters.keyword}%`);
  if (filters.industry) where.industry = filters.industry;
  if (filters.size) where.size = filters.size;
  return where;
}

export class CompanyRepository {
  private repo = AppDataSource.getRepository(Company);

  // ---- write ops ----

  create(data: Partial<CompanyWritableFields>): Company {
    return this.repo.create(data);
  }

  async save(company: Company): Promise<Company> {
    return this.repo.save(company);
  }

  async restore(id: string): Promise<void> {
    await this.repo.restore(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async update(
    id: string,
    data: Partial<CompanyWritableFields>
  ): Promise<void> {
    await this.repo.update(id, data);
  }

  // ---- single-record reads ----

  async findById(id: string): Promise<Company | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdWithEmployer(id: string): Promise<CompanyDetail | null> {
    return this.repo.findOne({
      where: { id },
      relations: ["employer"],
      select: { employer: EMPLOYER_DETAIL_SELECT },
    }) as Promise<CompanyDetail | null>;
  }

  async findByEmployerId(employerId: string): Promise<Company | null> {
    return this.repo.findOne({ where: { employerId } });
  }

  async findByEmployerIdWithDeleted(
    employerId: string
  ): Promise<Company | null> {
    return this.repo.findOne({ where: { employerId }, withDeleted: true });
  }

  // ---- list reads ----

  async findAndCount(
    filters: CompanyFilters,
    { page, limit, sortBy, order }: PaginationOptions
  ): Promise<[CompanySummary[], number]> {
    const [item, total] = await this.repo.findAndCount({
      where: buildCompanyWhere(filters),
      relations: ["employer"],
      select: { employer: EMPLOYER_SUMMARY_SELECT },
      order: { [sortBy]: order },
      skip: getSkip(page, limit),
      take: limit,
    });
    return [item as CompanySummary[], total];
  }
}

export const companyRepository = new CompanyRepository();
