import { Company } from "../entities/Company.entity";
import { UserRole } from "../entities/User.entity";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import {
  buildPaginatedResult,
  PaginationOptions,
} from "../utils/pagination.util";
import { ensureRole, ensureOwnership } from "../utils/authorization.util";
import {
  companyRepository,
  CompanyRepository,
  CompanyFilters,
} from "../repositories/company.repository";
import { jobRepository, JobRepository } from "../repositories/job.repository";
import {
  userRepository,
  UserRepository,
} from "../repositories/user.repository";
import { CompanyDetail } from "../types/company.types";
import {
  CreateCompanyBody,
  UpdateCompanyBody,
} from "../validators/company.validator";

export class CompanyService {
  constructor(
    private readonly companyRepo: CompanyRepository = companyRepository,
    private readonly jobRepo: JobRepository = jobRepository,
    private readonly userRepo: UserRepository = userRepository
  ) {}

  async createCompany(
    employerId: string,
    companyData: CreateCompanyBody
  ): Promise<Company> {
    const user = await this.userRepo.findById(employerId);
    if (!user) throw new NotFoundError("User not found");
    ensureRole(
      user.role,
      UserRole.EMPLOYER,
      "Only employers can create companies"
    );

    const existingCompany =
      await this.companyRepo.findByEmployerIdWithDeleted(employerId);

    if (existingCompany) {
      if (!existingCompany.deletedAt) {
        throw new ForbiddenError("Company already exists for this employer");
      }
      return this.restoreCompany(existingCompany.id, companyData);
    }

    const company = this.companyRepo.create({ ...companyData, employerId });
    return this.companyRepo.save(company);
  }

  private async restoreCompany(
    companyId: string,
    companyData: CreateCompanyBody
  ): Promise<Company> {
    await this.companyRepo.restore(companyId);
    const restored = await this.companyRepo.findById(companyId);
    if (!restored) throw new NotFoundError("Failed to restore company");
    Object.assign(restored, companyData);
    return this.companyRepo.save(restored);
  }

  async getAllCompanies(
    filters: CompanyFilters,
    pagination: PaginationOptions
  ) {
    const [companies, total] = await this.companyRepo.findAndCount(
      filters,
      pagination
    );
    return buildPaginatedResult(
      companies,
      total,
      pagination.page,
      pagination.limit
    );
  }

  async getCompanyById(companyId: string): Promise<CompanyDetail> {
    const company = await this.companyRepo.findByIdWithEmployer(companyId);
    if (!company) throw new NotFoundError("Company not found");
    return company;
  }

  async getCompanyByEmployerId(employerId: string): Promise<Company | null> {
    return this.companyRepo.findByEmployerId(employerId);
  }

  async getCompanyJobs(companyId: string, pagination: PaginationOptions) {
    const company = await this.companyRepo.findById(companyId);
    if (!company) throw new NotFoundError("Company not found");

    const [jobs, total] = await this.jobRepo.findAndCountActiveByCompany(
      companyId,
      pagination
    );
    return buildPaginatedResult(jobs, total, pagination.page, pagination.limit);
  }

  async updateCompany(
    companyId: string,
    employerId: string,
    updates: UpdateCompanyBody
  ): Promise<Company> {
    const company = await this.companyRepo.findById(companyId);
    if (!company) throw new NotFoundError("Company not found");
    ensureOwnership(
      company.employerId,
      employerId,
      "Not authorized to update this company"
    );
    Object.assign(company, updates);
    return this.companyRepo.save(company);
  }

  async deleteCompany(companyId: string, employerId: string): Promise<void> {
    const company = await this.companyRepo.findById(companyId);
    if (!company) throw new NotFoundError("Company not found");
    ensureOwnership(
      company.employerId,
      employerId,
      "Not authorized to delete this company"
    );
    await this.companyRepo.softDelete(companyId);
  }

  async updateCompanyStats(companyId: string): Promise<void> {
    const [totalJobs, activeJobs] = await Promise.all([
      this.jobRepo.countByCompany(companyId),
      this.jobRepo.countActiveByCompany(companyId),
    ]);
    await this.companyRepo.update(companyId, { totalJobs, activeJobs });
  }
}

export const companyService = new CompanyService();
