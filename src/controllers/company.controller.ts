import { Response } from "express";
import { companyService } from "../services/company.service";
import { uploadService } from "../services/upload.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_STATUS, HTTP_MESSAGE } from "../constants/httpStatus";
import { ForbiddenError, BadRequestError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { buildPaginationMeta } from "../utils/pagination.util";
import {
  GetAllCompaniesQuery,
  CreateCompanyBody,
  UpdateCompanyParams,
  UpdateCompanyBody,
  GetCompanyByIdParams,
  GetCompanyJobsParams,
  GetCompanyJobsQuery,
} from "../validators/company.validator";
import { ValidatedRequest } from "../types/express";

export const createCompany = asyncHandler<
  ValidatedRequest<
    Record<string, never>,
    Record<string, never>,
    CreateCompanyBody
  >
>(async (req, res: Response): Promise<void> => {
  if (req.user!.role !== UserRole.EMPLOYER) {
    throw new ForbiddenError("Only employers can create companies");
  }
  const company = await companyService.createCompany(req.user!.id, req.body);
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: HTTP_MESSAGE.CREATED,
    data: company,
  });
});

export const getAllCompanies = asyncHandler<
  ValidatedRequest<Record<string, never>, GetAllCompaniesQuery>
>(async (req, res: Response): Promise<void> => {
  const { keyword, industry, size, page, limit, sortBy, order } =
    req.validatedQuery;

  const result = await companyService.getAllCompanies(
    { keyword, industry, size },
    { page, limit, sortBy, order }
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: result.items,
    pagination: buildPaginationMeta(result),
  });
});

export const getCompanyById = asyncHandler<
  ValidatedRequest<GetCompanyByIdParams>
>(async (req, res: Response): Promise<void> => {
  const company = await companyService.getCompanyById(req.validatedParams.id);
  res.status(HTTP_STATUS.OK).json({ success: true, data: company });
});

export const getMyCompany = asyncHandler(
  async (req, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can access this resource");
    }
    const company = await companyService.getCompanyByEmployerId(req.user!.id);
    res.status(HTTP_STATUS.OK).json({ success: true, data: company });
  }
);

export const getCompanyJobs = asyncHandler<
  ValidatedRequest<GetCompanyJobsParams, GetCompanyJobsQuery>
>(async (req, res: Response): Promise<void> => {
  const result = await companyService.getCompanyJobs(
    req.validatedParams.id,
    req.validatedQuery
  );

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: result.items,
    pagination: buildPaginationMeta(result),
  });
});

export const updateCompany = asyncHandler<
  ValidatedRequest<
    UpdateCompanyParams,
    Record<string, never>,
    UpdateCompanyBody
  >
>(async (req, res: Response): Promise<void> => {
  const company = await companyService.updateCompany(
    req.validatedParams.id,
    req.user!.id,
    req.body
  );
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: HTTP_MESSAGE.UPDATED,
    data: company,
  });
});

export const deleteCompany = asyncHandler<
  ValidatedRequest<GetCompanyByIdParams>
>(async (req, res: Response): Promise<void> => {
  await companyService.deleteCompany(req.validatedParams.id, req.user!.id);
  res
    .status(HTTP_STATUS.OK)
    .json({ success: true, message: HTTP_MESSAGE.DELETED });
});

/**
 * Upload company logo
 */
export const uploadCompanyLogo = asyncHandler(
  async (req, res: Response): Promise<void> => {
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
      data: { logoUrl: result.url, publicId: result.publicId },
    });
  }
);
