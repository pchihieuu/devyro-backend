import { Response } from "express";
import { companyService } from "../services/company.service";
import { uploadService } from "../services/upload.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HTTP_MESSAGE } from "../constants/httpStatus";
import { ForbiddenError, BadRequestError } from "../utils/errors";
import { UserRole } from "../entities/User.entity";
import { ApiResponse } from "../utils/api-response";
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
  ApiResponse.created(res, company, HTTP_MESSAGE.CREATED);
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

  ApiResponse.paginated(res, result);
});

export const getCompanyById = asyncHandler<
  ValidatedRequest<GetCompanyByIdParams>
>(async (req, res: Response): Promise<void> => {
  const company = await companyService.getCompanyById(req.validatedParams.id);
  ApiResponse.ok(res, company);
});

export const getMyCompany = asyncHandler(
  async (req, res: Response): Promise<void> => {
    if (req.user!.role !== UserRole.EMPLOYER) {
      throw new ForbiddenError("Only employers can access this resource");
    }
    const company = await companyService.getCompanyByEmployerId(req.user!.id);
    ApiResponse.ok(res, company);
  }
);

export const getCompanyJobs = asyncHandler<
  ValidatedRequest<GetCompanyJobsParams, GetCompanyJobsQuery>
>(async (req, res: Response): Promise<void> => {
  const result = await companyService.getCompanyJobs(
    req.validatedParams.id,
    req.validatedQuery
  );

  ApiResponse.paginated(res, result);
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
  ApiResponse.ok(res, company, HTTP_MESSAGE.UPDATED);
});

export const deleteCompany = asyncHandler<
  ValidatedRequest<GetCompanyByIdParams>
>(async (req, res: Response): Promise<void> => {
  await companyService.deleteCompany(req.validatedParams.id, req.user!.id);
  ApiResponse.message(res, HTTP_MESSAGE.DELETED);
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
    ApiResponse.created(
      res,
      { logoUrl: result.url, publicId: result.publicId },
      "Company logo uploaded successfully"
    );
  }
);
