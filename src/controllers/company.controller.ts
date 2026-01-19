import { Request, Response } from "express";
import { companyService } from "../services/company.service";
import { uploadService } from "../services/upload.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { ForbiddenError, BadRequestError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";

interface CompanyFilterQuery {
  keyword?: string;
  industry?: string;
  size?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  order?: string;
}

export const createCompany = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can create companies");
    }

    const company = await companyService.createCompany(req.user!.id, req.body);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: HTTP_MESSAGE.CREATED,
      data: company,
    });
  }
);

export const getAllCompanies = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      keyword,
      industry,
      size,
      page = "1",
      limit = "12",
      sortBy = "createdAt",
      order = "desc",
    } = req.query as CompanyFilterQuery;

    const filters = {
      keyword,
      industry,
      size,
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      order: order.toUpperCase() as "ASC" | "DESC",
    };

    const result = await companyService.getAllCompanies(filters, pagination);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.companies,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalCompanies: result.total,
        limit: pagination.limit,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      },
    });
  }
);

export const getCompanyById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const company = await companyService.getCompanyById(req.params.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: company,
    });
  }
);

export const getMyCompany = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can access this resource");
    }

    const company = await companyService.getCompanyByEmployerId(req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: company,
    });
  }
);

export const getCompanyJobs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      page = "1",
      limit = "12",
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as string,
      order: (order as string).toUpperCase() as "ASC" | "DESC",
    };

    const result = await companyService.getCompanyJobs(
      req.params.id,
      pagination
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.jobs,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalJobs: result.total,
        limit: pagination.limit,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      },
    });
  }
);

export const updateCompany = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const company = await companyService.updateCompany(
      req.params.id,
      req.user!.id,
      req.body
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.UPDATED,
      data: company,
    });
  }
);

export const deleteCompany = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await companyService.deleteCompany(req.params.id, req.user!.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: HTTP_MESSAGE.DELETED,
    });
  }
);

/**
 * Upload company logo
 */
export const uploadCompanyLogo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can upload company logos");
    }

    if (!req.file) {
      throw new BadRequestError("No file uploaded");
    }

    const result = await uploadService.uploadCompanyLogo(
      req.file.buffer,
      req.file.mimetype
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: "Company logo uploaded successfully",
      data: {
        logoUrl: result.url,
        publicId: result.publicId,
      },
    });
  }
);
