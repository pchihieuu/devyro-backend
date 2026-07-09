import { AppDataSource } from "../config/database.config";
import { Company } from "../entities/Company.entity";
import { Job } from "../entities/Job.entity";
import { User, UserRole } from "../entities/User.entity";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import { Like } from "typeorm";
import { getSkip, buildPaginatedResult, PaginationOptions } from "../utils/pagination.util";
import { ensureRole, ensureOwnership } from "../utils/authorization.util";

interface CompanyFilters {
  keyword?: string;
  industry?: string;
  size?: string;
}

function buildCompanyWhere(filters: CompanyFilters) {
  const where: any = {};
  if (filters.keyword) where.name = Like(`%${filters.keyword}%`);
  if (filters.industry) where.industry = filters.industry;
  if (filters.size) where.size = filters.size;
  return where;
}

export class CompanyService {
  private companyRepository = AppDataSource.getRepository(Company);
  private jobRepository = AppDataSource.getRepository(Job);
  private userRepository = AppDataSource.getRepository(User);

  async createCompany(employerId: string, companyData: Partial<Company>): Promise<Company> {
    const user = await this.userRepository.findOne({ where: { id: employerId } });
    if (!user) throw new NotFoundError("User not found");
    ensureRole(user.role, UserRole.EMPLOYER, "Only employers can create companies");

    const existingCompany = await this.companyRepository.findOne({
      where: { employerId },
      withDeleted: true,
    });

    if (existingCompany) {
      if (!existingCompany.deletedAt) {
        throw new ForbiddenError("Company already exists for this employer");
      }
      return this.restoreCompany(existingCompany.id, companyData);
    }

    const company = this.companyRepository.create({ ...companyData, employerId });
    return this.companyRepository.save(company);
  }

  private async restoreCompany(companyId: string, companyData: Partial<Company>): Promise<Company> {
    await this.companyRepository.restore(companyId);
    const restored = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!restored) throw new NotFoundError("Failed to restore company");
    Object.assign(restored, companyData);
    return this.companyRepository.save(restored);
  }

  async getAllCompanies(filters: CompanyFilters, pagination: PaginationOptions) {
    const { page, limit, sortBy, order } = pagination;
    const [companies, total] = await this.companyRepository.findAndCount({
      where: buildCompanyWhere(filters),
      relations: ["employer"],
      select: { employer: { id: true, name: true, email: true } },
      order: { [sortBy]: order },
      skip: getSkip(page, limit),
      take: limit,
    });
    return buildPaginatedResult(companies, total, page, limit);
  }

  async getCompanyById(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
      relations: ["employer"],
      select: { employer: { id: true, name: true, email: true, avatar: true } },
    });
    if (!company) throw new NotFoundError("Company not found");
    return company;
  }

  async getCompanyByEmployerId(employerId: string): Promise<Company | null> {
    return this.companyRepository.findOne({ where: { employerId } });
  }

  async getCompanyJobs(companyId: string, pagination: PaginationOptions) {
    const { page, limit, sortBy, order } = pagination;

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundError("Company not found");

    const [jobs, total] = await this.jobRepository.findAndCount({
      where: { companyId, isClosed: false },
      relations: ["company"],
      order: { [sortBy]: order },
      skip: getSkip(page, limit),
      take: limit,
    });
    return buildPaginatedResult(jobs, total, page, limit);
  }

  async updateCompany(companyId: string, employerId: string, updates: Partial<Company>): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundError("Company not found");
    ensureOwnership(company.employerId, employerId, "Not authorized to update this company");
    Object.assign(company, updates);
    return this.companyRepository.save(company);
  }

  async deleteCompany(companyId: string, employerId: string): Promise<void> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundError("Company not found");
    ensureOwnership(company.employerId, employerId, "Not authorized to delete this company");
    await this.companyRepository.softDelete(companyId);
  }

  async updateCompanyStats(companyId: string): Promise<void> {
    const [totalJobs, activeJobs] = await Promise.all([
      this.jobRepository.count({ where: { companyId } }),
      this.jobRepository.count({ where: { companyId, isClosed: false } }),
    ]);
    await this.companyRepository.update(companyId, { totalJobs, activeJobs });
  }
}

export const companyService = new CompanyService();