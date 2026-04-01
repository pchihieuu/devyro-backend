import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { blogService } from "../services/blog.service";
import { blogCategoryService } from "../services/blogCategory.service";
import { uploadService } from "../services/upload.service";
import { HTTP_STATUS } from "../constants/httpStatus";
import { BadRequestError } from "../utils/errors";

const getIp = (req: Request) =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
  req.socket.remoteAddress;

// Public
export const listPosts = asyncHandler(async (req: Request, res: Response) => {
  const { page = "1", limit = "10", category, tag, search } = req.query as any;
  const result = await blogService.listPublished({
    page: +page,
    limit: Math.min(+limit, 50),
    category,
    tag,
    search,
  });
  res.json({
    success: true,
    data: result.posts,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      totalPosts: result.total,
      limit: result.limit,
      hasNextPage: result.page < result.totalPages,
      hasPrevPage: result.page > 1,
    },
  });
});

export const getPost = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const post = await blogService.getBySlug(
    slug,
    getIp(req),
    req.user?.id,
    req.headers["user-agent"]
  );
  res.json({ success: true, data: post });
});

export const getRelatedPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const posts = await blogService.getRelated(id);
    res.json({ success: true, data: posts });
  }
);

export const getPostById = asyncHandler(async (req: Request, res: Response) => {
  const post = await blogService.getPostById(req.params.id);
  res.json({
    success: true,
    data: post,
  });
});
export const getLatestPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Math.min(+(req.query.limit as string) || 5, 20);
    const posts = await blogService.getLatest(limit);
    res.json({ success: true, data: posts });
  }
);

export const listCategories = asyncHandler(
  async (_req: Request, res: Response) => {
    const cats = await blogCategoryService.list();
    res.json({ success: true, data: cats });
  }
);

// Admin
export const adminListPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = "1", limit = "10", status, search } = req.query as any;
    const result = await blogService.adminListPosts({
      page: +page,
      limit: Math.min(+limit, 50),
      status,
      search,
    });
    res.json({
      success: true,
      data: result.posts,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalPosts: result.total,
        limit: result.limit,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      },
    });
  }
);

export const createPost = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new BadRequestError("Not authenticated");
  const post = await blogService.createPost({
    ...req.body,
    authorId: req.user.id,
  });
  res.status(HTTP_STATUS.CREATED).json({ success: true, data: post });
});

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const post = await blogService.updatePost(req.params.id, req.body);
  res.json({ success: true, data: post });
});

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  await blogService.deletePost(req.params.id);
  res.json({ success: true, message: "Post deleted" });
});

// Upload image post (admin only)
export const uploadBlogImage = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.file) throw new BadRequestError("No file uploaded");
    const result = await uploadService.uploadImage(
      req.file.buffer,
      req.file.mimetype
    );
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: { imageUrl: result.url, publicId: result.publicId },
    });
  }
);

// Admin category management
export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const cat = await blogCategoryService.create(req.body);
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: cat });
  }
);

export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const cat = await blogCategoryService.update(req.params.id, req.body);
    res.json({ success: true, data: cat });
  }
);

export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    await blogCategoryService.delete(req.params.id);
    res.json({ success: true, message: "Category deleted" });
  }
);
