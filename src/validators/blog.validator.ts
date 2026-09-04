import { z } from "zod";
import { BlogPostStatus } from "../entities/BlogPost.entity";
import { BlogCategoryType } from "../entities/BlogCategory.entity";
import { createPaginationSchema } from "./common.validator";

const tagsField = z
  .array(z.string().trim().min(1).max(50))
  .optional()
  .default([]);

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(5).max(255),
    excerpt: z.string().trim().max(500).optional(),
    content: z.string().min(1),
    categoryId: z.string().uuid(),
    tags: tagsField,
    thumbnail: z.string().url().optional(),
    status: z
      .nativeEnum(BlogPostStatus)
      .optional()
      .default(BlogPostStatus.DRAFT),
  }),
});
export type CreatePostBody = z.infer<typeof createPostSchema>["body"];

export const updatePostSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(5).max(255).optional(),
    excerpt: z.string().trim().max(500).optional(),
    content: z.string().min(1).optional(),
    categoryId: z.string().uuid().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).optional(),
    thumbnail: z.string().url().optional().nullable(),
    status: z.nativeEnum(BlogPostStatus).optional(),
  }),
});
export type UpdatePostParams = z.infer<typeof updatePostSchema>["params"];
export type UpdatePostBody = z.infer<typeof updatePostSchema>["body"];

// Dùng chung cho getPostById / deletePost / getRelatedPosts
export const postIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
export type PostIdParams = z.infer<typeof postIdParamSchema>["params"];

export const getBySlugSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});
export type GetBySlugParams = z.infer<typeof getBySlugSchema>["params"];

export const latestPostsSchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional().default("5"),
  }),
});
export type LatestPostsQuery = z.infer<typeof latestPostsSchema>["query"];

const postPaginationSchema = createPaginationSchema(
  ["publishedAt", "viewCount", "createdAt"] as const,
  "publishedAt"
);

// Schema public: KHÔNG có field status — status luôn cố định = published ở service.
// (Bug cũ: field status từng bị khai ở đây nhưng service không đọc → im lặng bỏ qua)
export const listPostsSchema = z.object({
  query: postPaginationSchema.merge(
    z.object({
      category: z.string().optional(),
      tag: z.string().optional(),
      search: z.string().trim().optional(),
    })
  ),
});
export type ListPostsQuery = z.infer<typeof listPostsSchema>["query"];

// Schema admin: tách riêng, có thêm status filter.
export const adminListPostsSchema = z.object({
  query: postPaginationSchema.merge(
    z.object({
      search: z.string().trim().optional(),
      status: z.nativeEnum(BlogPostStatus).optional(),
    })
  ),
});
export type AdminListPostsQuery = z.infer<typeof adminListPostsSchema>["query"];

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().optional(),
    type: z.nativeEnum(BlogCategoryType),
    isActive: z.boolean().optional().default(true)
  }),
});
export type CreateCategoryBody = z.infer<typeof createCategorySchema>["body"];

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().optional().nullable(),
    type: z.nativeEnum(BlogCategoryType).optional(),
    isActive: z.boolean().optional(),
  }),
});
export type UpdateCategoryParams = z.infer<
  typeof updateCategorySchema
>["params"];
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>["body"];

export const categoryIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
export type CategoryIdParams = z.infer<typeof categoryIdParamSchema>["params"];
