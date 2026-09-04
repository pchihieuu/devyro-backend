import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { blogService } from "../services/blog.service";
import { blogCategoryService } from "../services/blogCategory.service";
import { uploadService } from "../services/upload.service";
import { HTTP_STATUS } from "../constants/httpStatus";
import { BadRequestError } from "../utils/errors";
import {
  AdminListPostsQuery,
  CategoryIdParams,
  CreateCategoryBody,
  CreatePostBody,
  GetBySlugParams,
  LatestPostsQuery,
  ListPostsQuery,
  PostIdParams,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdatePostBody,
  UpdatePostParams,
} from "../validators/blog.validator";
import { ValidatedRequest } from "../types/express";
import { buildPaginationMeta } from "../utils/pagination.util";

const getIp = (req: { headers: any; socket: any }): string | undefined =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
  req.socket.remoteAddress;

// Public
export const listPosts = asyncHandler<ValidatedRequest<never, ListPostsQuery>>(
  async (req, res: Response) => {
    const result = await blogService.listPublished(req.validatedQuery);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.items,
      pagination: buildPaginationMeta(result),
    });
  }
);

export const getPost = asyncHandler<ValidatedRequest<GetBySlugParams>>(
  async (req, res: Response) => {
    const post = await blogService.getBySlug(
      req.validatedParams.slug,
      getIp(req),
      req.user?.id,
      req.headers["user-agent"]
    );
    res.status(HTTP_STATUS.OK).json({ success: true, data: post });
  }
);

export const getRelatedPosts = asyncHandler<ValidatedRequest<PostIdParams>>(
  async (req, res: Response) => {
    const posts = await blogService.getRelated(req.validatedParams.id);
    res.status(HTTP_STATUS.OK).json({ success: true, data: posts });
  }
);

export const getLatestPosts = asyncHandler<
  ValidatedRequest<never, LatestPostsQuery>
>(async (req, res: Response) => {
  const limit = Math.min(+req.validatedQuery.limit, 20);
  const posts = await blogService.getLatest(limit);
  res.status(HTTP_STATUS.OK).json({ success: true, data: posts });
});

export const listCategories = asyncHandler(async (_req, res: Response) => {
  const cats = await blogCategoryService.list();
  res.status(HTTP_STATUS.OK).json({ success: true, data: cats });
});

// Admin
export const adminListPosts = asyncHandler<
  ValidatedRequest<never, AdminListPostsQuery>
>(async (req, res: Response) => {
  const result = await blogService.adminListPosts(req.validatedQuery);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: result.items,
    pagination: buildPaginationMeta(result),
  });
});

export const adminListCategories = asyncHandler(async (_req, res: Response) => {
  const cats = await blogCategoryService.adminList();
  res.status(HTTP_STATUS.OK).json({ success: true, data: cats });
});

export const getPostById = asyncHandler<ValidatedRequest<PostIdParams>>(
  async (req, res: Response) => {
    const post = await blogService.getPostById(req.validatedParams.id);
    res.status(HTTP_STATUS.OK).json({ success: true, data: post });
  }
);

export const createPost = asyncHandler<
  ValidatedRequest<never, never, CreatePostBody>
>(async (req, res: Response) => {
  if (!req.user) throw new BadRequestError("Not authenticated");
  const post = await blogService.createPost({
    ...req.body,
    authorId: req.user.id,
  });
  res.status(HTTP_STATUS.CREATED).json({ success: true, data: post });
});

export const updatePost = asyncHandler<
  ValidatedRequest<UpdatePostParams, never, UpdatePostBody>
>(async (req, res: Response) => {
  const post = await blogService.updatePost(req.validatedParams.id, req.body);
  res.status(HTTP_STATUS.OK).json({ success: true, data: post });
});

export const deletePost = asyncHandler<ValidatedRequest<PostIdParams>>(
  async (req, res: Response) => {
    await blogService.deletePost(req.validatedParams.id);
    res.status(HTTP_STATUS.OK).json({ success: true, message: "Post deleted" });
  }
);

// Upload image post (admin only) — multipart, không qua Zod body validate
export const uploadBlogImage = asyncHandler(async (req, res: Response) => {
  if (!req.file) throw new BadRequestError("No file uploaded");
  const result = await uploadService.uploadImage(
    req.file.buffer,
    req.file.mimetype
  );
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    data: { imageUrl: result.url, publicId: result.publicId },
  });
});

// Admin category management
export const createCategory = asyncHandler<
  ValidatedRequest<never, never, CreateCategoryBody>
>(async (req, res: Response) => {
  const cat = await blogCategoryService.create(req.body);
  res.status(HTTP_STATUS.CREATED).json({ success: true, data: cat });
});

export const updateCategory = asyncHandler<
  ValidatedRequest<UpdateCategoryParams, never, UpdateCategoryBody>
>(async (req, res: Response) => {
  const cat = await blogCategoryService.update(
    req.validatedParams.id,
    req.body
  );
  res.status(HTTP_STATUS.OK).json({ success: true, data: cat });
});

export const deleteCategory = asyncHandler<ValidatedRequest<CategoryIdParams>>(
  async (req, res: Response) => {
    const result = await blogCategoryService.delete(req.validatedParams.id);
    const message =
      result.action === "deactivated"
        ? "Category is in use (including deleted posts) — deactivated instead of deleted"
        : "Category deleted";
    res.status(HTTP_STATUS.OK).json({ success: true, message: message });
  }
);
