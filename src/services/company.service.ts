import { AppDataSource } from "../config/database.config";
import { Company } from "../entities/Company.entity";
import { Job } from "../entities/Job.entity";
import { User, UserRole } from "../entities/User.entity";
import { NotFoundError, ForbiddenError } from "../utils/errors";
import { Like } from "typeorm";

interface CompanyFilters {
  keyword?: string;
  industry?: string;
  size?: string;
}

interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  order: "ASC" | "DESC";
}

export class CompanyService {
  private companyRepository = AppDataSource.getRepository(Company);
  private jobRepository = AppDataSource.getRepository(Job);
  private userRepository = AppDataSource.getRepository(User);

  async createCompany(
    employerId: string,
    companyData: Partial<Company>
  ): Promise<Company> {
    const user = await this.userRepository.findOne({
      where: { id: employerId },
    });

    if (!user || user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can create companies");
    }

    const existingCompany = await this.companyRepository.findOne({
      where: { employerId },
      withDeleted: true, 
    });

    if (existingCompany) {
      if (existingCompany.deletedAt) {
        await this.companyRepository.restore(existingCompany.id);

        const restoredCompany = await this.companyRepository.findOne({
          where: { id: existingCompany.id },
        });

        if (!restoredCompany) {
          throw new NotFoundError("Failed to restore company");
        }

        Object.assign(restoredCompany, companyData);

        return await this.companyRepository.save(restoredCompany);
      } else {
        throw new ForbiddenError("Company already exists for this employer");
      }
    }

    const company = this.companyRepository.create({
      ...companyData,
      employerId,
    });

    return await this.companyRepository.save(company);
  }

  async getAllCompanies(
    filters: CompanyFilters,
    pagination: PaginationOptions
  ): Promise<{
    companies: Company[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page, limit, sortBy, order } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.keyword) {
      where.name = Like(`%${filters.keyword}%`);
    }

    if (filters.industry) {
      where.industry = filters.industry;
    }

    if (filters.size) {
      where.size = filters.size;
    }

    const [companies, total] = await this.companyRepository.findAndCount({
      where,
      relations: ["employer"],
      select: {
        employer: {
          id: true,
          name: true,
          email: true,
        },
      },
      order: { [sortBy]: order },
      skip,
      take: limit,
    });

    return {
      companies,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCompanyById(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
      relations: ["employer"],
      select: {
        employer: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    });

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    return company;
  }

  async getCompanyByEmployerId(employerId: string): Promise<Company | null> {
    const company = await this.companyRepository.findOne({
      where: { employerId },
    });

    return company;
  }

  async getCompanyJobs(
    companyId: string,
    pagination: PaginationOptions
  ): Promise<{
    jobs: Job[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page, limit, sortBy, order } = pagination;
    const skip = (page - 1) * limit;

    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    const [jobs, total] = await this.jobRepository.findAndCount({
      where: {
        companyId: companyId,
        isClosed: false,
      },
      relations: ["company"],
      order: { [sortBy]: order },
      skip,
      take: limit,
    });

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateCompany(
    companyId: string,
    employerId: string,
    updates: Partial<Company>
  ): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    if (company.employerId !== employerId) {
      throw new ForbiddenError("Not authorized to update this company");
    }

    Object.assign(company, updates);
    return await this.companyRepository.save(company);
  }

  async deleteCompany(companyId: string, employerId: string): Promise<void> {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundError("Company not found");
    }

    if (company.employerId !== employerId) {
      throw new ForbiddenError("Not authorized to delete this company");
    }

    await this.companyRepository.softDelete(companyId);
  }

  async updateCompanyStats(companyId: string): Promise<void> {
    const totalJobs = await this.jobRepository.count({
      where: { companyId },
    });

    const activeJobs = await this.jobRepository.count({
      where: { companyId, isClosed: false },
    });

    await this.companyRepository.update(companyId, {
      totalJobs,
      activeJobs,
    });
  }
}

export const companyService = new CompanyService();
